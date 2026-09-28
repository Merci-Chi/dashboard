(() => {
  const SUPABASE_URL = 'https://glonbvrcudwuzjundrii.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_VZbed_uuOXSE744UrAfHXw_z2xDdYtr';

  let clientsClient = null;
  let clients = [];
  let filteredClients = [];
  let selectedIds = new Set();
  let focusedId = '';
  let activeFilter = 'all';
  let searchText = '';
  let pageUnlocked = sessionStorage.getItem('steadyhands_clients_page_unlocked') === '1';
  let progressTableAvailable = true;
  const saveTimers = new Map();

  const root = document.getElementById('tableBody');
  const status = document.getElementById('status');
  const detailsWrap = document.getElementById('detailsWrap');
  const filterPills = document.getElementById('filterPills');
  const searchInput = document.getElementById('searchInput');
  const clearSelectionButton = document.getElementById('clearSelectionButton');
  const selectionSummary = document.getElementById('selectionSummary');
  const unlockPageBtn = document.getElementById('unlockClientsPage');
  const selectAllRows = document.getElementById('selectAllRows');

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'agreement', label: 'Signed Agreement' },
    { key: 'development', label: 'Paid $100' },
    { key: 'standard', label: 'Standard Hosting' },
    { key: 'backend', label: 'Backend Hosting' }
  ];

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));

  const normalizeEmail = value => String(value || '').trim().toLowerCase();
  const sameEmail = (a, b) => normalizeEmail(a) && normalizeEmail(a) === normalizeEmail(b);
  const upper = value => String(value || '').toUpperCase();
  const lower = value => String(value || '').toLowerCase();
  const money = (amount, currency = 'USD') => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amount || 0) / 100);
  const dateOnly = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : '-';
  const dateTime = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '-';
  const placeholder = () => '<span class="muted-dash">-</span>';

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'C';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  async function initClientsClient() {
    if (!clientsClient && window.parent !== window) {
      clientsClient = window.parent.supabaseClient || null;
    }

    if (!clientsClient) {
      if (!window.supabase?.createClient) throw new Error('Supabase library did not load.');
      clientsClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
    }

    const { data } = await clientsClient.auth.getSession();
    if (!data.session) throw new Error('Sign in to the main dashboard first.');
    return clientsClient;
  }

  async function getSessionUser() {
    const client = await initClientsClient();
    const { data } = await client.auth.getSession();
    if (!data?.session?.user) throw new Error('Your login session expired. Please sign in again.');
    return data.session.user;
  }

  async function verifyPassword(password) {
    if (!password) throw new Error('Password is required.');
    const client = await initClientsClient();
    const user = await getSessionUser();
    const { error } = await client.auth.signInWithPassword({ email: user.email, password });
    if (error) throw new Error('Incorrect password.');
    return client;
  }

  async function unlockClientsPage() {
    if (pageUnlocked) return true;
    const password = prompt('Enter your password to unlock the Clients page for this session:');
    if (password === null) return false;
    status.className = 'status';
    status.textContent = 'Checking password…';
    await verifyPassword(password);
    pageUnlocked = true;
    sessionStorage.setItem('steadyhands_clients_page_unlocked', '1');
    status.textContent = '';
    syncUnlockUI();
    render();
    return true;
  }

  function syncUnlockUI() {
    if (!unlockPageBtn) return;
    unlockPageBtn.innerHTML = pageUnlocked
      ? '<i class="bi bi-unlock-fill"></i> Clients unlocked'
      : '<i class="bi bi-lock-fill"></i> Unlock clients';
    unlockPageBtn.classList.toggle('unlocked', pageUnlocked);
    unlockPageBtn.setAttribute('aria-pressed', pageUnlocked ? 'true' : 'false');
  }

  function normalizeProject(row) {
    return {
      ...row,
      lead_id: row.crmid || '',
      contactName: row.original?.contact_name || row.name || '',
      company: row.company || row.name || 'Client',
      email: row.original?.email || row.email || '',
      phone: row.original?.phone || row.phone || '',
      clientData: row.returndata || {},
      created_at: row.created,
      updated_at: row.updated
    };
  }

  async function listClientProjects() {
    const client = await initClientsClient();
    const { data, error } = await client.from('sites').select('*').in('stage', ['client']).order('created', { ascending: true });
    if (error) throw error;
    return (data || []).map(normalizeProject);
  }

  async function listBilling() {
    const client = await initClientsClient();
    const { data, error } = await client
      .from('square')
      .select('*, payments(*)')
      .in('status', ['ACTIVE', 'CANCELED', 'PAUSED', 'DEACTIVATED', 'PENDING', 'COMPLETED'])
      .order('created', { ascending: true });
    if (error) throw error;
    return (data || []).map(row => ({
      ...row,
      user_id: row.userid,
      site_project_id: row.crmid,
      customer_email: row.email,
      customer_phone: row.phone,
      customer_name: row.name,
      customer_company: row.company,
      plan_name: row.plan,
      amount_money: row.amount,
      billing_cadence: row.cadence,
      start_date: row.startdate,
      canceled_date: row.canceled,
      charged_through_date: row.chargedthrough,
      payment_history: (row.payments || []).map(payment => ({
        ...payment,
        paid_at: payment.paid,
        card_brand: payment.card,
        card_last_4: payment.lastfour,
        receipt_url: payment.receipt,
        amount_money: payment.amount,
        created_at: payment.created
      }))
    }));
  }

  async function listAgreements() {
    const client = await initClientsClient();
    const { data, error } = await client.from('agreements').select('*').order('signed', { ascending: false });
    if (error) throw error;
    return (data || []).map(row => ({
      ...row,
      user_id: row.userid,
      signer_name: row.name,
      business_name: row.company,
      signer_email: row.email,
      electronic_signature: row.signature,
      plan_label: row.plan,
      terms_version: row.terms,
      agreement_snapshot: row.document,
      signed_at: row.signed,
      created_at: row.created
    }));
  }

  async function listManagedSites() {
    const client = await initClientsClient();
    const { data, error } = await client.from('sites').select('*').order('created', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function listProgressOverrides() {
    const client = await initClientsClient();
    const { data, error } = await client.from('client_portal_progress').select('*');
    if (error) {
      progressTableAvailable = false;
      return [];
    }
    progressTableAvailable = true;
    return data || [];
  }

  async function updateClientProject(id, changes) {
    const client = await initClientsClient();
    const row = { updated: new Date().toISOString() };
    if ('status' in changes) row.stage = changes.status;
    if ('clientData' in changes) row.returndata = changes.clientData;
    const { error } = await client.from('sites').update(row).eq('id', id);
    if (error) throw error;
  }

  async function saveManagedSite({ userId, siteName, siteKey, publicUrl, adminUrl, domainName, domainActive }) {
    const client = await initClientsClient();
    const sourceid = `portal:${userId}:${siteKey}`;
    const row = {
      userid: userId,
      source: 'portal',
      sourceid,
      sitekey: siteKey,
      name: siteName,
      previewurl: publicUrl || null,
      liveurl: publicUrl || null,
      adminurl: adminUrl || null,
      domain: domainName || null,
      domainstatus: domainActive ? 'active' : 'inactive',
      stage: 'active',
      updated: new Date().toISOString()
    };
    const { data, error } = await client.from('sites').upsert(row, { onConflict: 'source,sourceid' }).select().single();
    if (error) throw error;
    return data;
  }

  async function saveProgressOverride(clientRow) {
    if (!clientRow.clientUserId) throw new Error('This client needs a linked user account first.');
    if (!progressTableAvailable) throw new Error('The client progress table is not available yet. Run the SQL first.');
    const client = await initClientsClient();
    const user = await getSessionUser();
    const row = {
      user_id: clientRow.clientUserId,
      agreement_signed: clientRow.progressOverride.agreement_signed,
      development_paid: clientRow.progressOverride.development_paid,
      standard_hosting: clientRow.progressOverride.standard_hosting,
      backend_hosting: clientRow.progressOverride.backend_hosting,
      updated_by: user.id,
      updated_at: new Date().toISOString()
    };
    const { error } = await client.from('client_portal_progress').upsert(row, { onConflict: 'user_id' });
    if (error) throw error;
  }

  async function deleteClient(clientRow, password, typedEmail) {
    const expected = normalizeEmail(clientRow.email);
    if (!expected) throw new Error('This client does not have an email on file, so deletion is blocked.');
    if (normalizeEmail(typedEmail) !== expected) throw new Error('The client email does not match exactly.');

    const client = await verifyPassword(password);
    const jobs = [];

    if (clientRow.managedSite?.id && String(clientRow.managedSite.id) !== String(clientRow.project?.id || '')) {
      jobs.push(client.from('sites').delete().eq('id', clientRow.managedSite.id));
    }

    if (clientRow.project?.id) jobs.push(client.from('sites').delete().eq('id', clientRow.project.id));
    if (clientRow.agreement?.id) jobs.push(client.from('agreements').delete().eq('id', clientRow.agreement.id));
    (clientRow.billingRows || []).forEach(row => jobs.push(client.from('square').delete().eq('id', row.id)));

    if (!jobs.length) throw new Error('No removable client record was found.');
    const results = await Promise.all(jobs);
    const failed = results.find(result => result.error);
    if (failed?.error) throw new Error(failed.error.message || 'Could not delete this client.');
  }

  function isDevBillingRow(row) {
    const plan = lower(row.plan_name);
    const cadence = upper(row.billing_cadence);
    return cadence === 'ONE_TIME' || Number(row.amount_money || 0) === 10000 || plan.includes('website development') || plan.includes('$100');
  }

  function isStandardBillingRow(row) {
    return lower(row.plan_name).includes('standard');
  }

  function isBackendBillingRow(row) {
    return lower(row.plan_name).includes('backend');
  }

  function isHostingActive(row) {
    return ['ACTIVE', 'PENDING'].includes(upper(row.status));
  }

  function isDevelopmentPaid(row) {
    if (!row) return false;
    if (upper(row.status) === 'COMPLETED') return true;
    return (row.payment_history || []).some(payment => upper(payment.status) === 'COMPLETED');
  }

  function mergeBool(actual, overrideValue) {
    return typeof overrideValue === 'boolean' ? overrideValue : actual;
  }

  function clientStatus(clientRow) {
    if (clientRow.progress.backend) return { label: 'Active Client', cls: 'good' };
    if (clientRow.progress.standard) return { label: 'Active Client', cls: 'good' };
    if (clientRow.progress.development) return { label: 'Development Paid', cls: 'info' };
    if (clientRow.progress.agreement) return { label: 'Agreement Signed', cls: 'warn' };
    return { label: 'Client', cls: 'info' };
  }

  function attachDerivedData(clientRow) {
    const progressOverride = clientRow.progressOverride || {};
    const devRow = (clientRow.billingRows || []).find(isDevBillingRow) || null;
    const standardRow = (clientRow.billingRows || []).find(row => isStandardBillingRow(row) && isHostingActive(row)) || null;
    const backendRow = (clientRow.billingRows || []).find(row => isBackendBillingRow(row) && isHostingActive(row)) || null;
    const agreementActual = !!clientRow.agreement;
    const developmentActual = isDevelopmentPaid(devRow);
    const standardActual = !!standardRow;
    const backendActual = !!backendRow;

    clientRow.progress = {
      agreement: mergeBool(agreementActual, progressOverride.agreement_signed),
      development: mergeBool(developmentActual, progressOverride.development_paid),
      standard: mergeBool(standardActual, progressOverride.standard_hosting),
      backend: mergeBool(backendActual, progressOverride.backend_hosting)
    };

    clientRow.progressDates = {
      agreement: clientRow.agreement?.signed_at || '',
      development: devRow?.lastpayment || devRow?.created_at || (devRow?.payment_history || []).find(payment => upper(payment.status) === 'COMPLETED')?.paid_at || '',
      standard: standardRow?.charged_through_date || standardRow?.created_at || '',
      backend: backendRow?.charged_through_date || backendRow?.created_at || ''
    };

    clientRow.activeSubscription = backendRow || standardRow || (clientRow.billingRows || []).find(row => !isDevBillingRow(row)) || null;
    clientRow.developmentRow = devRow;
    clientRow.standardRow = standardRow;
    clientRow.backendRow = backendRow;
    clientRow.statusBadge = clientStatus(clientRow);
  }

  function buildClientKey(parts) {
    if (parts.userId) return `user:${parts.userId}`;
    if (parts.email) return `email:${normalizeEmail(parts.email)}`;
    if (parts.projectId) return `project:${parts.projectId}`;
    return `misc:${Math.random().toString(36).slice(2)}`;
  }

  function ensureClient(map, parts) {
    const key = buildClientKey(parts);
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        key,
        company: 'Client',
        contactName: '',
        email: '',
        phone: '',
        project: null,
        agreement: null,
        billingRows: [],
        managedSite: null,
        clientData: {},
        progressOverride: {},
        clientUserId: parts.userId || ''
      });
    }
    return map.get(key);
  }

  async function load() {
    try {
      status.className = 'status';
      status.textContent = 'Loading clients…';

      const [projects, billing, agreements, managedSites, progressRows] = await Promise.all([
        listClientProjects(),
        listBilling(),
        listAgreements(),
        listManagedSites(),
        listProgressOverrides().catch(() => [])
      ]);

      const map = new Map();
      const progressByUser = new Map(progressRows.map(row => [String(row.user_id), row]));

      projects.forEach(project => {
        const row = ensureClient(map, { userId: project.userid, email: project.email, projectId: project.id });
        row.project = project;
        row.clientData = project.clientData || {};
        row.company = project.company || row.company;
        row.contactName = project.contactName || row.contactName;
        row.email = project.email || row.email;
        row.phone = project.phone || row.phone;
        row.clientUserId = project.userid || row.clientUserId;
      });

      agreements.forEach(agreement => {
        const row = ensureClient(map, { userId: agreement.user_id, email: agreement.signer_email, projectId: agreement.id });
        row.agreement = agreement;
        row.company = agreement.business_name || row.company;
        row.contactName = agreement.signer_name || row.contactName;
        row.email = agreement.signer_email || row.email;
        row.clientUserId = agreement.user_id || row.clientUserId;
      });

      billing.forEach(subscription => {
        const row = ensureClient(map, { userId: subscription.user_id, email: subscription.customer_email, projectId: subscription.id });
        row.billingRows.push(subscription);
        row.company = row.company !== 'Client' ? row.company : (subscription.customer_company || subscription.customer_name || row.company);
        row.contactName = row.contactName || subscription.customer_name || '';
        row.email = row.email || subscription.customer_email || '';
        row.phone = row.phone || subscription.customer_phone || '';
        row.clientUserId = subscription.user_id || row.clientUserId;
      });

      map.forEach(row => {
        if (row.clientUserId && progressByUser.has(String(row.clientUserId))) {
          row.progressOverride = progressByUser.get(String(row.clientUserId));
        }
        row.managedSite = managedSites.find(site => {
          if (row.clientUserId && String(site.userid || '') === String(row.clientUserId)) return true;
          if (row.project?.id && String(site.sitekey || '') === String(row.project.id)) return true;
          return sameEmail(site.email, row.email);
        }) || null;

        attachDerivedData(row);
      });

      clients = Array.from(map.values()).filter(row => row.progress.agreement || row.progress.development || row.progress.standard || row.progress.backend);
      clients.sort((a, b) => a.company.localeCompare(b.company));

      if (focusedId && !clients.find(row => row.id === focusedId)) focusedId = '';
      selectedIds = new Set([...selectedIds].filter(id => clients.some(row => row.id === id)));
      if (!selectedIds.size && clients[0]) {
        selectedIds.add(clients[0].id);
        focusedId = clients[0].id;
      }
      if (!focusedId && selectedIds.size) focusedId = [...selectedIds][0];

      status.textContent = progressTableAvailable ? '' : 'Client progress overrides are not available yet. Run the progress SQL if you want editable milestone switches to save.';
      applyFilters();
    } catch (error) {
      console.error(error);
      status.className = 'status error';
      status.textContent = error.message || 'Could not load clients.';
      root.innerHTML = '';
      detailsWrap.innerHTML = '';
    }
  }

  function filterMatch(clientRow) {
    if (activeFilter === 'agreement') return clientRow.progress.agreement;
    if (activeFilter === 'development') return clientRow.progress.development;
    if (activeFilter === 'standard') return clientRow.progress.standard;
    if (activeFilter === 'backend') return clientRow.progress.backend;
    return true;
  }

  function searchMatch(clientRow) {
    const haystack = [clientRow.company, clientRow.contactName, clientRow.email, clientRow.phone].join(' ').toLowerCase();
    return haystack.includes(searchText.trim().toLowerCase());
  }

  function getCounts() {
    return {
      all: clients.length,
      agreement: clients.filter(row => row.progress.agreement).length,
      development: clients.filter(row => row.progress.development).length,
      standard: clients.filter(row => row.progress.standard).length,
      backend: clients.filter(row => row.progress.backend).length
    };
  }

  function applyFilters() {
    filteredClients = clients.filter(row => filterMatch(row) && searchMatch(row));
    if (focusedId && !filteredClients.find(row => row.id === focusedId)) {
      const selectedVisible = filteredClients.find(row => selectedIds.has(row.id));
      focusedId = selectedVisible?.id || filteredClients[0]?.id || '';
    }
    renderFilters();
    renderTable();
    renderDetails();
    syncSelectionSummary();
  }

  function renderFilters() {
    const counts = getCounts();
    filterPills.innerHTML = FILTERS.map(filter => `
      <button class="filter-pill ${activeFilter === filter.key ? 'active' : ''}" data-filter="${filter.key}" type="button">
        <span>${filter.label}</span>
        <span class="count">${counts[filter.key] || 0}</span>
      </button>
    `).join('');
  }

  function statusMeta(value, dateValue) {
    if (value === true) {
      return `<div class="meta-stack"><span class="badge good">${dateValue ? 'Active' : 'Yes'}</span><span class="meta-date">${esc(dateOnly(dateValue))}</span></div>`;
    }
    return `<div class="meta-stack">${placeholder()}</div>`;
  }

  function renderAgreementCell(clientRow) {
    if (!clientRow.progress.agreement) return placeholder();
    return `<div class="meta-stack"><span class="badge good">Signed</span><span class="meta-date">${esc(dateOnly(clientRow.progressDates.agreement))}</span></div>`;
  }

  function renderDevelopmentCell(clientRow) {
    if (!clientRow.progress.development) return placeholder();
    return `<div class="meta-stack"><span class="badge good">Paid</span><span class="meta-date">${esc(dateOnly(clientRow.progressDates.development))}</span></div>`;
  }

  function renderHostingCell(kind, clientRow) {
    const isOn = kind === 'standard' ? clientRow.progress.standard : clientRow.progress.backend;
    const dateValue = kind === 'standard' ? clientRow.progressDates.standard : clientRow.progressDates.backend;
    if (!isOn) return placeholder();
    return `<div class="meta-stack"><span class="badge good">Active</span><span class="meta-date">${esc(dateOnly(dateValue))}</span></div>`;
  }

  function renderTable() {
    if (!filteredClients.length) {
      root.innerHTML = `<tr><td colspan="8"><div class="empty-card"><i class="bi bi-people"></i><strong>No matching clients.</strong><div>Try a different filter or search.</div></div></td></tr>`;
      selectAllRows.checked = false;
      return;
    }

    root.innerHTML = filteredClients.map(clientRow => `
      <tr data-row-id="${esc(clientRow.id)}" class="${selectedIds.has(clientRow.id) ? 'selected' : ''}">
        <td class="check-col"><input data-row-checkbox="${esc(clientRow.id)}" type="checkbox" ${selectedIds.has(clientRow.id) ? 'checked' : ''}></td>
        <td>
          <div class="client-cell">
            <div class="client-avatar">${esc(initials(clientRow.company || clientRow.contactName))}</div>
            <div class="client-main">
              <div class="client-name">${esc(clientRow.company)}</div>
              <div class="client-sub">${esc(clientRow.contactName || '-')}</div>
            </div>
          </div>
        </td>
        <td class="email-cell">${esc(clientRow.email || '-')}</td>
        <td>${renderAgreementCell(clientRow)}</td>
        <td>${renderDevelopmentCell(clientRow)}</td>
        <td>${renderHostingCell('standard', clientRow)}</td>
        <td>${renderHostingCell('backend', clientRow)}</td>
        <td><span class="badge ${esc(clientRow.statusBadge.cls)}">${esc(clientRow.statusBadge.label)}</span></td>
      </tr>
    `).join('');

    const selectable = filteredClients.length;
    const selectedVisible = filteredClients.filter(row => selectedIds.has(row.id)).length;
    selectAllRows.checked = selectable > 0 && selectedVisible === selectable;
  }

  function syncSelectionSummary() {
    const count = selectedIds.size;
    if (!count) selectionSummary.textContent = 'No clients selected.';
    else if (count === 1) selectionSummary.textContent = '1 client selected.';
    else selectionSummary.textContent = `${count} clients selected.`;
    clearSelectionButton.disabled = !count;
  }

  function agreementSignatureHTML(agreement) {
    if (!agreement?.electronic_signature) return '<div class="helper">No signature is saved for this agreement.</div>';
    if (String(agreement.electronic_signature).startsWith('data:image/')) {
      return `
        <div class="signature-preview">
          <strong>Signature</strong>
          <img src="${esc(agreement.electronic_signature)}" alt="Client signature">
        </div>
      `;
    }
    return `<div class="signature-preview"><strong>Electronic signature</strong><div class="helper">${esc(agreement.electronic_signature)}</div></div>`;
  }

  function renderDetails() {
    const focused = clients.find(row => row.id === focusedId) || filteredClients[0];
    if (!focused) {
      detailsWrap.innerHTML = '';
      return;
    }

    const managed = focused.managedSite || {};
    const agreement = focused.agreement;
    const summary = focused.statusBadge;
    const canEditProject = !!focused.project?.id;

    detailsWrap.innerHTML = `
      <section class="card detail-card" data-client-id="${esc(focused.id)}">
        <div class="detail-head">
          <div class="detail-head-left">
            <div class="client-avatar">${esc(initials(focused.company || focused.contactName))}</div>
            <div>
              <h2>${esc(focused.company)}</h2>
              <p>${esc(focused.contactName || '-')} ${focused.email ? `· ${esc(focused.email)}` : ''}</p>
              <div class="selected-mini"><span class="badge ${esc(summary.cls)}">${esc(summary.label)}</span></div>
            </div>
          </div>
          <div class="inline-actions">
            <button class="btn secondary" type="button" data-action="focus-selected">Focus selected client</button>
            ${canEditProject ? `<button class="btn secondary" type="button" data-back-to-contact="${esc(focused.id)}">Back to Contact</button>` : ''}
            <button class="btn danger" type="button" data-delete-client="${esc(focused.id)}">Delete Client</button>
          </div>
        </div>

        <div class="detail-grid">
          <aside class="info-card">
            <div class="info-item"><span>Client name</span><strong>${esc(focused.company)}</strong></div>
            <div class="info-list">
              <div class="info-item"><span>Contact</span><strong>${esc(focused.contactName || '-')}</strong></div>
              <div class="info-item"><span>Email</span><strong>${esc(focused.email || '-')}</strong></div>
              <div class="info-item"><span>Phone</span><strong>${esc(focused.phone || '-')}</strong></div>
              <div class="info-item"><span>User ID</span><strong>${esc(focused.clientUserId || '-')}</strong></div>
              <div class="info-item"><span>Public URL</span><strong>${esc(managed.liveurl || managed.previewurl || managed.public_url || '-')}</strong></div>
              <div class="info-item"><span>Admin URL</span><strong>${esc(managed.adminurl || managed.admin_url || '-')}</strong></div>
              <div class="info-item"><span>Domain</span><strong>${esc(managed.domain || managed.domain_name || '-')}</strong></div>
            </div>
          </aside>

          <section class="block">
            <h3>Client Progress</h3>
            <div class="block-body">
              <div class="progress-list">
                ${renderProgressRow(focused, 'agreement_signed', 'Client Agreement', focused.progress.agreement, focused.progressDates.agreement)}
                ${renderProgressRow(focused, 'development_paid', '$100 Website Development', focused.progress.development, focused.progressDates.development)}
                ${renderProgressRow(focused, 'standard_hosting', 'Standard Hosting Plan', focused.progress.standard, focused.progressDates.standard)}
                ${renderProgressRow(focused, 'backend_hosting', 'Backend Hosting Plan', focused.progress.backend, focused.progressDates.backend)}
              </div>
              <div class="helper">You can manually change the unlocked steps here. ${progressTableAvailable ? '' : 'Run the SQL first to save these switches.'}</div>
            </div>
          </section>

          <section class="block">
            <h3>Website / Notes</h3>
            <div class="block-body">
              <div class="fields-grid three">
                <label class="field"><span>Public Website URL</span><input data-site-field="publicUrl" value="${esc(managed.liveurl || managed.previewurl || managed.public_url || '')}" placeholder="https://clientdomain.com"></label>
                <label class="field"><span>Admin Page URL</span><input data-site-field="adminUrl" value="${esc(managed.adminurl || managed.admin_url || '')}" placeholder="https://clientdomain.com/admin"></label>
                <label class="field"><span>Domain Name</span><input data-site-field="domainName" value="${esc(managed.domain || managed.domain_name || '')}" placeholder="clientdomain.com"></label>
              </div>
              <div class="fields-grid two" style="margin-top:12px;">
                <label class="field"><span>Requests</span><textarea data-client-field="requests">${esc(focused.clientData?.requests || '')}</textarea></label>
                <label class="field"><span>Notes / Obligations</span><textarea data-client-field="obligations">${esc(focused.clientData?.obligations || focused.clientData?.notes || '')}</textarea></label>
              </div>
              <div class="inline-actions">
                <label class="field" style="display:flex;align-items:center;gap:10px;min-height:44px;">
                  <span style="margin:0;">Active domain</span>
                  <input data-site-field="domainActive" type="checkbox" ${String(managed.domainstatus || managed.domain_status).toLowerCase() === 'active' ? 'checked' : ''}>
                </label>
                <div class="auto-save-note" id="autosaveNote">Changes save automatically.</div>
              </div>
            </div>
          </section>
        </div>
      </section>

      <section class="card detail-card">
        <section class="block">
          <h3>Agreement</h3>
          <div class="block-body">
            ${agreement ? `
              <div class="agreement-grid">
                <div class="agreement-box"><span>Signer</span><strong>${esc(agreement.signer_name || '-')}</strong></div>
                <div class="agreement-box"><span>Business</span><strong>${esc(agreement.business_name || '-')}</strong></div>
                <div class="agreement-box"><span>Email</span><strong>${esc(agreement.signer_email || '-')}</strong></div>
                <div class="agreement-box"><span>Signed</span><strong>${esc(dateTime(agreement.signed_at))}</strong></div>
                <div class="agreement-box"><span>Plan</span><strong>${esc(agreement.plan_label || '-')}</strong></div>
                <div class="agreement-box"><span>Version</span><strong>${esc(agreement.terms_version || '-')}</strong></div>
              </div>
              <div class="agreement-actions">
                <a class="btn secondary" href="../../Web-Hosting-Client-Agreement.pdf" target="_blank" rel="noopener">Terms and Conditions</a>
              </div>
              ${agreementSignatureHTML(agreement)}
            ` : '<div class="helper">No signed agreement is linked to this client.</div>'}
          </div>
        </section>
      </section>
    `;
  }

  function renderProgressRow(clientRow, field, label, value, dateValue) {
    const statusLabel = value ? (field === 'development_paid' ? 'Paid' : field.includes('hosting') ? 'Active' : 'Completed') : 'Not completed';
    return `
      <div class="progress-row">
        <div class="progress-title">
          <strong>${esc(label)}</strong>
          <span>${esc(statusLabel)} ${dateValue ? '· ' + esc(dateOnly(dateValue)) : ''}</span>
        </div>
        <span class="badge ${value ? 'good' : 'info'}">${esc(value ? statusLabel : 'Off')}</span>
        <label class="toggle">
          <input data-progress-field="${esc(field)}" type="checkbox" ${value ? 'checked' : ''} ${pageUnlocked ? '' : 'disabled'}>
          <span class="toggle-ui"></span>
        </label>
      </div>
    `;
  }

  function queueSaveClient(clientRow, reason = 'Saving…') {
    clearTimeout(saveTimers.get(clientRow.id));
    const note = document.getElementById('autosaveNote');
    if (note) note.textContent = reason;
    saveTimers.set(clientRow.id, setTimeout(async () => {
      saveTimers.delete(clientRow.id);
      try {
        if (clientRow.project?.id) {
          await updateClientProject(clientRow.project.id, { clientData: clientRow.clientData || {} });
        }
        if (clientRow.clientUserId) {
          const draft = clientRow.managedDraft || {};
          const managed = clientRow.managedSite || {};
          const saved = await saveManagedSite({
            userId: clientRow.clientUserId,
            siteName: clientRow.company || 'Client Website',
            siteKey: String(clientRow.project?.id || clientRow.clientUserId || clientRow.id),
            publicUrl: draft.publicUrl ?? managed.liveurl ?? managed.previewurl ?? managed.public_url ?? '',
            adminUrl: draft.adminUrl ?? managed.adminurl ?? managed.admin_url ?? '',
            domainName: draft.domainName ?? managed.domain ?? managed.domain_name ?? '',
            domainActive: draft.domainActive ?? String(managed.domainstatus || managed.domain_status).toLowerCase() === 'active'
          });
          clientRow.managedSite = saved;
        }
        if (note) note.textContent = 'All changes saved.';
      } catch (error) {
        if (note) note.textContent = 'Could not save changes.';
        status.className = 'status error';
        status.textContent = error.message || 'Could not save changes.';
      }
    }, 450));
  }

  function toggleRowSelection(id, forceValue) {
    if (typeof forceValue === 'boolean') {
      if (forceValue) selectedIds.add(id);
      else selectedIds.delete(id);
    } else if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }
    if (!selectedIds.size) focusedId = filteredClients[0]?.id || '';
    else if (selectedIds.has(id)) focusedId = id;
    else if (!selectedIds.has(focusedId)) focusedId = [...selectedIds][0] || filteredClients[0]?.id || '';
    renderTable();
    renderDetails();
    syncSelectionSummary();
  }

  filterPills.addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    activeFilter = button.dataset.filter;
    applyFilters();
  });

  searchInput.addEventListener('input', () => {
    searchText = searchInput.value || '';
    applyFilters();
  });

  clearSelectionButton.addEventListener('click', () => {
    selectedIds.clear();
    if (filteredClients[0]) {
      selectedIds.add(filteredClients[0].id);
      focusedId = filteredClients[0].id;
    }
    renderTable();
    renderDetails();
    syncSelectionSummary();
  });

  selectAllRows.addEventListener('change', () => {
    if (selectAllRows.checked) {
      filteredClients.forEach(row => selectedIds.add(row.id));
      if (!focusedId && filteredClients[0]) focusedId = filteredClients[0].id;
    } else {
      filteredClients.forEach(row => selectedIds.delete(row.id));
      focusedId = [...selectedIds][0] || filteredClients[0]?.id || '';
    }
    renderTable();
    renderDetails();
    syncSelectionSummary();
  });

  root.addEventListener('click', async event => {
    const checkbox = event.target.closest('[data-row-checkbox]');
    if (checkbox) {
      event.stopPropagation();
      if (!pageUnlocked) {
        checkbox.checked = false;
        await unlockClientsPage();
        return;
      }
      toggleRowSelection(checkbox.dataset.rowCheckbox, checkbox.checked);
      return;
    }

    const row = event.target.closest('[data-row-id]');
    if (!row) return;
    if (!pageUnlocked) {
      await unlockClientsPage();
      return;
    }
    toggleRowSelection(row.dataset.rowId);
  });

  detailsWrap.addEventListener('input', event => {
    const card = event.target.closest('[data-client-id]');
    if (!card) return;
    const clientRow = clients.find(row => row.id === card.dataset.clientId);
    if (!clientRow) return;

    if (event.target.matches('[data-client-field]')) {
      clientRow.clientData = clientRow.clientData || {};
      clientRow.clientData[event.target.dataset.clientField] = event.target.value;
      queueSaveClient(clientRow);
      return;
    }

    if (event.target.matches('[data-site-field]')) {
      clientRow.managedDraft = clientRow.managedDraft || {};
      clientRow.managedDraft[event.target.dataset.siteField] = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
      queueSaveClient(clientRow);
    }
  });

  detailsWrap.addEventListener('change', async event => {
    const card = event.target.closest('[data-client-id]');
    if (!card) return;
    const clientRow = clients.find(row => row.id === card.dataset.clientId);
    if (!clientRow) return;

    const progressInput = event.target.closest('[data-progress-field]');
    if (progressInput) {
      try {
        if (!pageUnlocked) {
          progressInput.checked = !progressInput.checked;
          await unlockClientsPage();
          return;
        }
        clientRow.progressOverride = clientRow.progressOverride || {};
        clientRow.progressOverride[progressInput.dataset.progressField] = progressInput.checked;
        attachDerivedData(clientRow);
        renderTable();
        renderDetails();
        status.className = 'status';
        status.textContent = 'Saving client progress…';
        await saveProgressOverride(clientRow);
        status.textContent = 'Client progress saved.';
      } catch (error) {
        attachDerivedData(clientRow);
        renderTable();
        renderDetails();
        status.className = 'status error';
        status.textContent = error.message || 'Could not save client progress.';
      }
    }
  });

  detailsWrap.addEventListener('click', async event => {
    const backButton = event.target.closest('[data-back-to-contact]');
    const deleteButton = event.target.closest('[data-delete-client]');

    try {
      if (backButton) {
        const clientRow = clients.find(row => row.id === backButton.dataset.backToContact);
        if (!clientRow?.project?.id) return;
        await updateClientProject(clientRow.project.id, { status: 'contact' });
        status.className = 'status';
        status.textContent = 'Moved back to Contact.';
        await load();
        return;
      }

      if (deleteButton) {
        const clientRow = clients.find(row => row.id === deleteButton.dataset.deleteClient);
        if (!clientRow) return;
        const typedEmail = prompt(`Type the full client email exactly to continue:\n${clientRow.email || '(no email on file)'}`);
        if (typedEmail === null) return;
        const password = prompt('Enter your password to permanently delete this client:');
        if (password === null) return;
        if (!confirm(`Delete ${clientRow.company || 'this client'} permanently? This cannot be undone.`)) return;
        status.className = 'status';
        status.textContent = 'Deleting client…';
        await deleteClient(clientRow, password, typedEmail);
        status.textContent = 'Client deleted.';
        await load();
      }
    } catch (error) {
      status.className = 'status error';
      status.textContent = error.message || 'Could not complete that action.';
    }
  });

  if (unlockPageBtn) {
    unlockPageBtn.addEventListener('click', async () => {
      try {
        await unlockClientsPage();
      } catch (error) {
        status.className = 'status error';
        status.textContent = error.message || 'Could not unlock Clients.';
      }
    });
  }

  syncUnlockUI();
  load();
})();
