(() => {
  "use strict";

  const SUPABASE_URL = "https://glonbvrcudwuzjundrii.supabase.co";
  const SUPABASE_KEY = "sb_publishable_VZbed_uuOXSE744UrAfHXw_z2xDdYtr";

  let client = null;
  let state = {
    users: [],
    calls: [],
    commissions: [],
    bonuses: [],
    crm: [],
  };
  let activeTab = "users";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));

  const money = (cents) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
      .format((Number(cents) || 0) / 100);

  const ageDays = (value) => {
    if (!value) return Infinity;
    return Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  };

  const userById = () => new Map(state.users.map((user) => [user.user_id, user]));
  const crmById = () => new Map(state.crm.map((lead) => [lead.id, lead]));

  function statusFor(user) {
    if (user.disabled_at) return { label: "Disabled", cls: "status-disabled" };

    if (!user.last_call_at) {
      const accountAge = ageDays(user.created_at);
      if (accountAge >= 90) return { label: "Disabled / 90+ days", cls: "status-disabled" };
      return { label: "Inactive", cls: "status-inactive" };
    }

    const days = ageDays(user.last_call_at);
    if (days >= 90) return { label: "Disabled / 90+ days", cls: "status-disabled" };
    if (days <= 30) return { label: "Active", cls: "status-active" };
    return { label: "Inactive", cls: "status-inactive" };
  }

  function initials(name, email) {
    const source = String(name || email || "?").trim();
    return source.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  }

  function setStatus(message) {
    $("#pageStatus").textContent = message;
  }

  function query() {
    return $("#searchInput").value.trim().toLowerCase();
  }

  function callCount(userId) {
    return state.calls.filter((call) => call.user_id === userId).length;
  }

  function filteredUsers() {
    const search = query();
    const filter = $("#statusFilter").value;

    return state.users.filter((user) => {
      const status = statusFor(user).label.toLowerCase();
      const matchesSearch = !search || [
        user.display_name,
        user.email,
        user.phone,
        user.referral_code,
      ].join(" ").toLowerCase().includes(search);

      let matchesFilter = true;
      if (filter === "active") matchesFilter = status === "active";
      if (filter === "inactive") matchesFilter = status === "inactive";
      if (filter === "disabled") matchesFilter = status.startsWith("disabled");

      return matchesSearch && matchesFilter;
    });
  }

  function renderSummary() {
    const active = state.users.filter((user) => statusFor(user).label === "Active").length;
    const pendingEarnings = state.commissions
      .filter((row) => row.status === "pending")
      .reduce((sum, row) => sum + (Number(row.commission_amount_cents) || 0), 0);
    const pendingBonuses = state.bonuses
      .filter((row) => row.status === "pending")
      .reduce((sum, row) => sum + (Number(row.amount_cents) || 0), 0);

    $("#totalUsers").textContent = state.users.length;
    $("#activeUsers").textContent = active;
    $("#pendingEarnings").textContent = money(pendingEarnings);
    $("#pendingBonuses").textContent = money(pendingBonuses);
  }

  async function saveUserDisabled(userId, disabled) {
    const patch = {
      disabled_at: disabled ? new Date().toISOString() : null,
      disabled_reason: disabled ? "Disabled from dashboard CallCenter admin" : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await client
      .from("callcenter_profiles")
      .update(patch)
      .eq("user_id", userId);

    if (error) throw error;
  }

  async function saveReferrer(userId, referrerUserId) {
    const { error } = await client
      .from("callcenter_profiles")
      .update({
        referred_by_user_id: referrerUserId || null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) throw error;
  }

  function renderUsers() {
    const panel = $("#panelUsers");
    const users = filteredUsers();
    const usersMap = userById();

    if (!users.length) {
      panel.innerHTML = '<div class="empty">No CallCenter users found.</div>';
      return;
    }

    panel.innerHTML = users.map((user) => {
      const status = statusFor(user);
      const referrer = usersMap.get(user.referred_by_user_id);
      const manuallyDisabled = Boolean(user.disabled_at);

      return `
        <article class="card user-card" data-user-id="${esc(user.user_id)}">
          <button class="user-summary" type="button" aria-expanded="false">
            <span class="avatar">${esc(initials(user.display_name, user.email))}</span>
            <span class="identity">
              <strong>${esc(user.display_name || "User")}</strong>
              <small>${esc(user.email || "")}</small>
            </span>
            <span class="status-pill ${status.cls}">${esc(status.label)}</span>
            <span class="user-calls">${callCount(user.user_id)} calls</span>
            <i class="bi bi-chevron-down"></i>
          </button>
          <div class="user-details" hidden>
            <div class="detail-grid">
              <div class="detail-box"><span>Referral Code</span><strong>${esc(user.referral_code || "—")}</strong></div>
              <div class="detail-box"><span>Referred By</span><strong>${esc(referrer?.display_name || referrer?.email || "None")}</strong></div>
              <div class="detail-box"><span>Last Call</span><strong>${user.last_call_at ? new Date(user.last_call_at).toLocaleString() : "Never"}</strong></div>
              <div class="detail-box"><span>Onboarding</span><strong>${user.onboarding_completed ? "Complete" : "Pending"}</strong></div>
            </div>
            <div class="actions">
              <button class="mini-button" type="button" data-change-referrer>Change Referrer</button>
              <button class="button ${manuallyDisabled ? "primary" : "danger"}" type="button" data-toggle-disabled>
                ${manuallyDisabled ? "Enable Account" : "Disable Account"}
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");

    $$(".user-card", panel).forEach((card) => {
      const userId = card.dataset.userId;
      const user = state.users.find((row) => row.user_id === userId);
      const summary = $(".user-summary", card);
      const details = $(".user-details", card);

      summary.addEventListener("click", () => {
        const open = details.hidden;
        details.hidden = !open;
        summary.setAttribute("aria-expanded", String(open));
      });

      $("[data-toggle-disabled]", card).addEventListener("click", async () => {
        try {
          await saveUserDisabled(userId, !user.disabled_at);
          await load();
        } catch (error) {
          alert(error.message || "Could not update account status.");
        }
      });

      $("[data-change-referrer]", card).addEventListener("click", async () => {
        const current = state.users.find((row) => row.user_id === user.referred_by_user_id);
        const answer = prompt(
          "Enter the referrer's email. Leave blank to remove the referral.",
          current?.email || ""
        );
        if (answer === null) return;

        const email = answer.trim().toLowerCase();
        const referrer = email
          ? state.users.find((row) => String(row.email || "").toLowerCase() === email)
          : null;

        if (email && !referrer) {
          alert("No CallCenter user was found with that email.");
          return;
        }
        if (referrer?.user_id === userId) {
          alert("A user cannot refer themselves.");
          return;
        }

        try {
          await saveReferrer(userId, referrer?.user_id || null);
          await load();
        } catch (error) {
          alert(error.message || "Could not change the referrer.");
        }
      });
    });
  }

  function renderEarnings() {
    const panel = $("#panelEarnings");
    const usersMap = userById();
    const search = query();

    const rows = state.commissions.filter((row) => {
      const user = usersMap.get(row.user_id);
      return !search || [
        user?.display_name,
        user?.email,
        row.client_name,
        row.status,
      ].join(" ").toLowerCase().includes(search);
    });

    if (!rows.length) {
      panel.innerHTML = '<div class="empty">No commissions found.</div>';
      return;
    }

    panel.innerHTML = `
      <section class="card data-card">
        ${rows.map((row) => {
          const user = usersMap.get(row.user_id);
          const amount = row.commission_amount_cents == null ? "" : (row.commission_amount_cents / 100).toFixed(2);
          const label = row.status === "waiting_client_payment"
            ? "Waiting on client payment"
            : row.status === "pending" ? "Pending" : "Complete";

          return `
            <div class="data-row" data-commission-id="${esc(row.id)}">
              <div class="data-main">
                <strong>${esc(row.client_name || "Client")}</strong>
                <small>${esc(user?.display_name || user?.email || "Unknown user")} · ${new Date(row.created_at).toLocaleDateString()}</small>
              </div>
              <div><span class="stage-pill ${row.status === "complete" ? "status-active" : row.status === "pending" ? "status-pending" : "status-inactive"}">${esc(label)}</span></div>
              <div><strong>${row.commission_amount_cents == null ? "—" : money(row.commission_amount_cents)}</strong></div>
              <div class="data-actions">
                <input type="number" min="0" step="0.01" value="${esc(amount)}" data-amount placeholder="Commission" />
                <select data-stage>
                  <option value="waiting_client_payment" ${row.status === "waiting_client_payment" ? "selected" : ""}>Waiting</option>
                  <option value="pending" ${row.status === "pending" ? "selected" : ""}>Pending</option>
                  <option value="complete" ${row.status === "complete" ? "selected" : ""}>Complete</option>
                </select>
                <button class="mini-button" type="button" data-save>Save</button>
              </div>
            </div>
          `;
        }).join("")}
      </section>
    `;

    $$(".data-row", panel).forEach((element) => {
      $("[data-save]", element).addEventListener("click", async () => {
        const id = element.dataset.commissionId;
        const stage = $("[data-stage]", element).value;
        const amountValue = $("[data-amount]", element).value.trim();
        const amountCents = amountValue === "" ? null : Math.round(Number(amountValue) * 100);

        if (amountValue !== "" && (!Number.isFinite(amountCents) || amountCents < 0)) {
          alert("Enter a valid commission amount.");
          return;
        }

        const patch = {
          status: stage,
          commission_amount_cents: amountCents,
          updated_at: new Date().toISOString(),
        };
        if (stage === "pending") patch.pending_at = new Date().toISOString();
        if (stage === "complete") patch.completed_at = new Date().toISOString();

        const { error } = await client.from("callcenter_commissions").update(patch).eq("id", id);
        if (error) return alert(error.message);
        await load();
      });
    });
  }

  function renderReferrals() {
    const panel = $("#panelReferrals");
    const usersMap = userById();
    const relationships = state.users.filter((user) => user.referred_by_user_id);

    panel.innerHTML = `
      <section class="card data-card">
        <h3>Referral Relationships</h3>
        ${relationships.length ? relationships.map((user) => {
          const referrer = usersMap.get(user.referred_by_user_id);
          return `
            <div class="data-row">
              <div class="data-main">
                <strong>${esc(user.display_name || user.email || "User")}</strong>
                <small>Referred by ${esc(referrer?.display_name || referrer?.email || "Unknown")}</small>
              </div>
              <div>${esc(user.referral_code || "—")}</div>
              <div></div>
              <div></div>
            </div>
          `;
        }).join("") : '<div class="empty">No referral relationships yet.</div>'}
      </section>

      <section class="card data-card">
        <h3>Referral Bonuses</h3>
        ${state.bonuses.length ? state.bonuses.map((bonus) => {
          const referrer = usersMap.get(bonus.referrer_user_id);
          const referred = usersMap.get(bonus.referred_user_id);
          return `
            <div class="data-row" data-bonus-id="${esc(bonus.id)}">
              <div class="data-main">
                <strong>${money(bonus.amount_cents)}</strong>
                <small>${esc(referrer?.display_name || referrer?.email || "Referrer")} from ${esc(referred?.display_name || referred?.email || "User")}</small>
              </div>
              <div><span class="stage-pill ${bonus.status === "complete" ? "status-active" : "status-pending"}">${esc(bonus.status)}</span></div>
              <div></div>
              <div class="data-actions">
                <select data-bonus-stage>
                  <option value="pending" ${bonus.status === "pending" ? "selected" : ""}>Pending</option>
                  <option value="complete" ${bonus.status === "complete" ? "selected" : ""}>Complete</option>
                </select>
                <button class="mini-button" type="button" data-bonus-save>Save</button>
              </div>
            </div>
          `;
        }).join("") : '<div class="empty">No referral bonuses yet.</div>'}
      </section>
    `;

    $$("[data-bonus-id]", panel).forEach((element) => {
      $("[data-bonus-save]", element).addEventListener("click", async () => {
        const status = $("[data-bonus-stage]", element).value;
        const { error } = await client
          .from("callcenter_referral_bonuses")
          .update({
            status,
            completed_at: status === "complete" ? new Date().toISOString() : null,
          })
          .eq("id", element.dataset.bonusId);

        if (error) return alert(error.message);
        await load();
      });
    });
  }

  function renderActivity() {
    const panel = $("#panelActivity");
    const usersMap = userById();
    const leadsMap = crmById();
    const search = query();

    const rows = state.calls.filter((call) => {
      const user = usersMap.get(call.user_id);
      const lead = leadsMap.get(call.crm_id);
      return !search || [
        user?.display_name,
        user?.email,
        lead?.company,
        lead?.name,
        call.outcome,
      ].join(" ").toLowerCase().includes(search);
    });

    if (!rows.length) {
      panel.innerHTML = '<div class="empty">No call activity found.</div>';
      return;
    }

    panel.innerHTML = `
      <section class="card data-card">
        ${rows.slice(0, 500).map((call) => {
          const user = usersMap.get(call.user_id);
          const lead = leadsMap.get(call.crm_id);
          return `
            <div class="data-row">
              <div class="data-main">
                <strong>${esc(lead?.company || lead?.name || "Lead")}</strong>
                <small>${esc(user?.display_name || user?.email || "Unknown user")} · ${new Date(call.created_at).toLocaleString()}</small>
              </div>
              <div>${Math.floor((Number(call.duration_seconds) || 0) / 60)}m ${(Number(call.duration_seconds) || 0) % 60}s</div>
              <div>${esc(call.outcome || "Call completed")}</div>
              <div></div>
            </div>
          `;
        }).join("")}
      </section>
    `;
  }

  function render() {
    renderSummary();
    renderUsers();
    renderEarnings();
    renderReferrals();
    renderActivity();

    $$(".panel").forEach((panel) => panel.classList.remove("active"));
    $(`#panel${activeTab[0].toUpperCase()}${activeTab.slice(1)}`).classList.add("active");
  }

  async function withTimeout(promise, ms, label) {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(label + " timed out.")), ms);
        })
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function load() {
    setStatus("Loading users…");
    $("#refreshButton").disabled = true;

    state = { users: [], calls: [], commissions: [], bonuses: [], crm: [] };

    try {
      const profilesResult = await withTimeout(
        client.from("callcenter_profiles").select("*").order("display_name", { ascending: true }),
        8000,
        "Users"
      );

      if (profilesResult.error) throw profilesResult.error;

      state.users = profilesResult.data || [];
      render();
      setStatus(`${state.users.length} CallCenter user${state.users.length === 1 ? "" : "s"} · loading details…`);

      const loaders = [
        withTimeout(
          client.from("callcenter_call_activity").select("*").order("created_at", { ascending: false }).limit(500),
          8000,
          "Activity"
        ).then((result) => {
          if (!result.error) state.calls = result.data || [];
        }).catch((error) => console.warn("CallCenter activity load:", error)),

        withTimeout(
          client.from("callcenter_commissions").select("*").order("created_at", { ascending: false }).limit(500),
          8000,
          "Earnings"
        ).then((result) => {
          if (!result.error) state.commissions = result.data || [];
        }).catch((error) => console.warn("CallCenter earnings load:", error)),

        withTimeout(
          client.from("callcenter_referral_bonuses").select("*").order("created_at", { ascending: false }).limit(500),
          8000,
          "Referral bonuses"
        ).then((result) => {
          if (!result.error) state.bonuses = result.data || [];
        }).catch((error) => console.warn("CallCenter bonus load:", error)),
      ];

      await Promise.allSettled(loaders);

      const crmIds = [...new Set(state.calls.map((call) => call.crm_id).filter(Boolean))];
      if (crmIds.length) {
        try {
          const leadsResult = await withTimeout(
            client.from("crm")
              .select("id,company,name,phone,stage,outcome")
              .in("id", crmIds.slice(0, 500)),
            8000,
            "CRM leads"
          );
          if (!leadsResult.error) state.crm = leadsResult.data || [];
        } catch (error) {
          console.warn("CallCenter CRM lead load:", error);
        }
      }

      render();
      setStatus(`${state.users.length} CallCenter user${state.users.length === 1 ? "" : "s"}`);
    } catch (error) {
      console.error(error);
      const message = error?.message || "Could not load CallCenter.";
      setStatus(message);
      ["panelUsers", "panelEarnings", "panelReferrals", "panelActivity"].forEach((id) => {
        const panel = document.getElementById(id);
        if (panel) panel.innerHTML = `<div class="empty">${esc(message)}</div>`;
      });
    } finally {
      $("#refreshButton").disabled = false;
    }
  }

  $$(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      activeTab = button.dataset.tab;
      $$(".tab").forEach((item) => item.classList.toggle("active", item === button));
      render();
    });
  });

  $("#searchInput").addEventListener("input", render);
  $("#statusFilter").addEventListener("change", render);
  $("#refreshButton").addEventListener("click", load);

  async function waitForParentClient(timeoutMs = 6000) {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      try {
        if (
          window.parent &&
          window.parent !== window &&
          window.parent.supabaseClient &&
          window.parent.supabaseSession?.user
        ) {
          return {
            client: window.parent.supabaseClient,
            session: window.parent.supabaseSession,
          };
        }
      } catch (_) {}

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return null;
  }

  async function initialize() {
    setStatus("Connecting to dashboard session…");

    const parentAuth = await waitForParentClient();

    let activeSession = null;

    if (parentAuth) {
      client = parentAuth.client;
      activeSession = parentAuth.session;
    } else {
      if (!window.supabase?.createClient) {
        setStatus("Could not load Supabase.");
        return;
      }

      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      setStatus("Dashboard session was not found. Open CallCenter from the signed-in dashboard.");
      return;
    }

    setStatus("Checking administrator access…");

    const permissionResult = await withTimeout(
      client
        .from("team_permissions")
        .select("role,active")
        .eq("user_id", activeSession.user.id)
        .maybeSingle(),
      8000,
      "Administrator check"
    ).catch((error) => ({ data: null, error }));

    if (
      permissionResult.error ||
      !permissionResult.data?.active ||
      permissionResult.data.role !== "ADMIN"
    ) {
      setStatus(
        permissionResult.error?.message ||
        "Administrator access is required."
      );
      return;
    }

    await load();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
