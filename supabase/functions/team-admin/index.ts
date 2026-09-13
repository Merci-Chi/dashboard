import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALL_VIEWS = [
  "dashboard", "leads", "outreach", "staging", "review", "live", "contact",
  "clients", "requests", "ideas", "scripts", "assets", "seo", "domain",
  "hosting", "prospects", "onboarding", "data-collection", "payment",
  "site-development", "delivery", "reports", "team",
] as const;

const ROLE_DEFAULTS: Record<string, string[]> = {
  ADMIN: [...ALL_VIEWS],
  MOD: ["leads", "staging", "outreach", "review"],
  SALES: ["leads", "outreach"],
  PREP: ["staging"],
  CUSTOM: [],
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

const adminClient = () => createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function normalizeViews(value: unknown) {
  const requested = Array.isArray(value) ? value.map(String) : [];
  return ALL_VIEWS.filter((view) => requested.includes(view));
}

function normalizeRole(value: unknown) {
  const role = String(value || "CUSTOM").trim().toUpperCase();
  if (!Object.hasOwn(ROLE_DEFAULTS, role)) throw new Error("Choose a valid team role.");
  return role;
}

function emailUsername(firstName: unknown) {
  return String(firstName || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ message: "Method not allowed." }, 405);

  try {
    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token) return json({ message: "Please sign in again." }, 401);

    const db = adminClient();
    const { data: authData, error: authError } = await db.auth.getUser(token);
    if (authError || !authData.user) return json({ message: "Please sign in again." }, 401);

    const caller = authData.user;
    const { data: callerPermission } = await db
      .from("team_permissions")
      .select("role, active")
      .eq("user_id", caller.id)
      .maybeSingle();

    const { data: callerMember } = await db
      .from("members")
      .select("role")
      .eq("userid", caller.id)
      .maybeSingle();

    const canManage = callerPermission?.active && callerPermission.role === "ADMIN";
    const isOwner = callerMember?.role === "owner";
    if (!canManage && !isOwner) return json({ message: "Administrator access is required." }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "list");

    if (action === "list") {
      const { data: listed, error: listError } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) throw listError;

      const users = listed.users.filter((user) => {
        const email = String(user.email || "").toLowerCase();
        const meta = user.app_metadata || {};
        return email.endsWith("@steadyhandsop.com") || meta.team_member === true || Array.isArray(meta.roles);
      });

      const ids = users.map((user) => user.id);
      const [{ data: permissions, error: permissionError }, { data: members, error: memberError }] = await Promise.all([
        ids.length
          ? db.from("team_permissions").select("user_id, role, views, active").in("user_id", ids)
          : Promise.resolve({ data: [], error: null }),
        ids.length
          ? db.from("members").select("userid, role").in("userid", ids)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (permissionError) throw permissionError;
      if (memberError) throw memberError;

      const permissionMap = new Map((permissions || []).map((item) => [item.user_id, item]));
      const memberMap = new Map((members || []).map((item) => [item.userid, item.role]));

      return json({
        users: users.map((user) => {
          const permission = permissionMap.get(user.id);
          const owner = memberMap.get(user.id) === "owner";
          const metadataRole = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles[0] : "CUSTOM";
          const role = owner ? "ADMIN" : (permission?.role || normalizeRole(metadataRole));
          const views = role === "ADMIN"
            ? [...ALL_VIEWS]
            : normalizeViews(permission?.views || user.app_metadata?.dashboard_views || ROLE_DEFAULTS[role]);

          return {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Team member",
            role,
            views,
            active: owner ? true : (permission?.active ?? user.app_metadata?.team_active !== false),
            owner,
            createdAt: user.created_at,
          };
        }),
        callerId: caller.id,
      });
    }

    if (action === "create") {
      const username = emailUsername(body.firstName);
      if (username.length < 2) return json({ message: "Enter a first name with at least 2 letters." }, 400);

      const email = `${username}@steadyhandsop.com`;
      const displayName = String(body.displayName || body.firstName || "").trim();
      const role = normalizeRole(body.role);
      const views = role === "ADMIN" ? [...ALL_VIEWS] : normalizeViews(body.views || ROLE_DEFAULTS[role]);

      const { data: created, error: createError } = await db.auth.admin.createUser({
        email,
        password: "password",
        email_confirm: true,
        app_metadata: { roles: [role], dashboard_views: views, team_member: true, team_active: true },
        user_metadata: { display_name: displayName, onboarding_complete: false, temporary_password: true },
      });
      if (createError) throw createError;
      if (!created.user) throw new Error("The account was not created.");

      const { error: permissionError } = await db.from("team_permissions").insert({
        user_id: created.user.id,
        role,
        views,
        active: true,
      });
      if (permissionError) {
        await db.auth.admin.deleteUser(created.user.id);
        throw permissionError;
      }

      return json({ success: true, email, temporaryPassword: "password" }, 201);
    }

    if (action === "update") {
      const userId = String(body.userId || "");
      if (!userId) return json({ message: "Choose a team member." }, 400);

      const { data: member } = await db.from("members").select("role").eq("userid", userId).maybeSingle();
      if (member?.role === "owner") return json({ message: "The owner always keeps full access." }, 400);
      if (userId === caller.id) return json({ message: "You cannot change your own administrator access." }, 400);

      const role = normalizeRole(body.role);
      const active = body.active !== false;
      const views = role === "ADMIN" ? [...ALL_VIEWS] : normalizeViews(body.views || ROLE_DEFAULTS[role]);

      const { data: existing, error: existingError } = await db.auth.admin.getUserById(userId);
      if (existingError || !existing.user) return json({ message: "Team member not found." }, 404);

      const { error: updateError } = await db.auth.admin.updateUserById(userId, {
        app_metadata: {
          ...(existing.user.app_metadata || {}),
          roles: [role],
          dashboard_views: views,
          team_member: true,
          team_active: active,
        },
      });
      if (updateError) throw updateError;

      const { error: permissionError } = await db.from("team_permissions").upsert({
        user_id: userId,
        role,
        views,
        active,
        updated_at: new Date().toISOString(),
      });
      if (permissionError) throw permissionError;

      return json({ success: true });
    }

    return json({ message: "Unknown action." }, 400);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    const status = /already|registered|exists/i.test(message) ? 409 : 500;
    return json({ message }, status);
  }
});
