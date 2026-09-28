(() => {
const SUPABASE_URL='https://glonbvrcudwuzjundrii.supabase.co';
const SUPABASE_KEY='sb_publishable_VZbed_uuOXSE744UrAfHXw_z2xDdYtr';

let clientsClient=null;

const escapeHTML=value=>String(value??'').replace(/[&<>'"]/g,char=>({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  "'":'&#39;',
  '"':'&quot;'
}[char]));

async function initClientsClient(){
  if(!clientsClient&&window.parent!==window){
    clientsClient=window.parent.supabaseClient||null;
  }

  if(!clientsClient){
    if(!window.supabase?.createClient)throw Error('Supabase library did not load.');
    clientsClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
      auth:{
        persistSession:true,
        autoRefreshToken:true,
        detectSessionInUrl:false
      }
    });
  }

  const {data}=await clientsClient.auth.getSession();
  if(!data.session)throw Error('Sign in to the main dashboard first.');
  return clientsClient;
}

const normalizeProject=x=>({
  ...x,
  lead_id:x.crmid||'',
  contact_name:x.original?.contact_name||'',
  contactName:x.original?.contact_name||'',
  email:x.original?.email||x.email||'',
  phone:x.original?.phone||x.phone||'',
  status:x.stage||'staging',
  return_note:x.notes||'',
  returnNote:x.notes||'',
  review_checks:x.checks||{},
  checks:x.checks||{},
  live_at:x.original?.live_at||'',
  liveAt:x.original?.live_at||'',
  client_data:x.returndata||{},
  clientData:x.returndata||{},
  created_at:x.created,
  updated_at:x.updated
});

async function listClientProjects(){
  const client=await initClientsClient();
  const {data,error}=await client.from('sites').select('*').in('stage',['client']).order('created',{ascending:true});
  if(error)throw error;
  return (data||[]).map(normalizeProject);
}

async function listBilling(){
  const client=await initClientsClient();
  const {data,error}=await client.from('square')
    .select('*, payments(*)')
    .in('status',['ACTIVE','CANCELED','PAUSED','DEACTIVATED','PENDING','COMPLETED'])
    .order('created',{ascending:true});
  if(error)throw error;
  return (data||[]).map(x=>({
    ...x,
    user_id:x.userid,
    site_project_id:x.crmid,
    square_customer_id:x.customerid,
    square_subscription_id:x.subscriptionid,
    customer_name:x.name,
    customer_company:x.company,
    customer_email:x.email,
    customer_phone:x.phone,
    plan_name:x.plan,
    amount_money:x.amount,
    billing_cadence:x.cadence,
    start_date:x.startdate,
    canceled_date:x.canceled,
    charged_through_date:x.chargedthrough,
    created_at:x.created,
    updated_at:x.updated,
    payment_history:(x.payments||[]).map(p=>({
      ...p,
      paid_at:p.paid,
      card_brand:p.card,
      card_last_4:p.lastfour,
      receipt_url:p.receipt,
      created_at:p.created,
      updated_at:p.updated
    }))
  }));
}

async function listAgreements(){
  const client=await initClientsClient();
  const {data,error}=await client.from('agreements').select('*').order('signed',{ascending:false});
  if(error)throw error;
  return (data||[]).map(x=>({
    ...x,
    user_id:x.userid,
    signer_name:x.name,
    business_name:x.company,
    signer_email:x.email,
    electronic_signature:x.signature,
    plan_label:x.plan,
    terms_version:x.terms,
    agreement_snapshot:x.document,
    signed_at:x.signed,
    created_at:x.created
  }));
}

async function listManagedSites(){
  const client=await initClientsClient();
  const {data,error}=await client.from('sites').select('*').order('created',{ascending:true});
  if(error)throw error;
  return (data||[]).map(x=>({
    ...x,
    user_id:x.userid,
    site_name:x.name,
    site_key:x.sitekey,
    public_url:x.liveurl||x.previewurl,
    admin_url:x.adminurl,
    admin_status:x.adminstatus,
    admin_checked:x.adminchecked,
    admin_final_url:x.adminfinalurl,
    domain_name:x.domain,
    domain_status:x.domainstatus,
    status:x.stage,
    created_at:x.created,
    updated_at:x.updated
  }));
}

async function listProgressOverrides(){
  const client=await initClientsClient();
  const {data,error}=await client.from('client_portal_progress').select('*');
  if(error)throw error;
  return data||[];
}

async function saveProgressOverride(userId,field,value){
  if(!userId)throw Error('This client is not linked to a signed-in user account.');
  const client=await initClientsClient();
  const {data:sessionData}=await client.auth.getSession();
  const updater=sessionData?.session?.user?.id||null;
  const {data:existing,error:readError}=await client
    .from('client_portal_progress')
    .select('agreement_signed,development_paid,standard_hosting,backend_hosting')
    .eq('user_id',userId)
    .maybeSingle();
  if(readError)throw readError;
  const row={
    user_id:userId,
    agreement_signed:existing?.agreement_signed??null,
    development_paid:existing?.development_paid??null,
    standard_hosting:existing?.standard_hosting??null,
    backend_hosting:existing?.backend_hosting??null,
    updated_by:updater,
    updated_at:new Date().toISOString()
  };
  row[field]=Boolean(value);
  const {data,error}=await client.from('client_portal_progress').upsert(row,{onConflict:'user_id'}).select().single();
  if(error)throw error;
  return data;
}

async function updateClientProject(id,changes){
  const client=await initClientsClient();
  const row={updated:new Date().toISOString()};

  if('status' in changes)row.stage=changes.status;
  if('clientData' in changes)row.returndata=changes.clientData;

  const {error}=await client.from('sites').update(row).eq('id',id);
  if(error)throw error;

  return {...changes,id};
}

async function saveManagedSite(site){
  const client=await initClientsClient();
  const sourceid=`portal:${site.userId}:${site.siteKey}`;

  const row={
    userid:site.userId,
    source:'portal',
    sourceid,
    sitekey:site.siteKey,
    name:site.siteName,
    previewurl:site.publicUrl||null,
    liveurl:site.publicUrl||null,
    adminurl:site.adminUrl||null,
    domain:site.domainName||null,
    domainstatus:site.domainActive?'active':'inactive',
    stage:'active',
    updated:new Date().toISOString()
  };

  const {data,error}=await client
    .from('sites')
    .upsert(row,{onConflict:'source,sourceid'})
    .select()
    .single();

  if(error)throw error;
  return data;
}

const root=document.getElementById('clientList'),
  status=document.getElementById('status'),
  unlockPageBtn=document.getElementById('unlockClientsPage'),
  esc=escapeHTML;

let clients=[],saveTimers=new Map(),activeFilter='all';
const CLIENTS_UNLOCK_KEY='steadyhands_clients_page_unlocked';
let pageUnlocked=sessionStorage.getItem(CLIENTS_UNLOCK_KEY)==='1';
  const money=(a,c='USD')=>new Intl.NumberFormat(undefined,{style:'currency',currency:c}).format(Number(a||0)/100);
  const date=v=>v?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'—';
  const canceled=v=>String(v||'').toUpperCase()==='CANCELED',same=(a,b)=>a&&b&&a.toLowerCase()===b.toLowerCase();
  const payments=s=>[...(s?.payment_history||[])].sort((a,b)=>new Date(b.paid_at||b.created_at)-new Date(a.paid_at||a.created_at));
  function syncUnlockUI(){
    if(!unlockPageBtn)return;
    unlockPageBtn.innerHTML=pageUnlocked
      ? '<i class="bi bi-unlock-fill"></i> Clients unlocked'
      : '<i class="bi bi-lock-fill"></i> Unlock clients';
    unlockPageBtn.classList.toggle('unlocked',pageUnlocked);
    unlockPageBtn.setAttribute('aria-pressed',pageUnlocked?'true':'false');
  }

  async function unlockClientsPage(){
    if(pageUnlocked)return true;
    const password=prompt('Enter your password to unlock the Clients page for this session:');
    if(password===null)return false;
    status.className='status';
    status.textContent='Checking password…';
    await verifyPassword(password);
    pageUnlocked=true;
    sessionStorage.setItem(CLIENTS_UNLOCK_KEY,'1');
    status.textContent='';
    syncUnlockUI();
    render();
    return true;
  }
  async function authClient(){const c=await initClientsClient();const{data}=await c.auth.getSession();if(!data?.session?.user?.email)throw Error('Your login session expired. Please sign in again.');return{c,email:data.session.user.email}}
  async function verifyPassword(password){if(!password)throw Error('Password is required.');const{c,email}=await authClient();const{error}=await c.auth.signInWithPassword({email,password});if(error)throw Error('Incorrect password.');return c}
  async function deleteClient(x,password,typedEmail){const expected=String(x.email||'').trim().toLowerCase();if(!expected)throw Error('This client does not have an email on file, so deletion is blocked.');if(String(typedEmail||'').trim().toLowerCase()!==expected)throw Error('The client email does not match exactly.');const c=await verifyPassword(password);const projectId=/^(subscription|agreement):/.test(String(x.id))?'':x.id;const jobs=[];if(x.managedSite?.id&&String(x.managedSite.id)!==String(projectId))jobs.push(c.from('sites').delete().eq('id',x.managedSite.id));if(projectId)jobs.push(c.from('sites').delete().eq('id',projectId));if(x.agreement?.id)jobs.push(c.from('agreements').delete().eq('id',x.agreement.id));if(x.subscription?.id)jobs.push(c.from('square').delete().eq('id',x.subscription.id));if(!jobs.length)throw Error('No removable client record was found.');const results=await Promise.all(jobs);const failed=results.find(r=>r.error);if(failed?.error)throw Error(failed.error.message||'Could not delete this client.');}
  const normEmail=v=>String(v||'').trim().toLowerCase();
  const verifiedHostingStatus=v=>['ACTIVE','CANCELED','PAUSED','DEACTIVATED','COMPLETED'].includes(String(v||'').toUpperCase());
  const isDevelopmentPurchase=row=>{
    const status=String(row?.status||'').toUpperCase();
    const cadence=String(row?.billing_cadence||row?.cadence||'').toUpperCase();
    const planKey=String(row?.original?.plankey||'').toLowerCase();
    return status==='COMPLETED'&&cadence==='ONE_TIME'&&(planKey==='website-development'||Number(row?.amount_money??row?.amount)===10000||/website development/i.test(row?.plan_name||row?.plan||''));
  };
  const hostingType=row=>{
    const cadence=String(row?.billing_cadence||row?.cadence||'').toUpperCase();
    if(cadence!=='MONTHLY'||!verifiedHostingStatus(row?.status))return '';
    const key=String(row?.original?.plankey||'').toLowerCase();
    const label=String(row?.plan_name||row?.plan||'').toLowerCase();
    if(key.includes('backend')||label.includes('backend'))return 'backend';
    if(key.includes('standard')||label.includes('standard'))return 'standard';
    return '';
  };
  const overrideValue=(override,field,fallback)=>override&&override[field]!==null&&override[field]!==undefined?Boolean(override[field]):Boolean(fallback);

  async function load(){
    try{
      status.className='status';
      status.textContent='';
      const[projects,billing,agreements,managedSites,progressRows]=await Promise.all([
        listClientProjects(),listBilling(),listAgreements(),listManagedSites(),listProgressOverrides()
      ]);
      const groups=new Map();
      const ensure=(userId,email)=>{
        const cleanEmail=normEmail(email);
        const key=userId?`user:${userId}`:`email:${cleanEmail}`;
        if(!groups.has(key))groups.set(key,{key,userId:userId||'',email:email||'',projects:[],billing:[],agreements:[]});
        const g=groups.get(key);
        if(userId&&!g.userId)g.userId=userId;
        if(email&&!g.email)g.email=email;
        return g;
      };
      agreements.forEach(a=>ensure(a.user_id,a.signer_email).agreements.push(a));
      billing.forEach(b=>ensure(b.user_id,b.customer_email).billing.push(b));
      projects.forEach(p=>ensure(p.user_id,p.email).projects.push(p));

      clients=[...groups.values()].map(g=>{
        const project=g.projects[0]||null;
        const agreement=g.agreements.find(a=>a.accepted&&a.signed)||g.agreements[0]||null;
        const development=g.billing.find(isDevelopmentPurchase)||null;
        const standard=g.billing.find(b=>hostingType(b)==='standard')||null;
        const backend=g.billing.find(b=>hostingType(b)==='backend')||null;
        const subscription=[backend,standard].find(Boolean)||g.billing.find(b=>String(b.billing_cadence||b.cadence||'').toUpperCase()==='MONTHLY')||null;
        const override=progressRows.find(r=>String(r.user_id)===String(g.userId))||null;
        const automatic={
          agreement:Boolean(g.agreements.some(a=>a.accepted&&a.signed)),
          development:Boolean(development),
          standard:Boolean(standard),
          backend:Boolean(backend)
        };
        const progress={
          agreement:overrideValue(override,'agreement_signed',automatic.agreement),
          development:overrideValue(override,'development_paid',automatic.development),
          standard:overrideValue(override,'standard_hosting',automatic.standard),
          backend:overrideValue(override,'backend_hosting',automatic.backend)
        };
        const company=project?.company||agreement?.business_name||subscription?.customer_company||subscription?.customer_name||g.billing[0]?.customer_company||g.billing[0]?.customer_name||'Client';
        const contactName=project?.contactName||agreement?.signer_name||subscription?.customer_name||g.billing[0]?.customer_name||'';
        const email=project?.email||agreement?.signer_email||subscription?.customer_email||g.email||'';
        const phone=project?.phone||subscription?.customer_phone||g.billing[0]?.customer_phone||'';
        const id=project?.id||`account:${g.userId||normEmail(email)||crypto.randomUUID()}`;
        return{
          ...(project||{}),id,subscription,agreement,developmentPurchase:development,billingRecords:g.billing,
          clientData:project?.clientData||{},company,contactName,email,phone,
          clientUserId:g.userId||'',progressOverride:override,automaticProgress:automatic,progress
        };
      }).filter(x=>Object.values(x.automaticProgress||{}).some(Boolean)||x.progressOverride);

      clients.forEach(x=>{
        const userId=x.clientUserId;
        x.managedSite=managedSites.find(site=>String(site.user_id)===String(userId)&&String(site.site_key)===String(x.id))||managedSites.find(site=>String(site.user_id)===String(userId))||null;
      });
      render();
    }catch(e){
      console.error(e);
      status.className='status error';
      status.textContent=e?.message?.includes('client_portal_progress')
        ? 'Run the client progress SQL in Supabase first, then refresh this page.'
        : 'Could not load clients.';
    }
  }
  function agreementHTML(a,editable,d){if(a)return`<section class="agreement-section signed-agreement"><div class="agreement-title-row"><h3><i class="bi bi-file-earmark-check"></i> Agreement info</h3><span class="badge good">Signed</span></div><div class="agreement-info-grid"><div><span>Signer</span><strong>${esc(a.signer_name)}</strong></div><div><span>Business</span><strong>${esc(a.business_name)}</strong></div><div><span>Email</span><strong>${esc(a.signer_email)}</strong></div><div><span>Signed</span><strong>${esc(date(a.signed_at))}</strong></div><div><span>Plan</span><strong>${esc(a.plan_label)}</strong></div><div><span>Version</span><strong>${esc(a.terms_version)}</strong></div></div><div class="agreement-copy"><a href="../../Web-Hosting-Client-Agreement.pdf" target="_blank" rel="noopener" style="text-decoration:underline;text-underline-offset:4px;font-weight:800">Terms and Conditions</a>${String(a.electronic_signature||'').startsWith('data:image/')?`<div class='signature-line'><span>Signature</span><img src='${esc(a.electronic_signature)}' alt='Drawn signature' style='display:block;max-width:320px;width:100%;height:100px;margin-top:8px;object-fit:contain;object-position:left center;border-radius:8px;background:#fff'></div>`:`<p class='signature-line'>Electronically signed by <strong>${esc(a.electronic_signature)}</strong></p>`}</div></section>`;if(!editable)return`<section class="agreement-section unsigned-agreement"><h3>Agreement info</h3><p>No signed agreement is linked to this client.</p><a href="../../Web-Hosting-Client-Agreement.pdf" target="_blank" rel="noopener" style="text-decoration:underline;text-underline-offset:4px;font-weight:800">Terms and Conditions</a></section>`;return`<section class="agreement-section"><h3>Agreement</h3><div class="two-fields"><label>Status<select data-field="agreementStatus">${['Not Started','Draft','Sent','Signed','Expired'].map(v=>`<option ${d.agreementStatus===v?'selected':''}>${v}</option>`).join('')}</select></label><label>Signed date<input type="date" data-field="agreementDate" value="${esc(d.agreementDate||'')}"></label></div><textarea data-field="agreementNotes">${esc(d.agreementNotes||'')}</textarea><a href="../../Web-Hosting-Client-Agreement.pdf" target="_blank" rel="noopener" style="text-decoration:underline;text-underline-offset:4px;font-weight:800">Terms and Conditions</a></section>`}
  const filterMatches=(x)=>activeFilter==='all'||Boolean(x.progress?.[activeFilter]);
  function progressHTML(x){
    const p=x.progress||{};
    const disabled=x.clientUserId?'':'disabled';
    const automatic=x.automaticProgress||{};
    const item=(field,label,dbField)=>`<label class="progress-toggle ${p[field]?'is-on':''}"><input type="checkbox" data-progress-field="${dbField}" data-progress-key="${field}" ${p[field]?'checked':''} ${disabled}><span><strong>${label}</strong><small>${automatic[field]?'Verified automatically':'Manual / not yet verified'}</small></span></label>`;
    return `<section class="progress-manager"><div class="progress-manager-head"><div><h3><i class="bi bi-check2-circle"></i> Client progress</h3><p>Change what this signed-in client has unlocked.</p></div>${x.clientUserId?'':`<span class="badge canceled">No linked login</span>`}</div><div class="progress-toggle-grid">${item('agreement','Agreement signed','agreement_signed')}${item('development','$100 development','development_paid')}${item('standard','Standard hosting','standard_hosting')}${item('backend','Backend hosting','backend_hosting')}</div>${x.clientUserId?'':`<p class="field-note">This record can be viewed, but milestones cannot be manually changed until it is linked to a user account.</p>`}<p class="status progress-save-status" data-progress-status="${esc(x.id)}"></p></section>`;
  }
  function render(){root.innerHTML=clients.filter(filterMatches).map(x=>{const d=x.clientData||{},sub=x.subscription,ps=payments(sub),isCanceled=canceled(sub?.status||d.subscriptionStatus),projectId=/^(subscription|agreement):/.test(String(x.id))?'':x.id,last=ps.find(p=>p.status==='COMPLETED')||ps[0];const managed=x.managedSite||{},clientUserId=x.clientUserId||'',open=pageUnlocked;const billing=sub?`<div class="billing-summary"><div><span>Subscription</span><strong>${esc(sub.plan_name||d.plan||'Standard Hosting')}</strong></div><div><span>Status</span><strong>${esc(sub.status||'Active')}</strong></div><div><span>Amount</span><strong>${money(sub.amount_money,sub.currency)}</strong></div><div><span>Last payment</span><strong>${date(last?.paid_at)}</strong></div></div><details class="payment-history"><summary><span><i class="bi bi-receipt"></i> Payment history</span><span>${ps.length} payment${ps.length===1?'':'s'} <i class="bi bi-chevron-down"></i></span></summary><div class="payment-list">${ps.length?ps.map(p=>`<div class="payment-row"><div><strong>${date(p.paid_at||p.created_at)}</strong><small>${esc(p.card_brand||'Payment')}${p.card_last_4?` •••• ${esc(p.card_last_4)}`:''}</small></div><span class="payment-status ${p.status==='COMPLETED'?'paid':'failed'}">${esc(p.status)}</span><strong>${money(p.amount_money,p.currency)}</strong></div>`).join(''):'<p class="no-payments">No payments have been received yet.</p>'}</div></details>`:'<p class="auto-client-note"><i class="bi bi-clock-history"></i> Agreement signed; waiting for the subscription.</p>';const body=`${progressHTML(x)}${billing}${projectId?`<div class="client-grid"><section class="client-links"><h3><i class="bi bi-link-45deg"></i> Website &amp; Admin Links</h3>${clientUserId?`<label>Public website URL<input data-site-field="publicUrl" inputmode="url" placeholder="https://clientdomain.com" value="${esc(managed.public_url||'')}"></label><label>Admin page URL<input data-site-field="adminUrl" inputmode="url" placeholder="https://clientdomain.com/admin" value="${esc(managed.admin_url||'')}"></label><label>Domain name<input data-site-field="domainName" inputmode="url" placeholder="clientdomain.com" value="${esc(managed.domain_name||'')}"></label><label class="live-toggle domain-toggle"><input type="checkbox" data-site-field="domainActive" ${managed.domain_status==='active'?'checked':''}><span>Active domain</span></label><p class="field-note">These links appear only for this customer's signed-in account.</p>`:'<p class="auto-client-note"><i class="bi bi-person-exclamation"></i> This client needs a linked user before URLs can be assigned.</p>'}</section><section><h3>Requests</h3><textarea data-field="requests">${esc(d.requests||'')}</textarea><label>Status<select data-field="requestStatus">${['None','Open','In Progress','Waiting on Client','Completed'].map(v=>`<option ${d.requestStatus===v?'selected':''}>${v}</option>`).join('')}</select></label></section><section><h3>My obligations</h3><textarea data-field="obligations">${esc(d.obligations||'')}</textarea></section>${agreementHTML(x.agreement,true,d)}</div><div class="client-actions"><span class="status" data-autosave-status="${esc(x.id)}">Changes save automatically.</span><button class="btn secondary" data-back="${x.id}">Back to Contact</button><button class="btn danger" data-delete="${esc(x.id)}">Delete client</button></div>`:`${agreementHTML(x.agreement,false,d)}<div class="client-actions"><button class="btn danger" data-delete="${esc(x.id)}">Delete client</button></div>`}`;return`<article class="card client-card secure-client ${isCanceled?'client-canceled':''}" data-client="${esc(x.id)}"><button class="client-summary" data-open="${esc(x.id)}" aria-expanded="${open?'true':'false'}"><div><span class="badge ${isCanceled?'canceled':'good'}">${isCanceled?'Canceled':sub?'Client':'Agreement signed'}</span><h2>${esc(x.company)}</h2><p>${esc(x.contactName)}${x.contactName&&(x.email||x.phone)?' · ':''}${esc(x.email||x.phone)}</p></div><span class="client-summary-action"><i class="bi ${open?'bi-unlock-fill':'bi-lock-fill'}"></i>${open?'Unlocked':'Unlock clients'}</span></button><div class="secure-client-body" ${open?'':'hidden'}>${projectId?`<div class="client-head-controls"><label class="live-toggle"><input type="checkbox" data-field="siteLive" ${d.siteLive!==false?'checked':''}><span>Site live</span></label></div>`:''}${body}</div></article>`}).join('')||'<div class="empty"><div><i class="bi bi-people"></i><strong>No clients match this filter.</strong></div></div>';updateFilterCounts()}
  async function saveClient(x){const message=root.querySelector(`[data-autosave-status="${CSS.escape(String(x.id))}"]`);if(message)message.textContent='Saving…';try{await updateClientProject(x.id,{clientData:x.clientData});if(x.clientUserId){const draft=x.managedDraft||{},managed=x.managedSite||{};await saveManagedSite({userId:x.clientUserId,siteName:x.company||'Client Website',siteKey:String(x.id),publicUrl:draft.publicUrl??managed.public_url??'',adminUrl:draft.adminUrl??managed.admin_url??'',domainName:draft.domainName??managed.domain_name??'',domainActive:draft.domainActive??managed.domain_status==='active'})}if(message)message.textContent='All changes saved.'}catch(err){if(message)message.textContent='Could not save changes.';else status.textContent='Could not save changes.'}}
  function queueSave(x){clearTimeout(saveTimers.get(x.id));const message=root.querySelector(`[data-autosave-status="${CSS.escape(String(x.id))}"]`);if(message)message.textContent='Saving…';saveTimers.set(x.id,setTimeout(()=>{saveTimers.delete(x.id);saveClient(x)},450))}
  async function handleProgressChange(target,x){
    if(!x?.clientUserId)return;
    const field=target.dataset.progressField;
    const key=target.dataset.progressKey;
    const message=root.querySelector(`[data-progress-status="${CSS.escape(String(x.id))}"]`);
    target.disabled=true;
    if(message){message.className='status progress-save-status';message.textContent='Saving progress…';}
    try{
      const row=await saveProgressOverride(x.clientUserId,field,target.checked);
      x.progressOverride=row;
      x.progress[key]=target.checked;
      if(message)message.textContent='Progress saved to this client account.';
      target.closest('.progress-toggle')?.classList.toggle('is-on',target.checked);
      updateFilterCounts();
    }catch(err){
      target.checked=!target.checked;
      x.progress[key]=target.checked;
      if(message){message.className='status error progress-save-status';message.textContent=err.message||'Could not save progress.';}
    }finally{target.disabled=false;}
  }
  function capture(e){const x=clients.find(v=>String(v.id)===e.target.closest('[data-client]')?.dataset.client);if(!x)return;if(e.target.dataset.progressField){handleProgressChange(e.target,x);return}if(e.target.dataset.siteField){x.managedDraft=x.managedDraft||{};x.managedDraft[e.target.dataset.siteField]=e.target.type==='checkbox'?e.target.checked:e.target.value}else if(e.target.dataset.field){x.clientData=x.clientData||{};x.clientData[e.target.dataset.field]=e.target.type==='checkbox'?e.target.checked:e.target.value}else return;queueSave(x)}
  root.addEventListener('input',capture);root.addEventListener('change',capture);
  root.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;try{if(b.dataset.open){if(!pageUnlocked)await unlockClientsPage();return}if(b.dataset.delete){const x=clients.find(v=>String(v.id)===String(b.dataset.delete));if(!x)return;const typedEmail=prompt(`Type the full client email exactly to continue:\n${x.email||'(no email on file)'}`);if(typedEmail===null)return;const password=prompt('Enter your password to permanently delete this client:');if(password===null)return;if(!confirm(`Delete ${x.company||'this client'} permanently? This cannot be undone.`))return;status.textContent='Deleting client…';await deleteClient(x,password,typedEmail);status.textContent='Client deleted.';await load();return}if(b.dataset.back){const x=clients.find(v=>String(v.id)===String(b.dataset.back));if(saveTimers.has(x?.id)){clearTimeout(saveTimers.get(x.id));saveTimers.delete(x.id);await saveClient(x)}await updateClientProject(b.dataset.back,{status:'contact'})}load()}catch(err){status.className='status error';status.textContent=err.message||'Could not complete that action.'}});
  if(unlockPageBtn){
    unlockPageBtn.addEventListener('click',async()=>{
      try{
        await unlockClientsPage();
      }catch(err){
        status.className='status error';
        status.textContent=err.message||'Could not unlock Clients.';
      }
    });
  }
  const filterBar=document.getElementById('clientFilters');
  function updateFilterCounts(){
    if(!filterBar)return;
    const counts={all:clients.length,agreement:0,development:0,standard:0,backend:0};
    clients.forEach(x=>Object.keys(counts).forEach(k=>{if(k!=='all'&&x.progress?.[k])counts[k]++}));
    filterBar.querySelectorAll('[data-filter]').forEach(btn=>{
      const key=btn.dataset.filter;
      const count=btn.querySelector('.filter-count');
      if(count)count.textContent=counts[key]??0;
      btn.classList.toggle('active',key===activeFilter);
    });
  }
  if(filterBar){
    filterBar.addEventListener('click',e=>{
      const btn=e.target.closest('[data-filter]');
      if(!btn)return;
      activeFilter=btn.dataset.filter||'all';
      render();
    });
  }
  syncUnlockUI();
  load();
})();
