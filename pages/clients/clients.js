(() => {
const SUPABASE_URL='https://glonbvrcudwuzjundrii.supabase.co';
const SUPABASE_KEY='sb_publishable_VZbed_uuOXSE744UrAfHXw_z2xDdYtr';
let clientsClient=null;
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const same=(a,b)=>a&&b&&String(a).toLowerCase()===String(b).toLowerCase();
const upper=v=>String(v||'').toUpperCase();
const money=(a,c='USD')=>new Intl.NumberFormat(undefined,{style:'currency',currency:c||'USD'}).format(Number(a||0)/100);
const date=v=>v?new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(v)):'—';
const fullDate=v=>v?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'—';
const initials=name=>String(name||'Client').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();

async function initClientsClient(){
  if(!clientsClient&&window.parent!==window)clientsClient=window.parent.supabaseClient||null;
  if(!clientsClient){
    if(!window.supabase?.createClient)throw Error('Supabase library did not load.');
    clientsClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  }
  const {data}=await clientsClient.auth.getSession();
  if(!data.session)throw Error('Sign in to the main dashboard first.');
  return clientsClient;
}

async function authClient(){
  const c=await initClientsClient();
  const {data}=await c.auth.getSession();
  if(!data?.session?.user?.email)throw Error('Your login session expired. Please sign in again.');
  return{c,email:data.session.user.email};
}
async function verifyPassword(password){
  if(!password)throw Error('Password is required.');
  const{c,email}=await authClient();
  const{error}=await c.auth.signInWithPassword({email,password});
  if(error)throw Error('Incorrect password.');
  return c;
}

async function listRows(table,select='*',order='created'){
  const client=await initClientsClient();
  const {data,error}=await client.from(table).select(select).order(order,{ascending:false});
  if(error)throw error;
  return data||[];
}
async function listSites(){return listRows('sites');}
async function listAgreements(){return listRows('agreements','*','signed');}
async function listBilling(){return listRows('square','*, payments(*)');}
async function listProgress(){
  const client=await initClientsClient();
  const {data,error}=await client.from('client_portal_progress').select('*');
  if(error){
    if(String(error.message||'').toLowerCase().includes('client_portal_progress'))return[];
    throw error;
  }
  return data||[];
}

const root=document.getElementById('clientList');
const detail=document.getElementById('clientDetail');
const status=document.getElementById('status');
const unlockPageBtn=document.getElementById('unlockClientsPage');
const filters=document.getElementById('clientFilters');
const searchInput=document.getElementById('clientSearch');
const CLIENTS_UNLOCK_KEY='steadyhands_clients_page_unlocked';
let pageUnlocked=sessionStorage.getItem(CLIENTS_UNLOCK_KEY)==='1';
let clients=[];
let activeFilter='all';
let searchTerm='';
let selectedKey='';
let saveTimers=new Map();

function syncUnlockUI(){
  unlockPageBtn.innerHTML=pageUnlocked?'<i class="bi bi-unlock-fill"></i> Clients unlocked':'<i class="bi bi-lock-fill"></i> Unlock clients';
  unlockPageBtn.classList.toggle('unlocked',pageUnlocked);
  unlockPageBtn.setAttribute('aria-pressed',pageUnlocked?'true':'false');
}
async function unlockClientsPage(){
  if(pageUnlocked)return true;
  const password=prompt('Enter your password to unlock the Clients page for this session:');
  if(password===null)return false;
  status.className='status';status.textContent='Checking password…';
  await verifyPassword(password);
  pageUnlocked=true;sessionStorage.setItem(CLIENTS_UNLOCK_KEY,'1');status.textContent='';syncUnlockUI();render();return true;
}

function getPlanKind(row){
  const key=String(row?.original?.plankey||'').toLowerCase();
  const plan=String(row?.plan||'').toLowerCase();
  const cadence=upper(row?.cadence);
  const amount=Number(row?.amount||0);
  if(cadence==='ONE_TIME'&&(key==='website-development'||amount===10000||plan.includes('website development')))return'development';
  if(plan.includes('backend')||key.includes('backend'))return'backend';
  if(plan.includes('standard')||key.includes('standard'))return'standard';
  return cadence==='MONTHLY'?'hosting':'other';
}
function isCompletedPayment(row){return upper(row?.status)==='COMPLETED'||(row?.payments||[]).some(p=>upper(p.status)==='COMPLETED');}
function isActiveHosting(row){return['ACTIVE','PAID'].includes(upper(row?.status));}

function buildClients(sites,billing,agreements,progressRows){
  const map=new Map();
  const progressByUser=new Map(progressRows.map(r=>[String(r.user_id),r]));
  function ensure(key,seed={}){
    if(!map.has(key))map.set(key,{key,userId:'',company:'',contactName:'',email:'',phone:'',agreements:[],billing:[],sites:[],progress:null,clientData:{},...seed});
    return map.get(key);
  }
  const keyFor=(userId,email,fallback)=>userId?`u:${userId}`:email?`e:${String(email).toLowerCase()}`:fallback;

  agreements.forEach(a=>{
    const key=keyFor(a.userid,a.email,`a:${a.id}`);const x=ensure(key);x.userId=x.userId||a.userid||'';x.company=x.company||a.company||'';x.contactName=x.contactName||a.name||'';x.email=x.email||a.email||'';x.agreements.push(a);
  });
  billing.forEach(b=>{
    const key=keyFor(b.userid,b.email,`b:${b.id}`);const x=ensure(key);x.userId=x.userId||b.userid||'';x.company=x.company||b.company||b.name||'';x.contactName=x.contactName||b.name||'';x.email=x.email||b.email||'';x.phone=x.phone||b.phone||'';x.billing.push(b);
  });
  sites.forEach(s=>{
    const key=keyFor(s.userid,s.email||s.original?.email,`s:${s.id}`);const x=ensure(key);x.userId=x.userId||s.userid||'';x.company=x.company||s.company||s.name||'';x.contactName=x.contactName||s.original?.contact_name||'';x.email=x.email||s.email||s.original?.email||'';x.phone=x.phone||s.phone||s.original?.phone||'';x.sites.push(s);if(s.returndata&&Object.keys(s.returndata).length)x.clientData={...x.clientData,...s.returndata};
  });

  for(const x of map.values()){
    if(x.userId)x.progress=progressByUser.get(String(x.userId))||null;
    x.agreement=[...x.agreements].sort((a,b)=>new Date(b.signed||b.created)-new Date(a.signed||a.created))[0]||null;
    x.development=x.billing.find(r=>getPlanKind(r)==='development'&&isCompletedPayment(r))||null;
    x.standard=x.billing.find(r=>getPlanKind(r)==='standard'&&isActiveHosting(r))||null;
    x.backend=x.billing.find(r=>getPlanKind(r)==='backend'&&isActiveHosting(r))||null;
    x.hasAgreement=x.progress?.agreement_signed ?? Boolean(x.agreement?.accepted!==false&&x.agreement);
    x.hasDevelopment=x.progress?.development_paid ?? Boolean(x.development);
    x.hasStandard=x.progress?.standard_hosting ?? Boolean(x.standard);
    x.hasBackend=x.progress?.backend_hosting ?? Boolean(x.backend);
    x.firstDate=[x.agreement?.signed,x.development?.lastpayment,x.standard?.created,x.backend?.created,...x.sites.map(s=>s.created)].filter(Boolean).sort()[0]||'';
    x.lastDate=[...x.billing.map(b=>b.updated||b.created),...x.sites.map(s=>s.updated||s.created),x.agreement?.signed].filter(Boolean).sort().at(-1)||'';
    x.primarySite=x.sites[0]||null;
  }
  return [...map.values()].filter(x=>x.hasAgreement||x.hasDevelopment||x.hasStandard||x.hasBackend||x.progress).sort((a,b)=>String(a.company||a.contactName).localeCompare(String(b.company||b.contactName)));
}

function statusInfo(x){
  if(x.billing.some(b=>upper(b.status)==='CANCELED'))return{label:'Canceled',cls:'canceled'};
  if(x.hasStandard||x.hasBackend)return{label:'Active Client',cls:'client'};
  if(x.hasDevelopment)return{label:'Development Paid',cls:'dev'};
  return{label:'Agreement Signed',cls:'agreement'};
}
function milestoneCell(done,label,when){return `<div class="milestone ${done?'done':''}"><i class="bi ${done?'bi-check-circle-fill':'bi-dash'}"></i><div><strong>${done?label:'—'}</strong>${done&&when?`<small>${esc(date(when))}</small>`:''}</div></div>`}
function filteredClients(){
  return clients.filter(x=>{
    const matchFilter=activeFilter==='all'||(activeFilter==='agreement'&&x.hasAgreement)||(activeFilter==='development'&&x.hasDevelopment)||(activeFilter==='standard'&&x.hasStandard)||(activeFilter==='backend'&&x.hasBackend);
    const hay=`${x.company} ${x.contactName} ${x.email} ${x.phone}`.toLowerCase();
    return matchFilter&&(!searchTerm||hay.includes(searchTerm));
  });
}
function updateCounts(){
  const counts={all:clients.length,agreement:clients.filter(x=>x.hasAgreement).length,development:clients.filter(x=>x.hasDevelopment).length,standard:clients.filter(x=>x.hasStandard).length,backend:clients.filter(x=>x.hasBackend).length};
  Object.entries(counts).forEach(([k,v])=>{const el=document.querySelector(`[data-count="${k}"]`);if(el)el.textContent=v;});
}
function renderRows(){
  updateCounts();const list=filteredClients();
  root.innerHTML=list.map(x=>{const st=statusInfo(x);const name=x.contactName||x.company||'Client';return `<button class="client-row ${selectedKey===x.key?'selected':''}" type="button" data-select="${esc(x.key)}">
    <span class="client-person"><span class="avatar">${esc(initials(name))}</span><span><strong>${esc(name)}</strong><small>${esc(x.company&&x.company!==name?x.company:'')}</small></span></span>
    <span class="email-cell">${esc(x.email||'—')}</span>
    ${milestoneCell(x.hasAgreement,'Signed',x.agreement?.signed)}
    ${milestoneCell(x.hasDevelopment,'Paid',x.development?.lastpayment||x.development?.updated)}
    ${milestoneCell(x.hasStandard,'Active',x.standard?.startdate||x.standard?.created)}
    ${milestoneCell(x.hasBackend,'Active',x.backend?.startdate||x.backend?.created)}
    <span><span class="status-pill ${st.cls}">${esc(st.label)}</span></span>
    <span class="row-action"><span class="row-edit">Edit</span></span>
  </button>`}).join('')||'<div class="empty"><i class="bi bi-people"></i><br><strong>No clients match this filter.</strong></div>';
}
function switchRow(key,label,done,icon){return `<div class="progress-row"><span class="progress-icon"><i class="bi ${icon}"></i></span><span class="progress-copy"><strong>${label}</strong></span><span class="progress-state ${done?'done':''}"><i class="bi ${done?'bi-check-circle-fill':'bi-circle-fill'}"></i>${done?'Completed':'Not completed'}</span><label class="switch"><input type="checkbox" data-progress="${key}" ${done?'checked':''}><span></span></label></div>`}
function renderDetail(){
  const x=clients.find(c=>c.key===selectedKey);
  if(!x){detail.hidden=true;detail.innerHTML='';return;}
  if(!pageUnlocked){detail.hidden=true;return;}
  const st=statusInfo(x);const site=x.primarySite||{};const d=x.clientData||{};
  detail.hidden=false;
  detail.innerHTML=`
    <section class="detail-column profile" data-client="${esc(x.key)}">
      <div class="profile-block"><span class="avatar">${esc(initials(x.contactName||x.company))}</span><div><h2>${esc(x.contactName||x.company||'Client')}</h2><p>${esc(x.company||'')}</p></div></div>
      <div class="detail-badge"><span class="status-pill ${st.cls}">${esc(st.label)}</span></div>
      <div class="contact-list">
        <div class="contact-item"><i class="bi bi-envelope"></i><span>${esc(x.email||'No email')}</span></div>
        <div class="contact-item"><i class="bi bi-telephone"></i><span>${esc(x.phone||'No phone')}</span></div>
        <div class="contact-item"><i class="bi bi-link-45deg"></i><span>${esc(site.liveurl||site.previewurl||'No website URL')}</span></div>
      </div>
      <div class="meta-list"><span>Client since <strong>${esc(date(x.firstDate))}</strong></span><span>Last activity <strong>${esc(date(x.lastDate))}</strong></span>${x.userId?`<span>User ID <strong>${esc(x.userId.slice(0,8))}…</strong></span>`:''}</div>
    </section>
    <section class="detail-column" data-client="${esc(x.key)}">
      <div class="progress-head"><h3>Client Progress</h3><p>Manually update which steps this client has completed.</p></div>
      <div class="progress-stack">
        ${switchRow('agreement_signed','Client Agreement',x.hasAgreement,'bi-file-earmark-text')}
        ${switchRow('development_paid','$100 Website Development',x.hasDevelopment,'bi-credit-card')}
        ${switchRow('standard_hosting','Standard Hosting Plan',x.hasStandard,'bi-window')}
        ${switchRow('backend_hosting','Backend Hosting Plan',x.hasBackend,'bi-database')}
      </div>
      <div class="detail-section">
        <h3 class="side-title">Website & Admin</h3>
        <label class="field">Public website URL<input data-site-field="liveurl" value="${esc(site.liveurl||site.previewurl||'')}" placeholder="https://clientdomain.com"></label>
        <label class="field">Admin page URL<input data-site-field="adminurl" value="${esc(site.adminurl||'')}" placeholder="https://clientdomain.com/admin"></label>
        <label class="field">Domain<input data-site-field="domain" value="${esc(site.domain||'')}" placeholder="clientdomain.com"></label>
        <div class="autosave" data-autosave-status>Changes save automatically.</div>
      </div>
    </section>
    <section class="detail-column side" data-client="${esc(x.key)}">
      <h3 class="side-title">Notes</h3>
      <label class="field"><textarea data-client-field="notes" placeholder="Add notes about this client...">${esc(d.notes||d.obligations||'')}</textarea></label>
      <div class="agreement-mini">${x.agreement?`<strong>Agreement signed</strong><br>${esc(fullDate(x.agreement.signed))}<br>${esc(x.agreement.terms||'')}`:'No agreement record linked.'}</div>
      <div class="detail-section"><h3 class="side-title">Quick Actions</h3><div class="quick-actions">
        ${site.liveurl?`<a href="${esc(site.liveurl)}" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i> View Website</a>`:''}
        ${x.agreement?`<a href="../../Web-Hosting-Client-Agreement.pdf" target="_blank" rel="noopener"><i class="bi bi-file-earmark-text"></i> View Agreement</a>`:''}
        <button type="button" data-back><i class="bi bi-arrow-left"></i> Back to Contact</button>
        <button class="danger" type="button" data-delete><i class="bi bi-trash"></i> Delete Client</button>
      </div></div>
    </section>`;
}
function render(){renderRows();renderDetail();}

async function saveProgress(x,field,value){
  if(!x.userId)throw Error('This client does not have a linked user account.');
  const c=await initClientsClient();
  const payload={user_id:x.userId,[field]:value,updated_at:new Date().toISOString()};
  const {data:{session}}=await c.auth.getSession();if(session?.user?.id)payload.updated_by=session.user.id;
  const {error}=await c.from('client_portal_progress').upsert(payload,{onConflict:'user_id'});
  if(error)throw error;
  x.progress={...(x.progress||{}),...payload};
  const map={agreement_signed:'hasAgreement',development_paid:'hasDevelopment',standard_hosting:'hasStandard',backend_hosting:'hasBackend'};x[map[field]]=value;
}
async function saveSiteField(x,field,value){
  let site=x.primarySite;
  const c=await initClientsClient();
  if(site?.id){const {error}=await c.from('sites').update({[field]:value,updated:new Date().toISOString()}).eq('id',site.id);if(error)throw error;site[field]=value;return;}
  if(!x.userId)throw Error('This client needs a linked user before site URLs can be saved.');
  const row={userid:x.userId,source:'portal',sourceid:`client-admin:${x.userId}`,sitekey:`client-${x.userId}`,name:x.company||'Client Website',stage:'client',[field]:value,updated:new Date().toISOString()};
  const {data,error}=await c.from('sites').upsert(row,{onConflict:'source,sourceid'}).select().single();if(error)throw error;x.sites.unshift(data);x.primarySite=data;
}
async function saveClientNotes(x,value){
  const site=x.primarySite;if(!site?.id)return;
  const c=await initClientsClient();const returndata={...(site.returndata||{}),notes:value};
  const {error}=await c.from('sites').update({returndata,updated:new Date().toISOString()}).eq('id',site.id);if(error)throw error;site.returndata=returndata;x.clientData={...x.clientData,notes:value};
}
async function backToContact(x){const site=x.primarySite;if(!site?.id)throw Error('No site record is linked to this client.');const c=await initClientsClient();const{error}=await c.from('sites').update({stage:'contact',updated:new Date().toISOString()}).eq('id',site.id);if(error)throw error;}
async function deleteClient(x,password,typedEmail){
  const expected=String(x.email||'').trim().toLowerCase();if(!expected)throw Error('This client does not have an email on file, so deletion is blocked.');if(String(typedEmail||'').trim().toLowerCase()!==expected)throw Error('The client email does not match exactly.');const c=await verifyPassword(password);const jobs=[];x.sites.forEach(s=>jobs.push(c.from('sites').delete().eq('id',s.id)));x.agreements.forEach(a=>jobs.push(c.from('agreements').delete().eq('id',a.id)));x.billing.forEach(b=>jobs.push(c.from('square').delete().eq('id',b.id)));if(x.userId)jobs.push(c.from('client_portal_progress').delete().eq('user_id',x.userId));const results=await Promise.all(jobs);const failed=results.find(r=>r.error);if(failed?.error)throw Error(failed.error.message||'Could not delete this client.');
}

async function load(){
  try{status.className='status';status.textContent='Loading clients…';const [sites,billing,agreements,progress]=await Promise.all([listSites(),listBilling(),listAgreements(),listProgress()]);clients=buildClients(sites,billing,agreements,progress);if(selectedKey&&!clients.some(x=>x.key===selectedKey))selectedKey='';status.textContent='';render();}
  catch(e){console.error(e);status.className='status error';status.textContent=e.message||'Could not load clients.';}
}

filters.addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;activeFilter=b.dataset.filter;filters.querySelectorAll('.filter-btn').forEach(x=>x.classList.toggle('active',x===b));renderRows();});
searchInput.addEventListener('input',()=>{searchTerm=searchInput.value.trim().toLowerCase();renderRows();});
root.addEventListener('click',async e=>{const row=e.target.closest('[data-select]');if(!row)return;try{if(!pageUnlocked)await unlockClientsPage();selectedKey=row.dataset.select;render();requestAnimationFrame(()=>detail.scrollIntoView({behavior:'smooth',block:'nearest'}));}catch(err){status.className='status error';status.textContent=err.message||'Could not open client.';}});
detail.addEventListener('change',async e=>{const x=clients.find(c=>c.key===selectedKey);if(!x)return;try{if(e.target.dataset.progress){status.textContent='Saving client progress…';await saveProgress(x,e.target.dataset.progress,e.target.checked);status.textContent='Client progress saved.';render();return;}if(e.target.dataset.siteField){status.textContent='Saving website details…';await saveSiteField(x,e.target.dataset.siteField,e.target.value);status.textContent='Website details saved.';render();}}catch(err){status.className='status error';status.textContent=err.message||'Could not save changes.';await load();}});
detail.addEventListener('input',e=>{if(!e.target.dataset.clientField)return;const x=clients.find(c=>c.key===selectedKey);if(!x)return;clearTimeout(saveTimers.get(x.key));const msg=detail.querySelector('[data-autosave-status]');if(msg)msg.textContent='Saving…';saveTimers.set(x.key,setTimeout(async()=>{try{await saveClientNotes(x,e.target.value);if(msg)msg.textContent='All changes saved.';}catch(err){if(msg)msg.textContent='Could not save changes.';}},450));});
detail.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;const x=clients.find(c=>c.key===selectedKey);if(!x)return;try{if(b.hasAttribute('data-back')){await backToContact(x);status.textContent='Client moved back to Contact.';await load();return;}if(b.hasAttribute('data-delete')){const typedEmail=prompt(`Type the full client email exactly to continue:\n${x.email||'(no email on file)'}`);if(typedEmail===null)return;const password=prompt('Enter your password to permanently delete this client:');if(password===null)return;if(!confirm(`Delete ${x.company||x.contactName||'this client'} permanently? This cannot be undone.`))return;status.textContent='Deleting client…';await deleteClient(x,password,typedEmail);selectedKey='';status.textContent='Client deleted.';await load();}}catch(err){status.className='status error';status.textContent=err.message||'Could not complete that action.';}});
unlockPageBtn.addEventListener('click',async()=>{try{await unlockClientsPage();}catch(err){status.className='status error';status.textContent=err.message||'Could not unlock Clients.';}});
syncUnlockUI();load();
})();
