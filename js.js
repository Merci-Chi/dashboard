(() => {
  "use strict";

  const SUPABASE_URL = "https://glonbvrcudwuzjundrii.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_VZbed_uuOXSE744UrAfHXw_z2xDdYtr";
  const PASSWORD_RECOVERY_REDIRECT = "https://merci-chi.github.io/dashboard/";

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
    "demo@steadyhandsop.com": LEADS,
    "nayelli@steadyhandsop.com": LEADS,
    "iamnottaiii@gmail.com": LEADS,
    "notai@steadyhandsop.com": LEADS,
  };

  let supabase = null;
  let session = null;
  let allowedViews = [];
  let leadsLoadedForUser = "";
  let passwordRecoveryMode = false;

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

  function configureSetupScreen() {
    $("#accountSetupTitle").textContent = passwordRecoveryMode ? "Reset Your Password" : "Finish Your Account";
    $("#accountSetupDescription").textContent = passwordRecoveryMode
      ? "Choose a new password for your ViewYourSite account."
      : "Create the name shown inside the app and replace your temporary password.";
    $("#accountSetupButton").textContent = passwordRecoveryMode ? "Save New Password" : "Create Account";
    $("#setupSignOutButton").textContent = passwordRecoveryMode ? "Cancel password reset" : "Sign in with a different account";
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

    if (passwordRecoveryMode || needsFirstSetup()) {
      prefillSetup();
      configureSetupScreen();
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

  async function handleForgotPassword() {
    const email = $("#authEmail").value.trim().toLowerCase();
    const status = $("#authStatus");
    const button = $("#forgotPasswordButton");

    if (!supabase?.auth) {
      status.textContent = "Login service is unavailable. Refresh the page and try again.";
      return;
    }

    if (!email) {
      status.textContent = "Enter your email address first.";
      $("#authEmail").focus();
      return;
    }

    button.disabled = true;
    status.textContent = "Sending password reset email…";

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: PASSWORD_RECOVERY_REDIRECT
      });

      status.textContent = error
        ? (error.message || "Could not send the reset email.")
        : "Check your email for the ViewYourSite password reset link.";
    } catch (error) {
      console.error("Password reset error:", error);
      status.textContent = error?.message || "Could not send the reset email.";
    } finally {
      button.disabled = false;
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
      passwordRecoveryMode = false;

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
      configureSetupScreen();
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
    passwordRecoveryMode =
      new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery" ||
      new URLSearchParams(window.location.search).get("type") === "recovery";

    $("#authForm").addEventListener("submit", handleLogin);
    $("#forgotPasswordButton").addEventListener("click", handleForgotPassword);
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

      supabase.auth.onAuthStateChange((event, nextSession) => {
        if (event === "PASSWORD_RECOVERY") {
          passwordRecoveryMode = true;
        }
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


// Mobile sidebar drawer + mobile gesture lock
(() => {
  const shell = document.getElementById("appShell");
  const menuButton = document.getElementById("mobileMenuButton");
  const closeButton = document.getElementById("sidebarCloseButton");
  const backdrop = document.getElementById("sidebarBackdrop");
  const sidebar = document.getElementById("appSidebar");

  if (!shell || !menuButton || !sidebar) return;

  const isMobile = () => window.matchMedia("(max-width: 760px)").matches;

  const openSidebar = () => {
    if (!isMobile()) return;
    shell.classList.add("sidebar-open");
    menuButton.setAttribute("aria-expanded", "true");
    if (backdrop) backdrop.hidden = false;
  };

  const closeSidebar = () => {
    shell.classList.remove("sidebar-open");
    menuButton.setAttribute("aria-expanded", "false");
    if (backdrop) backdrop.hidden = true;
  };

  menuButton.addEventListener("click", openSidebar);
  closeButton?.addEventListener("click", closeSidebar);
  backdrop?.addEventListener("click", closeSidebar);

  sidebar.addEventListener("click", (event) => {
    if (isMobile() && event.target.closest(".nav-item")) {
      closeSidebar();
    }
  });

  window.addEventListener("resize", () => {
    if (!isMobile()) closeSidebar();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSidebar();
  });

  // Block browser pinch gestures where supported (iOS Safari).
  ["gesturestart", "gesturechange", "gestureend"].forEach((eventName) => {
    document.addEventListener(eventName, (event) => event.preventDefault(), { passive: false });
  });

  // Block multi-touch pinch zoom.
  document.addEventListener("touchmove", (event) => {
    if (event.touches && event.touches.length > 1) {
      event.preventDefault();
    }
  }, { passive: false });

  // Prevent double-tap zoom without interfering with normal taps.
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
})();


// Fixed mobile app header controls
(() => {
  const shell = document.getElementById("appShell");
  const header = document.getElementById("mobileAppHeader");
  const refreshButton = document.getElementById("mobileRefreshButton");
  const topButton = document.getElementById("mobileTopButton");
  const content = document.getElementById("content");
  const leadsFrame = document.getElementById("leadsFrame");

  if (!shell || !header) return;

  const isMobile = () => window.matchMedia("(max-width: 760px)").matches;

  const getActiveView = () =>
    document.querySelector(".view.active");

  const scrollParentToTop = (smooth = true) => {
    if (!content) return;
    content.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
  };

  const scrollIframeToTop = (smooth = true) => {
    if (!leadsFrame) return false;
    try {
      const win = leadsFrame.contentWindow;
      const doc = leadsFrame.contentDocument;
      if (!win || !doc) return false;

      // Covers normal document scrolling and apps with a dedicated scroll container.
      const candidates = [
        doc.scrollingElement,
        doc.documentElement,
        doc.body,
        doc.querySelector(".content"),
        doc.querySelector(".lead-board"),
        doc.querySelector(".app"),
        doc.querySelector("main")
      ].filter(Boolean);

      let handled = false;
      for (const el of candidates) {
        if (typeof el.scrollTo === "function" && el.scrollTop > 0) {
          el.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
          handled = true;
        }
      }

      if (!handled && typeof win.scrollTo === "function") {
        win.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
        handled = true;
      }
      return handled;
    } catch (_) {
      return false;
    }
  };

  const activeViewIsLeads = () =>
    getActiveView()?.id === "view-leads";

  refreshButton?.addEventListener("click", () => {
    if (activeViewIsLeads() && leadsFrame) {
      try {
        leadsFrame.contentWindow.location.reload();
        return;
      } catch (_) {}
    }
    window.location.reload();
  });

  topButton?.addEventListener("click", () => {
    if (activeViewIsLeads()) {
      scrollIframeToTop(true);
    }
    scrollParentToTop(true);
  });

  const syncTopButton = () => {
    if (!topButton || !isMobile()) return;
    let isScrolled = (content?.scrollTop || 0) > 80;

    if (activeViewIsLeads() && leadsFrame) {
      try {
        const doc = leadsFrame.contentDocument;
        const scrollTop = Math.max(
          doc?.scrollingElement?.scrollTop || 0,
          doc?.documentElement?.scrollTop || 0,
          doc?.body?.scrollTop || 0
        );
        isScrolled = isScrolled || scrollTop > 80;
      } catch (_) {}
    }

    topButton.classList.toggle("is-active", isScrolled);
  };

  content?.addEventListener("scroll", syncTopButton, { passive: true });

  leadsFrame?.addEventListener("load", () => {
    try {
      const doc = leadsFrame.contentDocument;
      doc?.addEventListener("scroll", syncTopButton, { passive: true, capture: true });
      leadsFrame.contentWindow?.addEventListener("scroll", syncTopButton, { passive: true });
    } catch (_) {}
    syncTopButton();
  });

  const syncHeaderVisibility = () => {
    const shouldShow = isMobile() && !shell.hidden;
    header.hidden = !shouldShow;
  };

  syncHeaderVisibility();
  window.addEventListener("resize", syncHeaderVisibility);

  const shellObserver = new MutationObserver(syncHeaderVisibility);
  shellObserver.observe(shell, { attributes: true, attributeFilter: ["hidden"] });

  syncTopButton();
})();
