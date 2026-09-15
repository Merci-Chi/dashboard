(() => {
  'use strict';

  const CARD_RENDER_LIMIT = 40;
  const RENDER_DEBOUNCE_MS = 120;

  let renderTimer = null;

  function limitedRenderLists() {
    const query = ($('#leadSearch').value || '').trim().toLowerCase();
    const kiara = currentUserIsKiara();
    const canSeeLead = lead => kiara || !leadHasTag(lead, 'Hot Lead');
    const matchesSiteFilter = lead => siteFilterMode === 'has-site' ? hasViewYourSitePreview(lead) : !hasViewYourSitePreview(lead);
    const matches = lead => canSeeLead(lead) && matchesSiteFilter(lead) && (!query || [lead.name, lead.company, lead.phone, lead.email, lead.tag, getLeadType(lead), hasPossibleSpanishTag(lead) ? 'Spanish?' : '', ...(Array.isArray(lead.sourceTags) ? lead.sourceTags : [])].some(v => String(v || '').toLowerCase().includes(query)));
    const sortPriority = (a, b, fallback) => {
      const priorityDiff = leadPriority(b) - leadPriority(a);
      return priorityDiff || fallback(a, b);
    };

    const fresh = state.leads
      .filter(l => leadDirectoryCategory(l) === 'uncalled' && matches(l))
      .slice()
      .sort((a, b) => (a.businessRank || 999) - (b.businessRank || 999)
        || String(a.company || a.name || '').localeCompare(String(b.company || b.name || '')));

    const follow = state.leads
      .filter(l => leadDirectoryCategory(l) === 'followup' && matches(l))
      .slice()
      .sort((a,b) => sortPriority(a, b, (x, y) => new Date(y.lastCalled || 0) - new Date(x.lastCalled || 0)));

    const sold = state.leads
      .filter(l => leadDirectoryCategory(l) === 'notinterested' && matches(l))
      .slice()
      .sort((a,b) => sortPriority(a, b, (x, y) => new Date(y.soldAt || y.updatedAt || y.lastCalled || 0) - new Date(x.soldAt || x.updatedAt || x.lastCalled || 0)));

    const renderLimited = (containerSelector, rows, emptyText, emptyClass = 'empty-state') => {
      const container = $(containerSelector);
      if (!container) return;
      if (!rows.length) {
        container.innerHTML = `<div class="${emptyClass}">${emptyText}</div>`;
        return;
      }

      const visibleRows = rows.slice(0, CARD_RENDER_LIMIT);
      const remaining = rows.length - visibleRows.length;
      const notice = remaining > 0
        ? `<div class="empty-state lead-render-limit-note">Showing ${visibleRows.length} of ${rows.length}. Use search to narrow the list.</div>`
        : '';
      container.innerHTML = visibleRows.map(leadCard).join('') + notice;
    };

    renderLimited('#newLeadList', fresh, 'No CRM prospects found.');
    renderLimited('#followLeadList', follow, 'No follow-ups yet.');
    renderLimited('#soldLeadList', sold, 'No not-interested leads.', 'empty-state sold-empty-state');

    const visibleLeads = state.leads.filter(l => canSeeLead(l) && matchesSiteFilter(l));
    const newCount = visibleLeads.filter(l => leadDirectoryCategory(l) === 'uncalled').length;
    const followCount = visibleLeads.filter(l => leadDirectoryCategory(l) === 'followup').length;
    const soldCount = visibleLeads.filter(l => leadDirectoryCategory(l) === 'notinterested').length;

    $('#newCount').textContent = newCount;
    $('#followCount').textContent = followCount;
    $('#soldCount').textContent = soldCount;
    $('#newCountChip').textContent = newCount;
    $('#followCountChip').textContent = followCount;
    $('#soldCountChip').textContent = soldCount;

    const selectedPipeline = document.querySelector('[data-pipeline-view].active')?.dataset.pipelineView || 'leads';
    const screen = document.getElementById('leadsScreen');
    if (screen) {
      screen.classList.remove('desktop-leads-view', 'desktop-followups-view', 'desktop-sold-view');
      screen.classList.add(
        selectedPipeline === 'followups'
          ? 'desktop-followups-view'
          : selectedPipeline === 'sold'
            ? 'desktop-sold-view'
            : 'desktop-leads-view'
      );
    }
  }

  function queueLimitedRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(limitedRenderLists, RENDER_DEBOUNCE_MS);
  }

  // Replace the expensive full-list renderer before the app initializes.
  renderLists = queueLimitedRender;
})();
