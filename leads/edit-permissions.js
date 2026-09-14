(() => {
  let canEditLeads = false;
  const EDIT_ROLES = new Set(['ADMIN', 'MOD']);

  function sessionRoles() {
    const meta = supabaseSession?.user?.app_metadata || {};
    const values = [
      ...(Array.isArray(meta.roles) ? meta.roles : []),
      meta.role,
      meta.dashboard_role
    ];
    return new Set(values.map(value => String(value || '').trim().toUpperCase()).filter(Boolean));
  }

  function applyEditVisibility() {
    const editButton = document.getElementById('editLeadButton');
    if (editButton) editButton.hidden = !canEditLeads;

    document.querySelectorAll('[data-edit-lead-status]').forEach(button => {
      button.hidden = !canEditLeads;
    });
  }

  async function refreshEditPermission() {
    const roles = sessionRoles();
    canEditLeads = [...roles].some(role => EDIT_ROLES.has(role));

    if (!canEditLeads && supabaseSession?.user?.id) {
      try {
        const { data, error } = await supabaseClient
          .from('team_permissions')
          .select('role, active')
          .eq('user_id', supabaseSession.user.id)
          .maybeSingle();

        if (!error && data?.active !== false) {
          canEditLeads = EDIT_ROLES.has(String(data?.role || '').trim().toUpperCase());
        }
      } catch (error) {
        console.warn('Could not load lead edit permission:', error);
      }
    }

    applyEditVisibility();
  }

  function runAsLeadEditor(fn, args) {
    if (!canEditLeads || typeof fn !== 'function') return;
    const originalCheck = currentUserIsKiara;
    currentUserIsKiara = () => true;
    try {
      return fn(...args);
    } finally {
      currentUserIsKiara = originalCheck;
      applyEditVisibility();
    }
  }

  if (typeof renderCurrentLead === 'function') {
    const originalRenderCurrentLead = renderCurrentLead;
    renderCurrentLead = function (...args) {
      const result = originalRenderCurrentLead.apply(this, args);
      applyEditVisibility();
      return result;
    };
  }

  if (typeof renderLists === 'function') {
    const originalRenderLists = renderLists;
    renderLists = function (...args) {
      const result = originalRenderLists.apply(this, args);
      applyEditVisibility();
      return result;
    };
  }

  if (typeof openLeadDetailsEditor === 'function') {
    const originalOpenLeadDetailsEditor = openLeadDetailsEditor;
    openLeadDetailsEditor = function (...args) {
      return runAsLeadEditor(originalOpenLeadDetailsEditor, args);
    };
  }

  if (typeof openEditLeadModal === 'function') {
    const originalOpenEditLeadModal = openEditLeadModal;
    openEditLeadModal = function (...args) {
      return runAsLeadEditor(originalOpenEditLeadModal, args);
    };
  }

  if (typeof setLeadPipelineStatus === 'function') {
    const originalSetLeadPipelineStatus = setLeadPipelineStatus;
    setLeadPipelineStatus = function (...args) {
      return runAsLeadEditor(originalSetLeadPipelineStatus, args);
    };
  }

  const observer = new MutationObserver(applyEditVisibility);
  observer.observe(document.body, { childList: true, subtree: true });

  let attempts = 0;
  const sessionWait = setInterval(() => {
    attempts += 1;
    if (supabaseSession?.user || attempts > 100) {
      clearInterval(sessionWait);
      refreshEditPermission();
    }
  }, 100);

  window.addEventListener('message', event => {
    if (event.data?.type === 'STEADY_HANDS_SUPABASE_SESSION') {
      setTimeout(refreshEditPermission, 150);
      setTimeout(refreshEditPermission, 500);
    }
  });

  applyEditVisibility();
})();
