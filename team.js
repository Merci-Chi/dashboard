(() => {
  "use strict";

  const SUPABASE_URL = "https://glonbvrcudwuzjundrii.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_VZbed_uuOXSE744UrAfHXw_z2xDdYtr";

  const VIEWS = [
    ["dashboard", "Dashboard"],
    ["leads", "Leads"],
    ["outreach", "Outreach"],
    ["staging", "Staging"],
    ["review", "Review"],
    ["live", "Live"],
    ["contact", "Contact"],
    ["clients", "Clients"],
    ["requests", "Requests"],
    ["ideas", "Ideas"],
    ["scripts", "Scripts"],
    ["assets", "Assets"],
    ["seo", "SEO"],
    ["domain", "Domain"],
    ["hosting", "Hosting"],
    ["prospects", "Prospects"],
    ["onboarding", "Onboarding"],
    ["data-collection", "Data Collection"],
    ["payment", "Payment"],
    ["site-development", "Site Development"],
    ["delivery", "Delivery"],
    ["reports", "Reports"],
    ["team", "Team"],
  ];

  const ALL_VIEWS = VIEWS.map((item) => item[0]);
  const ROLE_DEFAULTS = {
    ADMIN: ALL_VIEWS,
    MOD: [
      "dashboard", "leads", "staging", "outreach", "live", "ideas", "scripts",
      "assets", "seo", "prospects", "onboarding", "data-collection", "payment",
      "site-development", "delivery", "reports",
    ],
    SALES: ["leads", "outreach"],
    BUILDING: ["staging"],
  };
  const ROLE_LABELS = {
    ADMIN: "ADMIN",
    MOD: "MOD",
    SALES: "SALES",
    BUILDING: "BUILDING",
  };

  let client = null;
  let team = [];
  let callerId = "";

  const $ = (selector, root = document) => root.querySelector(selector);

  function slugName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  function setStatus(element, message, type = "") {
    if (!element) return;
    element.textContent = message;
    element.className = element.className.replace(/\s(?:error|success)\b/g, "");
    if (type) element.classList.add(type);
  }

  function selectedViews(container) {
    return [...container.querySelectorAll("[data-permission]:checked")].map((input) => input.value);
  }

  function setPermissionSelection(container, views, disabled = false) {
    const selected = new Set(views || []);
    container.querySelectorAll("[data-permission]").forEach((input) => {
      input.checked = selected.has(input.value);
      input.disabled = disabled || input.value === "team";
    });
  }

  function renderPermissions(container, views, disabled = false) {
    container.replaceChildren();
    VIEWS.forEach(([value, label]) => {
      const option = document.createElement("label");
      option.className = "permission-option";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = value;
      input.dataset.permission = value;
      input.checked = (views || []).includes(value);
      input.disabled = disabled || value === "team";
      const text = document.createElement("span");
      text.textContent = label;
      option.append(input, text);
      container.append(option);
    });
  }

  async function functionErrorMessage(error) {
    try {
      if (error?.context?.json) {
        const body = await error.context.json();
        if (body?.message) return body.message;
      }
    } catch (_) {}
    return error?.message || "Something went wrong.";
  }

  async function invoke(body) {
    const { data, error } = await client.functions.invoke("team-admin", { body });
    if (error) throw new Error(await functionErrorMessage(error));
    if (data?.message && !data?.success && !data?.users) throw new Error(data.message);
    return data;
  }

  function initials(name, email) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return String(parts[0] || email || "?").slice(0, 2).toUpperCase();
  }

  function bindRoleControls(roleSelect, permissionContainer) {
    roleSelect.addEventListener("change", () => {
      const role = roleSelect.value;
      const views = ROLE_DEFAULTS[role] || [];
      setPermissionSelection(permissionContainer, views, role === "ADMIN");
    });

    permissionContainer.addEventListener("change", () => {
      if (roleSelect.value === "ADMIN") return;
      const chosen = selectedViews(permissionContainer);
      const matched = Object.entries(ROLE_DEFAULTS).find(([role, defaults]) =>
        role !== "ADMIN" &&
        defaults.length === chosen.length &&
        defaults.every((view) => chosen.includes(view))
      );
      if (matched) roleSelect.value = matched[0];
    });
  }

  function renderMember(member) {
    const fragment = $("#memberTemplate").content.cloneNode(true);
    const card = $(".member-card", fragment);
    const summary = $(".member-summary", fragment);
    const editor = $(".member-editor", fragment);
    const roleSelect = $(".member-role", fragment);
    const activeInput = $(".member-active", fragment);
    const permissionContainer = $(".member-permissions", fragment);
    const status = $(".member-status", fragment);
    const saveButton = $(".save-button", fragment);
    const locked = member.owner || member.id === callerId;

    $(".member-avatar", fragment).textContent = initials(member.name, member.email);
    $(".member-name", fragment).textContent = member.name;
    $(".member-email", fragment).textContent = member.email;
    $(".role-pill", fragment).textContent = ROLE_LABELS[member.role] || member.role;

    const statusPill = $(".status-pill", fragment);
    statusPill.textContent = member.active ? "Active" : "No access";
    statusPill.classList.toggle("inactive", !member.active);

    roleSelect.value = member.role;
    activeInput.checked = member.active;
    renderPermissions(permissionContainer, member.views, member.role === "ADMIN" || locked);
    bindRoleControls(roleSelect, permissionContainer);

    summary.addEventListener("click", () => {
      const open = editor.hidden;
      editor.hidden = !open;
      card.classList.toggle("open", open);
      summary.setAttribute("aria-expanded", String(open));
    });

    if (locked) {
      roleSelect.disabled = true;
      activeInput.disabled = true;
      saveButton.disabled = true;
      setStatus(status, member.owner
        ? "The owner always keeps full access."
        : "You cannot change your own administrator access.");
    }

    saveButton.addEventListener("click", async () => {
      saveButton.disabled = true;
      setStatus(status, "Saving…");
      try {
        await invoke({
          action: "update",
          userId: member.id,
          role: roleSelect.value,
          views: selectedViews(permissionContainer),
          active: activeInput.checked,
        });
        setStatus(status, "Access saved.", "success");
        await loadTeam(false);
      } catch (error) {
        setStatus(status, error.message, "error");
      } finally {
        saveButton.disabled = false;
      }
    });

    return fragment;
  }

  function renderTeam() {
    const list = $("#teamList");
    const query = $("#teamSearch").value.trim().toLowerCase();
    const filtered = team.filter((member) =>
      !query ||
      String(member.name).toLowerCase().includes(query) ||
      String(member.email).toLowerCase().includes(query) ||
      String(ROLE_LABELS[member.role] || member.role).toLowerCase().includes(query)
    );

    list.replaceChildren();
    filtered.forEach((member) => list.append(renderMember(member)));
    setStatus($("#pageStatus"), filtered.length
      ? filtered.length + " team member" + (filtered.length === 1 ? "" : "s")
      : "No team members found.");
  }

  async function loadTeam(showLoading = true) {
    if (showLoading) setStatus($("#pageStatus"), "Loading team…");
    $("#refreshButton").disabled = true;
    try {
      const data = await invoke({ action: "list" });
      callerId = data.callerId || "";
      team = (data.users || []).sort((a, b) =>
        Number(b.owner) - Number(a.owner) ||
        Number(b.active) - Number(a.active) ||
        String(a.name).localeCompare(String(b.name))
      );
      renderTeam();
    } catch (error) {
      setStatus($("#pageStatus"), error.message, "error");
      $("#teamList").replaceChildren();
    } finally {
      $("#refreshButton").disabled = false;
    }
  }

  function openCreate() {
    $("#createPanel").hidden = false;
    $("#showCreateButton").hidden = true;
    $("#firstName").focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeCreate() {
    $("#createPanel").hidden = true;
    $("#showCreateButton").hidden = false;
    setStatus($("#createStatus"), "");
  }

  async function handleCreate(event) {
    event.preventDefault();
    const button = $("#createButton");
    const status = $("#createStatus");
    const firstName = $("#firstName").value.trim();
    const displayName = $("#displayName").value.trim();
    const username = slugName(firstName);

    if (username.length < 2) {
      setStatus(status, "Enter a valid first name.", "error");
      return;
    }
    if (displayName.length < 2) {
      setStatus(status, "Enter the name shown in the dashboard.", "error");
      return;
    }

    button.disabled = true;
    setStatus(status, "Creating account…");
    try {
      const data = await invoke({
        action: "create",
        firstName,
        displayName,
        role: $("#newRole").value,
        views: selectedViews($("#newPermissions")),
      });
      setStatus(status, "Created " + data.email + " with temporary password: " + data.temporaryPassword, "success");
      $("#createForm").reset();
      $("#newRole").value = "SALES";
      setPermissionSelection($("#newPermissions"), ROLE_DEFAULTS.SALES);
      $("#emailPreview").textContent = "firstname@steadyhandsop.com";
      await loadTeam(false);
    } catch (error) {
      setStatus(status, error.message, "error");
    } finally {
      button.disabled = false;
    }
  }

  async function initialize() {
    renderPermissions($("#newPermissions"), ROLE_DEFAULTS.SALES);
    bindRoleControls($("#newRole"), $("#newPermissions"));

    $("#showCreateButton").addEventListener("click", openCreate);
    $("#hideCreateButton").addEventListener("click", closeCreate);
    $("#createForm").addEventListener("submit", handleCreate);
    $("#refreshButton").addEventListener("click", () => loadTeam());
    $("#teamSearch").addEventListener("input", renderTeam);
    $("#firstName").addEventListener("input", (event) => {
      const username = slugName(event.target.value);
      $("#emailPreview").textContent = (username || "firstname") + "@steadyhandsop.com";
      if (!$("#displayName").value.trim()) $("#displayName").value = event.target.value.trim();
    });

    if (!window.supabase?.createClient) {
      setStatus($("#pageStatus"), "Could not load the login service. Refresh the dashboard.", "error");
      return;
    }

    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });

    const { data } = await client.auth.getSession();
    if (!data?.session) {
      setStatus($("#pageStatus"), "Your session is not ready. Refresh the dashboard and try again.", "error");
      return;
    }

    await loadTeam();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
