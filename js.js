(() => {
  "use strict";

  const SUPABASE_URL = "https://eucaziymnjjpkbwbxwfj.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ulLjvVJ81xRdSS_Wz9Qh4Q_nMSAlSfO";

  const ALL_VIEWS = [
    "dashboard",
    "leads",
    "clients",
    "tasks",
    "ideas",
    "scripts",
    "assets",
    "seo",
    "domain",
    "hosting",
    "prospects",
    "onboarding",
    "data-collection",
    "payment",
    "site-development",
    "delivery",
    "reports"
  ];

  const LEADS = ["leads"];
  const UNAUTHORIZED = ["unauthorized"];

  /*
   * ============================================================
   * USER ACCESS — EDIT ONLY THIS SECTION TO MANAGE PERMISSIONS
   * ============================================================
   *
   * ALL_VIEWS     = Access to every app page
   * LEADS         = Access to Leads only
   * UNAUTHORIZED  = Can sign in, but only sees Unauthorized
   *
   * Examples:
   * "person@steadyhandsop.com": ALL_VIEWS,
   * "person@steadyhandsop.com": LEADS,
   * "person@steadyhandsop.com": UNAUTHORIZED,
   *
   * Any Supabase user not listed here automatically receives
   * UNAUTHORIZED access.
   * ============================================================
   */
  const USER_ACCESS = {
    "kiara@steadyhandsop.com": ALL_VIEWS,
    "elijah@steadyhandsop.com": LEADS,
    "kiaradwilliams04@gmail.com": LEADS,
  };

  let supabase = null;
  let session = null;
  let allowedViews = [];
  let leadsLoadedForUser = "";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  function setScreen(screen) {
    $("#authGate").hidden = screen !== "login";
    $("#accountSetupGate").hidden = screen !== "setup";
    $("#appShell").hidden = screen !== "app";
  }

  function getEmail(currentSession = session) {
    return String(currentSession?.user?.email || "").trim().toLowerCase();
  }

  function getDisplayName(currentSession = session) {
    const user = currentSession?.user;
    if (!user) return "User";

    const meta = user.user_metadata || {};
    const name =
      meta.display_name ||
      meta.full_name ||
      meta.name ||
      meta.user_name ||
      meta.username;

    if (name && String(name).trim()) return String(name).trim();
    return user.email ? user.email.split("@")[0] : "User";
  }

  function getPermissions(currentSession = session) {
    return USER_ACCESS[getEmail(currentSession)] || UNAUTHORIZED;
  }

  function needsFirstSetup(currentSession = session) {
    const user = currentSession?.user;
    if (!user) return false;

    const meta = user.user_metadata || {};

    if (meta.onboarding_complete === true) return false;
    if (meta.onboarding_complete === false) return true;

    const existingName =
      meta.display_name ||
      meta.full_name ||
      meta.name ||
      meta.user_name ||
      meta.username;

    // Existing accounts with a real display name are treated as already set up.
    // New temporary-password accounts without a display name get setup.
    return !String(existingName || "").trim();
  }

  function prefillSetup() {
    const input = $("#setupDisplayName");
    if (!input || !session?.user) return;

    const meta = session.user.user_metadata || {};
    const name =
      meta.display_name ||
      meta.full_name ||
      meta.name ||
      meta.user_name ||
      meta.username ||
      "";

    input.value = String(name).trim();
  }

  function showView(requestedView) {
    let view = requestedView;

    if (!allowedViews.includes(view)) {
      view = allowedViews[0] || "unauthorized";
    }

    $$("[data-view]").forEach((item) => {
      item.classList.toggle("active", item.dataset.view === view);
    });

    $$(".view").forEach((page) => {
      page.classList.toggle("active", page.dataset.page === view);
    });

    if (location.hash !== `#${view}`) {
      history.replaceState(null, "", `#${view}`);
    }
  }

  function applyPermissions() {
    allowedViews = getPermissions();

    $$("[data-view]").forEach((item) => {
      const visible = allowedViews.includes(item.dataset.view);
      item.classList.toggle("permission-hidden", !visible);
    });

    $$(".nav-section").forEach((section) => {
      const hasVisibleItem = [...section.querySelectorAll("[data-view]")]
        .some((item) => !item.classList.contains("permission-hidden"));

      section.classList.toggle("permission-hidden", !hasVisibleItem);
    });

    $("#loggedInUser").textContent = getDisplayName();

    const requested = location.hash.slice(1);
    showView(allowedViews.includes(requested) ? requested : allowedViews[0]);
  }

  function reloadLeadsAfterLogin() {
    const frame = $("#leadsFrame");
    const userId = String(session?.user?.id || "");

    if (!frame || !userId || leadsLoadedForUser === userId) return;

    leadsLoadedForUser = userId;

    // Same-origin iframe shares the Supabase auth storage.
    // Reload after login so the Leads app starts with the active session.
    const baseSrc = frame.dataset.baseSrc || frame.getAttribute("src") || "leads/index.html";
    frame.dataset.baseSrc = baseSrc;

    const separator = baseSrc.includes("?") ? "&" : "?";
    frame.src = `${baseSrc}${separator}session=${Date.now()}`;
  }

  function routeSession() {
    if (!session?.user) {
      setScreen("login");
      return;
    }

    if (needsFirstSetup()) {
      prefillSetup();
      setScreen("setup");
      return;
    }

    setScreen("app");
    applyPermissions();

    if (allowedViews.includes("leads")) {
      reloadLeadsAfterLogin();
    }
  }

  function setupNavigation() {
    $$("[data-view]").forEach((item) => {
      item.addEventListener("click", (event) => {
        event.preventDefault();

        const view = item.dataset.view;
        if (allowedViews.includes(view)) {
          showView(view);
        }
      });
    });

    window.addEventListener("hashchange", () => {
      if (!session?.user) return;
      const requested = location.hash.slice(1);
      if (allowedViews.includes(requested)) {
        showView(requested);
      }
    });
  }

  function passwordProblem(password) {
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(password)) return "Password must include at least 1 capital letter.";
    if (!/[0-9]/.test(password)) return "Password must include at least 1 number.";
    if (!/[^A-Za-z0-9]/.test(password)) return "Password must include at least 1 symbol.";
    if (password.toLowerCase() === "password") return 'Choose a new password instead of the temporary password "password".';
    return "";
  }

  async function handleLogin(event) {
    event.preventDefault();

    const email = $("#authEmail").value.trim();
    const password = $("#authPassword").value;
    const status = $("#authStatus");
    const button = $("#authSignIn");

    status.textContent = "";

    if (!supabase?.auth) {
      status.textContent = "Login service is unavailable. Refresh the page and try again.";
      return;
    }

    if (!email || !password) {
      status.textContent = "Enter your email and password.";
      return;
    }

    button.disabled = true;
    button.textContent = "Signing In…";

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        status.textContent = error.message || "Sign in failed.";
        return;
      }

      if (!data?.session) {
        status.textContent = "Sign in succeeded but no session was created.";
        return;
      }

      session = data.session;
      window.supabaseSession = session;
      routeSession();
    } catch (error) {
      console.error("Login error:", error);
      status.textContent = error?.message || "Could not sign in.";
    } finally {
      button.disabled = false;
      button.textContent = "Sign In";
    }
  }

  async function handleFirstSetup(event) {
    event.preventDefault();

    const name = $("#setupDisplayName").value.trim();
    const password = $("#setupPassword").value;
    const confirm = $("#setupPasswordConfirm").value;
    const status = $("#accountSetupStatus");
    const button = $("#accountSetupButton");

    status.textContent = "";

    if (!session?.user || !supabase?.auth) {
      status.textContent = "Your login session expired. Please sign in again.";
      return;
    }

    if (name.length < 2) {
      status.textContent = "Enter a display name with at least 2 characters.";
      $("#setupDisplayName").focus();
      return;
    }

    const problem = passwordProblem(password);
    if (problem) {
      status.textContent = problem;
      $("#setupPassword").focus();
      return;
    }

    if (password !== confirm) {
      status.textContent = "The passwords do not match.";
      $("#setupPasswordConfirm").focus();
      return;
    }

    button.disabled = true;
    button.textContent = "Saving…";

    try {
      const { data, error } = await supabase.auth.updateUser({
        password,
        data: {
          ...(session.user.user_metadata || {}),
          display_name: name,
          onboarding_complete: true
        }
      });

      if (error) {
        status.textContent = error.message || "Could not finish account setup.";
        return;
      }

      if (data?.user) {
        session = {
          ...session,
          user: data.user
        };
        window.supabaseSession = session;
      }

      $("#setupPassword").value = "";
      $("#setupPasswordConfirm").value = "";
      leadsLoadedForUser = "";

      setScreen("app");
      applyPermissions();

      if (allowedViews.includes("leads")) {
        reloadLeadsAfterLogin();
      }
    } catch (error) {
      console.error("Account setup error:", error);
      status.textContent = error?.message || "Could not finish account setup.";
    } finally {
      button.disabled = false;
      button.textContent = "Create Account";
    }
  }

  async function signOut() {
    if (!supabase?.auth) return;

    await supabase.auth.signOut();

    session = null;
    window.supabaseSession = null;
    allowedViews = [];
    leadsLoadedForUser = "";

    $("#authPassword").value = "";
    $("#setupPassword").value = "";
    $("#setupPasswordConfirm").value = "";

    setScreen("login");
  }

  async function initialize() {
    setupNavigation();

    $("#authForm").addEventListener("submit", handleLogin);
    $("#accountSetupForm").addEventListener("submit", handleFirstSetup);
    $("#signOutButton").addEventListener("click", signOut);
    $("#setupSignOutButton").addEventListener("click", signOut);

    const signInButton = $("#authSignIn");
    const status = $("#authStatus");

    if (!window.supabase?.createClient) {
      signInButton.disabled = true;
      signInButton.textContent = "Login Unavailable";
      status.textContent = "Could not load Supabase. Refresh the page and try again.";
      setScreen("login");
      return;
    }

    try {
      supabase = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        }
      );

      window.supabaseClient = supabase;

      signInButton.disabled = false;
      signInButton.textContent = "Sign In";

      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Session restore error:", error);
      }

      session = data?.session || null;
      window.supabaseSession = session;
      routeSession();

      supabase.auth.onAuthStateChange((_event, nextSession) => {
        session = nextSession || null;
        window.supabaseSession = session;

        if (!session) {
          allowedViews = [];
          leadsLoadedForUser = "";
          setScreen("login");
          return;
        }

        // Do not route password-recovery URLs into the normal app.
        routeSession();
      });
    } catch (error) {
      console.error("Supabase initialization error:", error);
      signInButton.disabled = true;
      signInButton.textContent = "Login Unavailable";
      status.textContent = error?.message || "Could not initialize login.";
      setScreen("login");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
