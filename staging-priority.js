(() => {
  const listEl = document.getElementById('stagingList');
  const searchEl = document.getElementById('stagingSearch');
  const statusEl = document.getElementById('status');
  const toggle = document.getElementById('showAllCrmLeads');
  if (!listEl || !searchEl || !toggle || !window.SitePipeline) return;

  const CATEGORIES = [
    [1,'General contractors / construction','Very high'],[2,'Roofers','Very high'],[3,'HVAC companies','Very high'],[4,'Plumbers','Very high'],[5,'Electricians','Very high'],
    [6,'Remodeling / renovation contractors','Very high'],[7,'Landscaping / lawn-care companies','Very high'],[8,'Handyman services','Very high'],[9,'Concrete / masonry contractors','Very high'],[10,'Painters','Very high'],
    [11,'Tree-removal services','Very high'],[12,'Flooring installers','Very high'],[13,'Fencing companies','Very high'],[14,'Junk removal / hauling','Very high'],[15,'Pest-control companies','Very high'],
    [16,'Cleaning companies','High'],[17,'Auto-detailing businesses','High'],[18,'Mobile mechanics','High'],[19,'Auto-repair shops / mechanics','High'],[20,'Auto-body / collision shops','High'],
    [21,'Towing companies','High'],[22,'Garage-door services','High'],[23,'Pressure-washing businesses','High'],[24,'Pool installation / maintenance','High'],[25,'Moving companies','High'],
    [26,'Event planners','High'],[27,'Wedding vendors','High'],[28,'Caterers','High'],[29,'Photographers / videographers','High'],[30,'Nail salons','Medium-high'],
    [31,'Hair salons / barbershops','Medium-high'],[32,'Med spas / estheticians','Medium-high'],[33,'Massage therapists','Medium-high'],[34,'Personal trainers / independent gyms','Medium-high'],[35,'Pet groomers','Medium-high'],
    [36,'Daycares / preschools','Medium-high'],[37,'Tire shops','Medium'],[38,'Restaurants','Medium'],[39,'Food trucks','Medium'],[40,'Bakeries','Medium'],
    [41,'Independent retailers / boutiques','Medium'],[42,'Tattoo shops','Medium'],[43,'Appliance-repair services','Medium'],[44,'Locksmiths','Medium'],[45,'Car dealerships / used-car lots','Medium'],
    [46,'Convenience stores','Low'],[47,'Liquor stores','Low'],[48,'Laundromats','Low'],[49,'Smoke / vape shops','Low'],[50,'Gas stations','Very low']
  ].map(([rank,category,potential])=>({rank,category,potential}));

  const exact = new Map(CATEGORIES.map(item => [item.category.toLowerCase(), item]));
  const byRank = rank => CATEGORIES.find(item => item.rank === Number(rank)) || null;
  const rules = [
    [2,/roof|roofing/],[3,/hvac|heating|air conditioning|air-conditioning|a\/c|ac repair/],[4,/plumb|drain|sewer/],[5,/electric|electrical/],[6,/remodel|renovat|home improvement/],
    [7,/landscap|lawn|yard care|lawn care/],[8,/handyman|handy man/],[9,/concrete|masonry|mason|paver/],[10,/paint|painting/],[11,/tree service|tree removal|arborist|stump/],
    [12,/floor|flooring|tile install/],[13,/fenc|fencing/],[14,/junk|hauling|haul away|debris removal/],[15,/pest|exterminat|termite/],
    [17,/detail|detailing|car wash|auto spa/],[16,/cleaning|cleaners|maid|janitorial|housekeeping/],[18,/mobile mechanic/],[20,/collision|auto body|body shop/],[19,/auto repair|mechanic|automotive repair/],[21,/tow|towing|roadside/],
    [22,/garage door/],[23,/pressure wash|power wash/],[24,/pool|spa service/],[25,/moving|movers|relocation/],[26,/event plan|party plan|event coordinat/],
    [27,/wedding|bridal/],[28,/cater|catering/],[29,/photo|photograph|video|videograph/],[30,/nail|manicure|pedicure/],[31,/hair|salon|barber|beauty shop/],
    [32,/med spa|medspa|esthetic|aesthetic|facial|skin care/],[33,/massage|massage therapy/],[34,/personal train|gym|fitness|workout/],[35,/pet groom|dog groom|grooming/],[36,/daycare|day care|preschool|child care|childcare/],
    [37,/tire|tyre/],[39,/food truck/],[40,/bakery|baker|cakes|cupcake/],[42,/tattoo|piercing/],[43,/appliance repair|washer repair|dryer repair|refrigerator repair/],
    [44,/locksmith|lock and key/],[45,/car dealer|auto dealer|used cars|used car|motors\b/],[46,/convenience|mini mart|market & deli/],[47,/liquor|wine & spirits|package store/],[48,/laundromat|laundry|washateria/],
    [49,/smoke shop|vape|tobacco|hookah/],[50,/gas station|fuel station|service station/],[38,/restaurant|grill|cafe|café|diner|eatery|kitchen|pizza|tacos|sushi|bbq|barbecue/],
    [41,/boutique|retail|shop|store|clothing|apparel|jewelry|gift shop|liquidation|outlet|wholesale/],[1,/general contractor|construction|contracting|builder|builders/]
  ];

  let crmRows = [];
  let siteRows = [];
  let previewByLead = new Map();
  let siteFolderMap = new Map();
  let ready = false;

  const escapeHTML = value => SitePipeline.escapeHTML(String(value ?? ''));

  function normalizeSiteFolder(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-');
  }

  function addSiteFolders(items) {
    for (const item of Array.isArray(items) ? items : []) {
      const name = typeof item === 'string' ? item : item?.name;
      if (!name) continue;
      if (typeof item === 'object' && item?.type && item.type !== 'dir') continue;
      const key = normalizeSiteFolder(name);
      if (key) siteFolderMap.set(key, name);
    }
  }

  async function loadSiteFolders() {
    siteFolderMap = new Map();

    // Fast local fallback. This may lag behind the site repository, so the
    // live GitHub directory listing below is allowed to add/replace entries.
    try {
      const response = await fetch(`site-folders.json?v=${Date.now()}`, { cache: 'no-store' });
      if (response.ok) addSiteFolders(await response.json());
    } catch (_) {}

    // The source of truth for preview existence is the actual Sites directory.
    // This fixes newly-added previews that have not yet been written into the
    // Supabase sites table or local manifest.
    try {
      const response = await fetch('https://api.github.com/repos/Merci-Chi/viewyoursite/contents/Sites', {
        cache: 'no-store',
        headers: { Accept: 'application/vnd.github+json' }
      });
      if (response.ok) addSiteFolders(await response.json());
    } catch (error) {
      console.warn('Could not refresh ViewYourSite folder list:', error);
    }
  }

  function previewUrl(...values) {
    for (const value of values) {
      const raw = String(value || '').trim();
      if (!raw) continue;
      try {
        const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
        const host = url.hostname.toLowerCase().replace(/^www\./,'');
        if (host === 'viewyoursite.today' || host.endsWith('.viewyoursite.today')) return url.href;
      } catch (_) {}
    }
    return '';
  }

  function siteFolderForLead(lead) {
    const candidates = [lead?.company, lead?.name].map(normalizeSiteFolder).filter(Boolean);

    // Exact company/folder match first.
    for (const key of candidates) {
      if (siteFolderMap.has(key)) return siteFolderMap.get(key);
    }

    // Then allow a conservative containment match for folders that omit a
    // suffix such as LLC, Service, Company, etc.
    for (const key of candidates) {
      if (key.length < 8) continue;
      for (const [folderKey, folderName] of siteFolderMap.entries()) {
        if (folderKey.length < 8) continue;
        if (key.includes(folderKey) || folderKey.includes(key)) return folderName;
      }
    }

    return '';
  }

  function classification(lead) {
    const text = [lead.leadtype,lead.company,lead.name,lead.issue,lead.notes,lead.concerns].filter(Boolean).join(' ').toLowerCase().replace(/[_-]+/g,' ');

    // Strong explicit business-name signals should beat a stale stored rank.
    // This is especially important for names like "Auto Detailing & Pressure Cleaning".
    for (const [rank,pattern] of rules) {
      if (pattern.test(text)) return byRank(rank);
    }

    const stored = byRank(lead.businessrank);
    if (stored) return stored;
    const rawType = String(lead.leadtype || '').trim();
    const direct = exact.get(rawType.toLowerCase());
    if (direct) return direct;
    return {rank:999,category:rawType && !/^(no site|outdated site|broken site|site removed)$/i.test(rawType) ? rawType : 'Other / closest match pending',potential:'Unranked'};
  }

  function leadPreview(lead) {
    const explicit = previewUrl(lead.previewurl, lead.website, previewByLead.get(String(lead.id)));
    if (explicit) return explicit;
    const folder = siteFolderForLead(lead);
    return folder ? `https://viewyoursite.today/Sites/${encodeURIComponent(folder)}/` : '';
  }

  function sortedRows() {
    const q = String(searchEl.value || '').trim().toLowerCase();
    return crmRows
      .filter(lead => toggle.checked || !leadPreview(lead))
      .filter(lead => !q || [lead.company,lead.name,lead.phone,lead.email,lead.leadtype,classification(lead).category].some(value => String(value || '').toLowerCase().includes(q)))
      .slice()
      .sort((a,b) => classification(a).rank - classification(b).rank || String(a.company || a.name || '').localeCompare(String(b.company || b.name || '')));
  }

  function render() {
    if (!ready) return;
    const rows = sortedRows();
    const needsCount = rows.filter(lead => !leadPreview(lead)).length;
    if (statusEl) statusEl.textContent = toggle.checked
      ? `${rows.length} CRM lead${rows.length===1?'':'s'} · ${needsCount} need a site`
      : `${rows.length} lead${rows.length===1?'':'s'} need a site`;

    listEl.innerHTML = rows.map(lead => {
      const info = classification(lead);
      const preview = leadPreview(lead);
      const actionAttr = preview ? `data-existing-preview="${escapeHTML(preview)}"` : `data-lead="${escapeHTML(lead.id)}"`;
      const tag = preview
        ? '<span class="site-ready-tag"><i class="bi bi-check2-circle"></i> Has Site</span>'
        : '<span class="needs-site">Needs Site</span>';
      return `<button class="card staging-lead" ${actionAttr} type="button" title="${escapeHTML(info.category)} · ${escapeHTML(info.potential)}">
        <span class="staging-lead-icon"><i class="bi bi-buildings"></i></span>
        <span><strong>${escapeHTML(lead.company || 'Unnamed business')}</strong><span>${escapeHTML(lead.name || 'No contact')} · ${escapeHTML(lead.phone || 'No phone')}</span><small class="business-priority">#${info.rank < 999 ? info.rank : '—'} · ${escapeHTML(info.category)} · ${escapeHTML(info.potential)}</small></span>
        ${tag}
      </button>`;
    }).join('') || '<div class="empty"><div><i class="bi bi-check2-circle"></i><strong>No CRM leads match this view.</strong></div></div>';
  }

  async function refresh() {
    try {
      const db = await SitePipeline.init();
      const [crm,sites] = await Promise.all([
        db.from('crm').select('*'),
        SitePipeline.list(),
        loadSiteFolders()
      ]);
      if (crm.error) throw crm.error;
      crmRows = crm.data || [];
      siteRows = sites || [];
      previewByLead = new Map();
      for (const site of siteRows) {
        const preview = previewUrl(site.previewurl, site.liveurl);
        const leadId = site.lead_id || site.crmid;
        if (preview && leadId && !previewByLead.has(String(leadId))) previewByLead.set(String(leadId), preview);
      }
      ready = true;
      render();
    } catch (error) {
      console.warn('Could not load ranked CRM staging list:', error);
    }
  }

  toggle.addEventListener('change', render);
  searchEl.addEventListener('input', () => setTimeout(render, 0));
  listEl.addEventListener('click', event => {
    const previewButton = event.target.closest('[data-existing-preview]');
    if (!previewButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.open(previewButton.dataset.existingPreview, '_blank', 'noopener');
  }, true);

  const observer = new MutationObserver(() => {
    if (ready && !listEl.querySelector('.business-priority')) render();
  });
  observer.observe(listEl, {childList:true});

  refresh();
})();