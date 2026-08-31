import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const squareBaseUrl = "https://connect.squareup.com";
const squareVersion = "2026-08-19";

const plans: Record<string, { label: string; url: string }> = {
  "beta-testing": { label: "DEMO23 Production Subscription — $1/month", url: Deno.env.get("SQUARE_BETA_PAYMENT_LINK") || "" },
  "maple-monthly": { label: "MAPLE01 Membership — $10/month", url: Deno.env.get("SQUARE_MAPLE_MONTHLY_PAYMENT_LINK") || "" },
  "standard-monthly": { label: "Standard Website Hosting — $20/month", url: Deno.env.get("SQUARE_STANDARD_MONTHLY_PAYMENT_LINK") || "" },
  "backend-monthly": { label: "Backend Website Hosting — $30/month", url: Deno.env.get("SQUARE_BACKEND_MONTHLY_PAYMENT_LINK") || "" }
};

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const auth = req.headers.get("Authorization") || "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user } } = await supabase.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (!user?.email) return json({ message: "Sign in before starting checkout." }, 401);
  const body = await req.json().catch(() => ({}));
  const normalizedCode = (value: unknown) => String(value || "").trim().toUpperCase();
  const validMapleCode = (value: unknown) => normalizedCode(value) === "MAPLE01";
  const validBetaCode = (value: unknown) => normalizedCode(value) === "DEMO23";

  if (body.action === "validate-discount-code") {
    if (validBetaCode(body.code)) return json({ valid: true, plan: { key: "beta-testing", label: "DEMO23 Production Subscription", price: "$1/month · Real recurring charge" } });
    if (validMapleCode(body.code)) return json({ valid: true, plan: { key: "maple-monthly", label: "MAPLE01 Membership", price: "$10/month" } });
    return json({ valid: false });
  }

  if (body.action === "verify-checkout") {
    const { data } = await supabase.from("square_checkout_sessions").select("status, plan_key").eq("id", body.checkoutId).eq("user_id", user.id).maybeSingle();
    if (data?.plan_key === "beta-testing" && data.status !== "verified") {
      const productionHeaders = { Authorization: `Bearer ${Deno.env.get("SQUARE_ACCESS_TOKEN")}`, "Content-Type": "application/json", "Square-Version": squareVersion };
      const customersResponse = await fetch(`${squareBaseUrl}/v2/customers?limit=100`, { headers: productionHeaders });
      const customersBody = await customersResponse.json().catch(() => ({}));
      const customer = customersBody.customers?.find((item: { email_address?: string }) => item.email_address?.toLowerCase() === user.email!.toLowerCase());
      if (customer?.id) {
        const subscriptionsResponse = await fetch(`${squareBaseUrl}/v2/subscriptions/search`, {
          method: "POST", headers: productionHeaders, body: JSON.stringify({ query: { filter: { customer_ids: [customer.id] } } })
        });
        const subscriptionsBody = await subscriptionsResponse.json().catch(() => ({}));
        const subscription = subscriptionsBody.subscriptions?.find((item: { plan_variation_id?: string; status?: string }) =>
          item.plan_variation_id === Deno.env.get("SQUARE_BETA_PLAN_VARIATION_ID") && item.status === "ACTIVE"
        );
        if (subscription) {
          await supabase.from("hosting_subscriptions").upsert({
            user_id: user.id, square_subscription_id: subscription.id, square_customer_id: customer.id,
            plan_key: "beta-testing", plan_name: "DEMO23 Production Subscription", amount_cents: 100, billing_cadence: "MONTHLY",
            status: subscription.status, charged_through_date: subscription.charged_through_date || null, updated_at: new Date().toISOString()
          }, { onConflict: "square_subscription_id" });
          await supabase.from("square_checkout_sessions").update({ status: "verified", updated_at: new Date().toISOString() }).eq("id", body.checkoutId).eq("user_id", user.id);
          return json({ verified: true, status: "verified", planKey: "beta-testing" });
        }
      }
    }
    return json({ verified: data?.status === "verified", status: data?.status || "not_found", planKey: data?.plan_key });
  }

  if (body.action === "cancel") {
    const { data: owned } = await supabase.from("hosting_subscriptions").select("square_subscription_id,charged_through_date,plan_key").eq("id", body.subscriptionId).eq("user_id", user.id).maybeSingle();
    if (!owned) return json({ message: "Subscription not found." }, 404);
    const response = await fetch(`${squareBaseUrl}/v2/subscriptions/${owned.square_subscription_id}/cancel`, {
      method: "POST", headers: { Authorization: `Bearer ${Deno.env.get("SQUARE_ACCESS_TOKEN")}`, "Content-Type": "application/json", "Square-Version": squareVersion }
    });
    if (!response.ok) return json({ message: "Square could not cancel the subscription." }, 502);
    await supabase.from("hosting_subscriptions").update({ status: "CANCELED", updated_at: new Date().toISOString() }).eq("square_subscription_id", owned.square_subscription_id);
    return json({ success: true, accessUntil: owned.charged_through_date });
  }

  if (body.action !== "create-checkout" || !plans[body.planKey]) return json({ message: "Unknown action or plan." }, 400);
  const { data: agreement } = await supabase.from("hosting_agreements")
    .select("id,plan_key,accepted,signer_email")
    .eq("id", body.agreementId || "00000000-0000-0000-0000-000000000000")
    .eq("user_id", user.id)
    .eq("plan_key", body.planKey)
    .eq("accepted", true)
    .maybeSingle();
  if (!agreement || agreement.signer_email.toLowerCase() !== user.email.toLowerCase()) {
    return json({ message: "Sign the hosting agreement before starting Square checkout." }, 403);
  }
  if (body.planKey === "maple-monthly" && !validMapleCode(body.discountCode)) return json({ message: "A valid discount code is required for this plan." }, 403);
  if (body.planKey === "beta-testing" && !validBetaCode(body.discountCode)) return json({ message: "A valid beta code is required for this plan." }, 403);
  const plan = plans[body.planKey];
  if (!plan.url) return json({ message: `${plan.label} is not configured in Square yet.` }, 503);
  const { data: session, error: sessionError } = await supabase.from("square_checkout_sessions").insert({ user_id: user.id, user_email: user.email, plan_key: body.planKey, agreement_id: agreement.id }).select("id").single();
  if (sessionError) return json({ message: "Could not create checkout session." }, 500);
  return json({ checkoutId: session.id, checkoutUrl: plan.url });
});
