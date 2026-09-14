(() => {
  let canEditLeads = false;
  const EDIT_ROLES = new Set(['ADMIN', 'MOD']);

  const BUSINESS_CATEGORIES = [
    [1, 'General contractors / construction', 'Very high'],
    [2, 'Roofers', 'Very high'],
    [3, 'HVAC companies', 'Very high'],
    [4, 'Plumbers', 'Very high'],
    [5, 'Electricians', 'Very high'],
    [6, 'Remodeling / renovation contractors', 'Very high'],
    [7, 'Landscaping / lawn-care companies', 'Very high'],
    [8, 'Handyman services', 'Very high'],
    [9, 'Concrete / masonry contractors', 'Very high'],
    [10, 'Painters', 'Very high'],
    [11, 'Tree-removal services', 'Very high'],
    [12, 'Flooring installers', 'Very high'],
    [13, 'Fencing companies', 'Very high'],
    [14, 'Junk removal / hauling', 'Very high'],
    [15, 'Pest-control companies', 'Very high'],
    [16, 'Cleaning companies', 'High'],
    [17, 'Auto-detailing businesses', 'High'],
    [18, 'Mobile mechanics', 'High'],
    [19, 'Auto-repair shops / mechanics', 'High'],
    [20, 'Auto-body / collision shops', 'High'],
    [21, 'Towing companies', 'High'],
    [22, 'Garage-door services', 'High'],
    [23, 'Pressure-washing businesses', 'High'],
    [24, 'Pool installation / maintenance', 'High'],
    [25, 'Moving companies', 'High'],
    [26, 'Event planners', 'High'],
    [27, 'Wedding vendors', 'High'],
    [28, 'Caterers', 'High'],
    [29, 'Photographers / videographers', 'High'],
    [30, 'Nail salons', 'Medium-high'],
    [31, 'Hair salons / barbershops', 'Medium-high'],
    [32, 'Med spas / estheticians', 'Medium-high'],
    [33, 'Massage therapists', 'Medium-high'],
    [34, 'Personal trainers / independent gyms', 'Medium-high'],
    [35, 'Pet groomers', 'Medium-high'],
    [36, 'Daycares / preschools', 'Medium-high'],
    [37, 'Tire shops', 'Medium'],
    [38, 'Restaurants', 'Medium'],
    [39, 'Food trucks', 'Medium'],
    [40, 'Bakeries', 'Medium'],
    [41, 'Independent retailers / boutiques', 'Medium'],
    [42, 'Tattoo shops', 'Medium'],
    [43, 'Appliance-repair services', 'Medium'],
    [44, 'Locksmiths', 'Medium'],
    [45, 'Car dealerships / used-car lots', 'Medium'],
    [46, 'Convenience stores', 'Low'],
    [47, 'Liquor stores', 'Low'],
    [48, 'Laundromats', 'Low'],
    [49, 'Smoke / vape shops', 'Low'],
    [50, 'Gas stations', 'Very low']
  ].map(([rank, category, potential]) => ({ rank, category, potential }));

  const CATEGORY_BY_NAME = new Map(BUSINESS_CATEGORIES.map(item => [item.category.toLowerCase(), item]));
  const SITE_STATUS_TYPES = new Set(['outdated site', 'no site', 'broken site', 'site removed']);
  const CATEGORY_RULES = [
    [2, /roof|roofing/], [3, /hvac|heating|air conditioning|air-conditioning|a\/c|ac repair/],
    [4, /plumb|drain|sewer/], [5, /electric|electrical/], [6, /remodel|renovat|home improvement/],
    [7, /landscap|lawn|yard care|lawn care/], [8, /handyman|handy man/], [9, /concrete|masonry|mason|paver/],
    [10, /paint|painting/], [11, /tree service|tree removal|arborist|stump/], [12, /floor|flooring|tile install/],
    [13, /fenc|fencing/], [14, /junk|hauling|haul away|debris removal/], [15, /pest|exterminat|termite/],
    [16, /cleaning|cleaners|maid|janitorial|housekeeping/], [17, /detail|detailing|car wash|auto spa/],
    [18, /mobile mechanic/], [20, /collision|auto body|body shop/], [19, /auto repair|mechanic|automotive repair/],
    [21, /tow|towing|roadside/], [22, /garage door/], [23, /pressure wash|power wash/],
    [24, /pool|spa service/], [25, /moving|movers|relocation/], [26, /event plan|party plan|event coordinat/],
    [27, /wedding|bridal/], [28, /cater|catering/], [29, /photo|photograph|video|videograph/],
    [30, /nail|manicure|pedicure/], [31, /hair|salon|barber|beauty shop/], [32, /med spa|medspa|esthetic|aesthetic|facial|skin care/],
    [33, /massage|massage therapy/], [34, /personal train|gym|fitness|workout/], [35, /pet groom|dog groom|grooming/],
    [36, /daycare|day care|preschool|child care|childcare/], [37, /tire|tyre/], [39, /food truck/],
    [40, /bakery|baker|cakes|cupcake/], [42, /tattoo|piercing/], [43, /appliance repair|washer repair|dryer repair|refrigerator repair/],
    [44, /locksmith|lock and key/], [45, /car dealer|auto dealer|used cars|used car|motors\b/], [46, /convenience|mini mart|market & deli/],
    [47, /liquor|wine & spirits|package store/], [48, /laundromat|laundry|washateria/], [49, /smoke shop|vape|tobacco|hookah/],
    [50, /gas station|fuel station|service station/], [38, /restaurant|grill|cafe|café|diner|eatery|kitchen|pizza|tacos|sushi|bbq|barbecue/],
    [41, /boutique|retail|shop|store|clothing|apparel|jewelry|gift shop/], [1, /general contractor|construction|contracting|builder|builders/]
  ];

  function categoryByRank(rank) {
    return BUSINESS_CATEGORIES.find(item => item.rank === Number(rank)) || null;
  }

  function normalizeBusinessCategory(value) {
    const raw = String(value || '').trim();
    if (!raw || SITE_STATUS_TYPES.has(raw.toLowerCase())) return '';
    const exact = CATEGORY_BY_NAME.get(raw.toLowerCase());
    if (exact) return exact.category;
    const lower = raw.toLowerCase();
    const partial = BUSINESS_CATEGORIES.find(item => item.category.toLowerCase().includes(lower) || lower.includes(item.category.toLowerCase()));
    return partial?.category || '';
  }

  function classifyBusinessText(value) {
    const text = String(value || '').toLowerCase().replace(/[_-]+/g, ' ').trim();
    if (!text) return null;
    const exact = normalizeBusinessCategory(text);
    if (exact) return CATEGORY_BY_NAME.get(exact.toLowerCase()) || null;
    for (const [rank, pattern] of CATEGORY_RULES) {
      if (pattern.test(text)) return categoryByRank(rank);
    }
    return null;
  }

  function businessClassification(lead = {}) {
    const explicit = normalizeBusinessCategory(lead.leadType || lead.businessCategory || lead.category);
    if (explicit) return CATEGORY_BY_NAME.get(explicit.toLowerCase());
    const stored = categoryByRank(lead.businessRank);
    if (stored) return stored;
    const haystack = [lead.company, lead.name, lead.issue, lead.notes, lead.concerns].filter(Boolean).join(' ');
    return classifyBusinessText(haystack) || { rank: 999, category: '', potential: 'Unranked' };
  }

  function applyBusinessClassification(lead) {
    if (!lead) return lead;
    const info = businessClassification(lead);
    if (info.rank < 999) {
      lead.leadType = info.category;
      lead.businessRank = info.rank;
      lead.leadPotential = info.potential;
    } else {
      lead.businessRank = Number(lead.businessRank) || 999;
      lead.leadPotential = lead.leadPotential || 'Unranked';
    }
    return lead;
  }

  window.STEADY_HANDS_BUSINESS_CATEGORIES = BUSINESS_CATEGORIES;
  window.steadyHandsClassifyBusiness = businessClassification;

  if (typeof leadToSupabaseRow === 'function') {
    const originalLeadToSupabaseRow = leadToSupabaseRow;
    leadToSupabaseRow = function (lead) {
      applyBusinessClassification(lead);
      const row = originalLeadToSupabaseRow(lead);
      row.businessrank = lead.businessRank < 999 ? lead.businessRank : null;
      row.leadpotential = lead.businessRank < 999 ? lead.leadPotential : null;
      row.leadtype = lead.businessRank < 999 ? lead.leadType : row.leadtype;
      return row;
    };
  }

  if (typeof supabaseRowToLead === 'function') {
    const originalSupabaseRowToLead = supabaseRowToLead;
    supabaseRowToLead = function (...args) {
      return applyBusinessClassification(originalSupabaseRowToLead.apply(this, args));
    };
  }

  function ensureCategoryDropdown() {
    const field = document.getElementById('newLeadType');
    if (!field || field.dataset.businessCategoryDropdown === 'true') return field;

    const select = document.createElement('select');
    [...field.attributes].forEach(attribute => {
      if (!['type', 'placeholder'].includes(attribute.name)) select.setAttribute(attribute.name, attribute.value);
    });
    select.id = 'newLeadType';
    select.dataset.businessCategoryDropdown = 'true';
    select.setAttribute('aria-label', 'Business category');
    select.innerHTML = `<option value="">Select business category</option>${BUSINESS_CATEGORIES.map(item => `<option value="${item.category}">${item.rank}. ${item.category} — ${item.potential}</option>`).join('')}`;

    const current = normalizeBusinessCategory(field.value);
    if (current) select.value = current;
    field.replaceWith(select);
    return select;
  }

  function syncCategoryDropdownToLead() {
    const field = ensureCategoryDropdown();
    if (!field) return;
    let lead = null;
    try {
      if (typeof currentLead === 'function') lead = currentLead();
      if (!lead && typeof currentLeadId !== 'undefined' && typeof state !== 'undefined') {
        lead = state.leads.find(item => item.id === currentLeadId) || null;
      }
    } catch (_) {}
    if (!lead) return;
    const info = businessClassification(lead);
    field.value = info.rank < 999 ? info.category : '';
  }

  function rankForLeadId(id) {
    try {
      if (typeof state === 'undefined' || !Array.isArray(state.leads)) return 999;
      const lead = state.leads.find(item => String(item.id) === String(id));
      if (!lead) return 999;
      return businessClassification(lead).rank;
    } catch (_) {
      return 999;
    }
  }

  function companyForLeadId(id) {
    try {
      if (typeof state === 'undefined' || !Array.isArray(state.leads)) return '';
      const lead = state.leads.find(item => String(item.id) === String(id));
      return String(lead?.company || lead?.name || '');
    } catch (_) {
      return '';
    }
  }

  function enforceRankedDomOrder() {
    ['newLeadList', 'followLeadList', 'soldLeadList'].forEach(listId => {
      const list = document.getElementById(listId);
      if (!list) return;
      const cards = [...list.children].filter(node => node.querySelector?.('[data-open-lead]'));
      const sorted = cards.slice().sort((a, b) => {
        const aId = a.querySelector('[data-open-lead]')?.dataset.openLead;
        const bId = b.querySelector('[data-open-lead]')?.dataset.openLead;
        return rankForLeadId(aId) - rankForLeadId(bId) || companyForLeadId(aId).localeCompare(companyForLeadId(bId));
      });
      const changed = sorted.some((card, index) => card !== cards[index]);
      if (changed) sorted.forEach(card => list.appendChild(card));
    });
  }

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
    ensureCategoryDropdown();
  }

  async function refreshEditPermission() {
    const roles = sessionRoles();
    canEditLeads = [...roles].some(role => EDIT_ROLES.has(role));
    if (!canEditLeads && supabaseSession?.user?.id) {
      try {
        const { data, error } = await supabaseClient.from('team_permissions').select('role, active').eq('user_id', supabaseSession.user.id).maybeSingle();
        if (!error && data?.active !== false) canEditLeads = EDIT_ROLES.has(String(data?.role || '').trim().toUpperCase());
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
      try {
        if (typeof state !== 'undefined' && Array.isArray(state.leads)) state.leads.forEach(applyBusinessClassification);
      } catch (_) {}
      const result = originalRenderLists.apply(this, args);
      applyEditVisibility();
      enforceRankedDomOrder();
      return result;
    };
  }

  if (typeof openLeadDetailsEditor === 'function') {
    const originalOpenLeadDetailsEditor = openLeadDetailsEditor;
    openLeadDetailsEditor = function (...args) {
      const result = runAsLeadEditor(originalOpenLeadDetailsEditor, args);
      setTimeout(syncCategoryDropdownToLead, 0);
      return result;
    };
  }

  if (typeof openEditLeadModal === 'function') {
    const originalOpenEditLeadModal = openEditLeadModal;
    openEditLeadModal = function (...args) {
      const result = runAsLeadEditor(originalOpenEditLeadModal, args);
      setTimeout(syncCategoryDropdownToLead, 0);
      return result;
    };
  }

  if (typeof setLeadPipelineStatus === 'function') {
    const originalSetLeadPipelineStatus = setLeadPipelineStatus;
    setLeadPipelineStatus = function (...args) {
      return runAsLeadEditor(originalSetLeadPipelineStatus, args);
    };
  }

  const observer = new MutationObserver(() => {
    applyEditVisibility();
    requestAnimationFrame(enforceRankedDomOrder);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  let attempts = 0;
  const sessionWait = setInterval(() => {
    attempts += 1;
    if (supabaseSession?.user || attempts > 100) {
      clearInterval(sessionWait);
      refreshEditPermission();
      try {
        if (typeof state !== 'undefined' && Array.isArray(state.leads)) state.leads.forEach(applyBusinessClassification);
      } catch (_) {}
      enforceRankedDomOrder();
    }
  }, 100);

  window.addEventListener('message', event => {
    if (event.data?.type === 'STEADY_HANDS_SUPABASE_SESSION') {
      setTimeout(refreshEditPermission, 150);
      setTimeout(refreshEditPermission, 500);
      setTimeout(enforceRankedDomOrder, 600);
    }
  });

  ensureCategoryDropdown();
  applyEditVisibility();
})();
