(() => {
const SUPABASE_URL='https://glonbvrcudwuzjundrii.supabase.co';
const SUPABASE_KEY='sb_publishable_VZbed_uuOXSE744UrAfHXw_z2xDdYtr';
const STORAGE_BUCKET='site-code';
let stagingClient=null;

const escapeHTML=value=>String(value??'').replace(/[&<>'"]/g,char=>({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  "'":'&#39;',
  '"':'&quot;'
}[char]));

async function initStagingClient(){
  if(!stagingClient&&window.parent!==window){
    stagingClient=window.parent.supabaseClient||null;
  }

  if(!stagingClient){
    if(!window.supabase?.createClient)throw Error('Supabase library did not load.');
    stagingClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
      auth:{
        persistSession:true,
        autoRefreshToken:true,
        detectSessionInUrl:false
      }
    });
  }

  const {data}=await stagingClient.auth.getSession();
  if(!data.session)throw Error('Sign in to the main dashboard first.');
  return stagingClient;
}

const normalizeSite=site=>({
  ...site,
  lead_id:site.crmid||'',
  contact_name:site.original?.contact_name||'',
  contactName:site.original?.contact_name||'',
  status:site.stage||'staging',
  return_note:site.notes||'',
  returnNote:site.notes||'',
  review_checks:site.checks||{},
  checks:site.checks||{},
  live_at:site.original?.live_at||'',
  liveAt:site.original?.live_at||'',
  client_data:site.returndata||{},
  clientData:site.returndata||{},
  created_at:site.created,
  updated_at:site.updated,
  admin_url:site.adminurl||'',
  admin_status:site.adminstatus||'',
  admin_checked:site.adminchecked||'',
  admin_final_url:site.adminfinalurl||''
});

async function listSites(){
  const client=await initStagingClient();
  const {data,error}=await client.from('sites').select('*').order('created',{ascending:true});
  if(error)throw error;
  return (data||[]).map(normalizeSite);
}

async function createSite(project){
  const client=await initStagingClient();
  const {data,error}=await client.from('sites').insert({
    crmid:project.leadId||null,
    source:'dashboard',
    sourceid:crypto.randomUUID(),
    sitekey:project.sitekey||null,
    name:project.company||'',
    previewurl:project.previewurl||null,
    adminurl:project.adminurl||null,
    adminstatus:project.adminstatus||null,
    stage:'staging',
    original:{
      contact_name:project.contactName||'',
      email:project.email||'',
      phone:project.phone||''
    }
  }).select().single();

  if(error)throw error;
  return normalizeSite(data);
}

async function updateSite(id,changes){
  const client=await initStagingClient();
  const row={updated:new Date().toISOString()};

  if('status' in changes)row.stage=changes.status;
  if('files' in changes)row.files=changes.files;
  if('checks' in changes)row.checks=changes.checks;
  if('returnNote' in changes)row.notes=changes.returnNote;
  if('clientData' in changes)row.returndata=changes.clientData;

  if('crmid' in changes)row.crmid=changes.crmid||null;

  for(const key of[
    'sitekey','name','previewurl','liveurl','adminurl',
    'adminstatus','adminchecked','adminfinalurl','domain','domainstatus'
  ]){
    if(key in changes)row[key]=changes[key];
  }

  const {error}=await client.from('sites').update(row).eq('id',id);
  if(error)throw error;
  return {...changes,id};
}

async function uploadSiteFile(id,path,file){
  const client=await initStagingClient();
  const {error}=await client.storage.from(STORAGE_BUCKET).upload(
    `${id}/${path}`,
    file,
    {upsert:true,contentType:file.type||'application/octet-stream'}
  );
  if(error)throw error;
}


async function downloadSiteFile(id,path){
  const client=await initStagingClient();
  const {data,error}=await client.storage.from(STORAGE_BUCKET).download(`${id}/${path}`);
  if(error)throw error;
  return data;
}


const listEl=document.getElementById('stagingList'),status=document.getElementById('status'),filePicker=document.getElementById('filePicker'),folderPicker=document.getElementById('folderPicker');
  let db=null,leads=[],projects=[],active=null,activeProject=null,filterMode='all';
  let crmConnectQuery='',crmConnectSelectedId='',crmConnectTags=[];
  let crmNewMode=false,crmNewDraft={company:'',name:'',phone:'',email:''},crmNewTagsOpen=false;
  let bulkFiles=[];
  let bulkFolderLinks={};
  let bulkFolderSearch={};
  let bulkFolderTags={};
  let bulkFolderNewMode={};
  let bulkFolderTagsOpen={};
  let bulkFolderNewDraft={};
  let bulkConnectionsSaved=false;
  const MAX=25*1024*1024;
  const fmt=n=>n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`;
  const size=x=>(x?.files||[]).reduce((n,f)=>n+(f.size||0),0);
  const message=(t,e=false)=>{status.textContent=t;status.classList.toggle('error',e)};
  const esc=v=>escapeHTML(v);
  const slug=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const siteUrl=key=>`https://viewyoursite.today/Sites/${encodeURIComponent(String(key||'').trim())}/`;
  const adminUrl=key=>`${siteUrl(key)}admin/`;
  const previewUrl=(...values)=>{for(const value of values){const raw=String(value||'').trim();if(!raw)continue;try{const u=new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw)?raw:`https://${raw}`),h=u.hostname.toLowerCase().replace(/^www\./,'');if(h==='viewyoursite.today'||h.endsWith('.viewyoursite.today'))return u.href}catch{}}return''};
  const projectFor=lead=>{
    if(!lead)return activeProject||null;
    return projects.find(item=>String(item.lead_id)===String(lead.id))
      ||projects.find(item=>item.sitekey&&lead.sitekey&&String(item.sitekey).toLowerCase()===String(lead.sitekey).toLowerCase())
      ||null;
  };
  const websiteReady=lead=>{
    const p=projectFor(lead);
    return Boolean(previewUrl(lead?.previewurl,lead?.website,p?.previewurl,p?.liveurl));
  };
  const adminState=lead=>{
    const p=projectFor(lead);
    const state=String(p?.adminstatus||'').toLowerCase();
    if(state==='valid')return'ready';
    if(['missing','redirect','error'].includes(state))return state;
    return'missing';
  };
  const needsWebsite=lead=>!websiteReady(lead);
  const needsAdmin=lead=>websiteReady(lead)&&adminState(lead)!=='ready';

  function existingSourceOptions(){
    const map=new Map();
    for(const lead of leads){
      for(const source of (Array.isArray(lead?.sources)?lead.sources:[])){
        const value=String(source||'').trim();
        if(value&&!map.has(value.toLowerCase()))map.set(value.toLowerCase(),value);
      }
    }
    return [...map.values()].sort((a,b)=>a.localeCompare(b));
  }

  function mergeSources(existing,selected){
    const out=[],seen=new Set();
    for(const value of [...(Array.isArray(existing)?existing:[]),...(Array.isArray(selected)?selected:[])]){
      const source=String(value||'').trim(),key=source.toLowerCase();
      if(source&&!seen.has(key)){seen.add(key);out.push(source)}
    }
    return out;
  }

  function sourceClass(value){
    const v=String(value||'').toLowerCase();
    if(v.includes('facebook'))return 'source-facebook';
    if(v.includes('instagram'))return 'source-instagram';
    if(v.includes('nextdoor'))return 'source-nextdoor';
    if(v.includes('google maps'))return 'source-googlemaps';
    if(v==='google')return 'source-google';
    if(v.includes('yelp'))return 'source-yelp';
    if(v.includes('linkedin'))return 'source-linkedin';
    if(v.includes('tiktok'))return 'source-tiktok';
    if(v.includes('booksy'))return 'source-booksy';
    if(v.includes('viewyoursite'))return 'source-viewyoursite';
    if(v.includes('waze'))return 'source-waze';
    if(v.includes('yahoo'))return 'source-yahoo';
    if(v.includes('referral'))return 'source-referral';
    return 'source-other';
  }

  function sourcePickerHTML(selected=[],attrs=''){
    const options=existingSourceOptions();
    if(!options.length)return '<div class="source-tag-empty">No existing CRM sources yet.</div>';
    const chosen=new Set((selected||[]).map(v=>String(v).toLowerCase()));
    return `<div class="source-tag-picker" ${attrs}>${options.map(source=>`<button class="source-tag-chip ${sourceClass(source)} ${chosen.has(source.toLowerCase())?'selected':''}" type="button" data-source-value="${esc(source)}"><i class="bi ${chosen.has(source.toLowerCase())?'bi-check-circle-fill':'bi-circle'}"></i>${esc(source)}</button>`).join('')}</div>`;
  }

  function toggleSource(list,source){
    const value=String(source||'').trim();
    if(!value)return list;
    const index=list.findIndex(item=>String(item).toLowerCase()===value.toLowerCase());
    if(index>=0)list.splice(index,1);else list.push(value);
    return list;
  }


  async function load(){
    try{
      db=await initStagingClient();
      const [crm,sites]=await Promise.all([db.from('crm').select('*').order('company',{ascending:true}),listSites()]);
      if(crm.error)throw crm.error;
      leads=crm.data||[];projects=sites;
      renderList();
      if(active){active=leads.find(lead=>lead.id===active.id)||null;if(active){activeProject=projectFor(active);renderDetail()}else showList()}
    }catch(error){message(error.message,true)}
  }

  function badge(label,state){return `<span class="build-pill ${state}">${esc(label)}</span>`}
  function renderList(){
    const q=String(document.getElementById('stagingSearch').value||'').trim().toLowerCase();
    let matches=leads.filter(lead=>!q||[lead.company,lead.name,lead.phone,lead.email,lead.sitekey].some(value=>String(value||'').toLowerCase().includes(q)));
    if(filterMode==='website')matches=matches.filter(needsWebsite);
    if(filterMode==='admin')matches=matches.filter(needsAdmin);
    const websiteCount=leads.filter(needsWebsite).length,adminCount=leads.filter(needsAdmin).length;
    message(`${matches.length} shown · ${leads.length} total · ${websiteCount} need website · ${adminCount} need admin`);
    listEl.innerHTML=matches.map(lead=>{
      const ws=websiteReady(lead),as=adminState(lead),p=projectFor(lead);
      const adminLabel=as==='ready'?'Admin Ready':as==='redirect'?'Admin Redirects':as==='error'?'Admin Error':'Needs Admin';
      const adminClass=as==='ready'?'ready':as==='error'||as==='redirect'?'error':'missing';
      return `<button class="card staging-lead" data-lead="${esc(lead.id)}" type="button"><span class="staging-lead-icon"><i class="bi bi-buildings"></i></span><span><strong>${esc(lead.company||'Unnamed business')}</strong><span>${esc(lead.name||'No contact')} · ${esc(lead.phone||'No phone')}</span><span>${esc(lead.sitekey||p?.sitekey||'No sitekey')}</span></span><span class="status-stack">${badge(ws?'Website Ready':'Needs Website',ws?'ready':'missing')}${ws?badge(adminLabel,adminClass):''}</span></button>`
    }).join('')||'<div class="empty"><div><i class="bi bi-check2-circle"></i><strong>Nothing in this staging queue.</strong></div></div>';
  }

  function showList(){active=null;activeProject=null;document.getElementById('stagingDirectory').hidden=false;document.getElementById('stagingDetail').hidden=true;renderList();window.scrollTo({top:0,behavior:'smooth'})}
  function openLead(id){active=leads.find(lead=>String(lead.id)===String(id));if(!active)return;activeProject=projectFor(active);crmConnectSelectedId=String(activeProject?.lead_id||active.id||'');crmConnectQuery='';crmConnectTags=[...(Array.isArray(active.sources)?active.sources:[])];crmNewMode=false;crmNewDraft={company:'',name:'',phone:'',email:''};crmNewTagsOpen=false;document.getElementById('stagingDirectory').hidden=true;document.getElementById('stagingDetail').hidden=false;renderDetail();window.scrollTo({top:0,behavior:'smooth'})}

  function currentSiteKey(){return String(activeProject?.sitekey||active?.sitekey||slug(active?.company)||'').trim()}
  function currentPreview(){
    const key=currentSiteKey();
    return String(activeProject?.previewurl||active?.previewurl||(key?siteUrl(key):'')).trim();
  }
  function currentAdmin(){return String(activeProject?.adminurl||adminUrl(currentSiteKey())).trim()}


  function connectedLeadForProject(project=activeProject){
    if(!project?.lead_id)return null;
    return leads.find(lead=>String(lead.id)===String(project.lead_id))||null;
  }

  function crmConnectionMatches(){
    const q=String(crmConnectQuery||'').trim().toLowerCase();
    return leads.filter(lead=>{
      if(!q)return true;
      return [lead.company,lead.name,lead.phone,lead.email]
        .some(value=>String(value||'').toLowerCase().includes(q));
    }).slice(0,30);
  }

  function renderCrmConnectionPanel(){
    const connected=connectedLeadForProject();
    if(connected&&!crmConnectSelectedId)crmConnectSelectedId=String(connected.id);

    const matches=crmConnectionMatches();
    const selected=leads.find(lead=>String(lead.id)===String(crmConnectSelectedId))||null;

    return `
      <section class="crm-connect-card">
        <div class="crm-connect-head">
          <div>
            <span class="crm-connect-kicker">CRM CONNECTION</span>
            <h3>${connected?'Connected to CRM':'Connect this site to a CRM record'}</h3>
            <p>${connected
              ? `${esc(connected.company||'Unnamed business')} · ${esc(connected.name||connected.phone||'No contact')}`
              : 'Choose an existing CRM record or create a new one.'}</p>
          </div>
          <span class="connection-pill ${connected?'connected':'unconnected'}">
            <i class="bi ${connected?'bi-link-45deg':'bi-link'}"></i>
            ${connected?'Connected':'Unconnected'}
          </span>
        </div>

        <div class="crm-connect-switch">
          <button class="btn secondary ${!crmNewMode?'active-choice':''}" type="button" data-existing-crm>Existing CRM</button>
          <button class="btn secondary ${crmNewMode?'active-choice':''}" type="button" data-new-crm>+ New CRM</button>
        </div>

        ${crmNewMode?`
          <div class="new-crm-form">
            <div class="new-crm-grid">
              <label><span>Business name</span><input data-new-crm-field="company" value="${esc(crmNewDraft.company||'')}" placeholder="Business name"></label>
              <label><span>Contact name</span><input data-new-crm-field="name" value="${esc(crmNewDraft.name||'')}" placeholder="Owner / contact"></label>
              <label><span>Phone</span><input data-new-crm-field="phone" value="${esc(crmNewDraft.phone||'')}" placeholder="Phone number"></label>
              <label><span>Email</span><input data-new-crm-field="email" value="${esc(crmNewDraft.email||'')}" placeholder="Email"></label>
            </div>
            <div class="crm-connect-actions new-crm-actions">
              <button class="btn" type="button" data-create-connect-crm><i class="bi bi-person-plus-fill"></i> Create CRM & Connect</button>
              <button class="btn secondary tags-toggle-btn ${crmNewTagsOpen?'active-choice':''}" type="button" data-toggle-new-crm-tags><i class="bi bi-tags-fill"></i> Tags</button>
            </div>
            ${crmNewTagsOpen?`<div class="source-tag-block tag-panel-after-actions">
              <strong>Where was this lead found?</strong>
              <small>Choose from sources already used in the CRM.</small>
              ${sourcePickerHTML(crmConnectTags,'data-single-tag-picker')}
            </div>`:''}
          </div>
        `:`
          <label class="crm-connect-search">
            <i class="bi bi-search"></i>
            <input id="crmConnectSearch" type="search" value="${esc(crmConnectQuery)}" placeholder="Search company, name, phone, or email…">
          </label>

          <div class="crm-connect-results" id="crmConnectResults">
            ${matches.length?matches.map(lead=>{
              const isSelected=String(lead.id)===String(crmConnectSelectedId);
              return `<button class="crm-result ${isSelected?'selected':''}" type="button" data-crm-select="${esc(lead.id)}">
                <span class="crm-result-main">
                  <strong>${esc(lead.company||'Unnamed business')}</strong>
                  <small>${esc([lead.name,lead.phone,lead.email].filter(Boolean).join(' · ')||'No contact information')}</small>
                </span>
                <i class="bi ${isSelected?'bi-check-circle-fill':'bi-circle'}"></i>
              </button>`;
            }).join(''):'<div class="crm-connect-empty">No CRM records match this search.</div>'}
          </div>

          <div class="source-tag-block">
            <strong>Add sources</strong>
            <small>These are the source values already used in Supabase CRM. Selected sources will be added to the CRM record when you connect it.</small>
            ${sourcePickerHTML(crmConnectTags,'data-single-tag-picker')}
          </div>

          <div class="crm-connect-actions">
            ${connected?'<button class="btn secondary disconnect-btn" type="button" data-disconnect-crm><i class="bi bi-link-45deg"></i> Disconnect</button>':''}
            <button class="btn" type="button" data-connect-crm ${selected?'':'disabled'}>
              <i class="bi bi-link-45deg"></i> ${connected?'Save Connection':'Connect & Save'}
            </button>
          </div>
        `}
        <div class="connection-status" id="connectionStatus"></div>
      </section>`;
  }

  async function createNewCrmAndConnect(){
    const company=String(crmNewDraft.company||'').trim();
    if(!company)throw Error('Business name is required.');
    const now=new Date().toISOString();
    const payload={
      company,
      name:String(crmNewDraft.name||'').trim(),
      phone:String(crmNewDraft.phone||'').trim(),
      email:String(crmNewDraft.email||'').trim(),
      sources:mergeSources([],crmConnectTags),
      updated:now
    };
    const {data,error}=await db.from('crm').insert(payload).select().single();
    if(error)throw error;
    leads.push(data);
    crmConnectSelectedId=String(data.id);
    active=data;
    crmNewMode=false;
    await connectCrm();
  }

  async function publishActiveProjectToGithub(siteKey){
    if(!activeProject?.id)throw Error('Create or upload the site before publishing.');
    const files=activeProject.files||[];
    if(!files.length)throw Error('No uploaded site files are available to push to GitHub.');

    const form=new FormData();
    for(const file of files){
      const blob=await downloadSiteFile(activeProject.id,file.path);
      const cleanPath=String(file.path||'').replace(/^\/+/,'');
      const rootedPath=cleanPath.startsWith(siteKey+'/')?cleanPath:`${siteKey}/${cleanPath}`;
      form.append('files',blob,cleanPath.split('/').pop()||'file');
      form.append('paths',rootedPath);
    }

    const {data:sessionData}=await db.auth.getSession();
    const token=sessionData?.session?.access_token;
    if(!token)throw Error('Your dashboard session expired. Sign in again.');

    const response=await fetch(
      'https://glonbvrcudwuzjundrii.supabase.co/functions/v1/publish-viewyoursite-bulk',
      {method:'POST',headers:{Authorization:`Bearer ${token}`},body:form}
    );

    const text=await response.text();
    let data={};
    try{data=text?JSON.parse(text):{}}catch{data={error:text}}

    if(!response.ok||data?.error){
      throw Error(data?.error||`GitHub push failed (${response.status})`);
    }

    return data;
  }

  async function connectCrm(){
    const target=leads.find(lead=>String(lead.id)===String(crmConnectSelectedId));
    if(!target)throw Error('Select a CRM record first.');

    const key=String(document.getElementById('siteKeyInput')?.value||currentSiteKey()).trim();
    if(!key)throw Error('Site key is required before connecting.');

    const preview=siteUrl(key);
    const admin=String(document.getElementById('adminUrlInput')?.value||adminUrl(key)).trim();

    message('Saving CRM connection…');
    const connectionStatus=document.getElementById('connectionStatus');
    if(connectionStatus){
      connectionStatus.className='connection-status working';
      connectionStatus.textContent='Saving connection…';
    }

    const project=await ensureProject({
      sitekey:key,
      previewurl:preview,
      adminurl:admin
    });

    // If this site was previously attached to another CRM record, clear that old CRM record.
    const oldCrmId=project.lead_id;
    if(oldCrmId&&String(oldCrmId)!==String(target.id)){
      const {error:oldError}=await db.from('crm').update({
        sitekey:null,
        previewurl:null,
        updated:new Date().toISOString()
      }).eq('id',oldCrmId);
      if(oldError)throw oldError;
    }

    await updateSite(project.id,{
      crmid:target.id,
      sitekey:key,
      previewurl:preview,
      adminurl:admin
    });

    const mergedSources=mergeSources(target.sources,crmConnectTags);
    const {error:crmError}=await db.from('crm').update({
      sitekey:key,
      previewurl:preview,
      sources:mergedSources,
      updated:new Date().toISOString()
    }).eq('id',target.id);
    if(crmError)throw crmError;

    Object.assign(project,{lead_id:target.id,crmid:target.id,sitekey:key,previewurl:preview,adminurl:admin});
    Object.assign(target,{sitekey:key,previewurl:preview,sources:mergedSources});

    if(connectionStatus){
      connectionStatus.className='connection-status working';
      connectionStatus.textContent='CRM saved. Pushing site to GitHub…';
    }

    try{
      await publishActiveProjectToGithub(key);
      if(connectionStatus){
        connectionStatus.className='connection-status success';
        connectionStatus.textContent=`Connected and pushed successfully · ${preview}`;
      }
      message(`Connected to ${target.company||target.name||'CRM'} and pushed to GitHub.`);
    }catch(error){
      if(connectionStatus){
        connectionStatus.className='connection-status error';
        connectionStatus.textContent=`CRM connection saved, but GitHub push was unsuccessful: ${error.message||error}`;
      }
      message(`CRM saved, but GitHub push was unsuccessful: ${error.message||error}`,true);
    }

    active=target;
    activeProject=project;
    renderDetail();
  }

  async function disconnectCrm(){
    if(!activeProject?.id)throw Error('This site is not connected to a saved project.');
    const connected=connectedLeadForProject();
    if(!connected)throw Error('This site is already unconnected.');

    const oldId=connected.id;

    await updateSite(activeProject.id,{crmid:null});

    const {error}=await db.from('crm').update({
      sitekey:null,
      previewurl:null,
      updated:new Date().toISOString()
    }).eq('id',oldId);
    if(error)throw error;

    activeProject.lead_id='';
    activeProject.crmid=null;
    connected.sitekey=null;
    connected.previewurl=null;
    active=null;
    crmConnectSelectedId='';

    message('Site disconnected from CRM and saved.');
    renderDetail();
  }

  function renderDetail(){
    const connected=connectedLeadForProject();
    const record=connected||active||{};
    const projectName=activeProject?.name||activeProject?.sitekey||'Unnamed site';

    document.getElementById('detailCompany').textContent=record.company||projectName;
    document.getElementById('detailContact').textContent=[record.name,record.email,record.phone].filter(Boolean).join(' · ')||(connected?'No contact information':'Not connected to CRM');

    const files=activeProject?.files||[],ws=websiteReady(record),as=adminState(record),key=currentSiteKey(),preview=currentPreview(),admin=currentAdmin();
    const statusText=as==='ready'?'Ready':as==='redirect'?'Redirects':as==='error'?'Check failed':'Missing / unchecked';
    document.getElementById('uploadWorkspace').innerHTML=`
      ${renderCrmConnectionPanel()}
      <div class="links-card">
        <div class="links-grid">
          <label><span>Site key</span><input id="siteKeyInput" value="${esc(key)}"></label>
          <label><span>Preview URL</span><input id="previewUrlInput" value="${esc(preview)}"></label>
          <label><span>Admin URL</span><input id="adminUrlInput" value="${esc(admin)}"></label>
          <label><span>Last admin check</span><input value="${esc(activeProject?.adminchecked?new Date(activeProject.adminchecked).toLocaleString():'Never')}" disabled></label>
        </div>
        <div class="status-line">${badge(ws?'Website Ready':'Needs Website',ws?'ready':'missing')}${badge(`Admin: ${statusText}`,as==='ready'?'ready':as==='error'||as==='redirect'?'error':'missing')}</div>
        <div class="link-actions">
          <button class="btn secondary" data-save-links>Save Links</button>
          <button class="btn secondary" data-open-preview>Open Website</button>
          <button class="btn secondary" data-open-admin>Open Admin</button>
          <button class="btn secondary" data-check-admin>Check Admin</button>
          <button class="btn secondary" data-admin-ready>Mark Admin Ready</button>
          <button class="btn secondary" data-admin-missing>Mark Admin Missing</button>
        </div>
      </div>
      <div class="upload-head"><div class="company"><strong>${esc(record.company||projectName)}</strong><span>${esc(record.name||(connected?'No contact':'Not connected to CRM'))}</span></div><span class="badge">${needsWebsite(record)?'Needs Website':needsAdmin(record)?'Needs Admin':'Ready'}</span></div>
      <div class="drop-zone" data-drop><i class="bi bi-envelope-arrow-up-fill"></i><strong>Drag and drop website or admin files</strong><span>For an admin build, include the admin folder/page in the files you upload.</span><div class="drop-actions"><button class="btn secondary" data-files>Choose Files</button><button class="btn secondary" data-folder>Choose Folder</button></div></div>
      <div class="file-summary"><strong>${files.length} files · ${fmt(size(activeProject))}</strong><span>25 MB maximum</span></div>
      <div class="file-list">${files.map(file=>`<span><i class="bi bi-file-earmark-code"></i>${esc(file.path)}<small>${fmt(file.size)}</small></span>`).join('')||'<em>No files attached.</em>'}</div>
      <div class="review-actions"><button class="btn" data-review ${files.length?'':'disabled'}>Send to Review</button></div>`;
  }

  async function ensureProject(extra={}){
    if(activeProject)return activeProject;
    const record=active||{};
    const key=extra.sitekey||currentSiteKey();
    activeProject=await createSite({
      leadId:record.id||null,
      company:record.company||key||'Unnamed site',
      contactName:record.name||'',
      email:record.email||'',
      phone:record.phone||'',
      sitekey:key,
      previewurl:extra.previewurl||record.previewurl||null,
      adminurl:extra.adminurl||null,
      adminstatus:extra.adminstatus||null
    });
    projects.push(activeProject);
    return activeProject;
  }

  async function saveLinks(){
    const key=String(document.getElementById('siteKeyInput').value||'').trim();
    if(!key)throw Error('Site key is required.');
    const preview=String(document.getElementById('previewUrlInput').value||'').trim()||siteUrl(key);
    const admin=String(document.getElementById('adminUrlInput').value||'').trim()||adminUrl(key);
    const p=await ensureProject({sitekey:key,previewurl:preview,adminurl:admin});
    await updateSite(p.id,{sitekey:key,previewurl:preview,adminurl:admin,adminstatus:p.adminurl===admin?p.adminstatus||'unchecked':'unchecked',adminchecked:p.adminurl===admin?p.adminchecked||null:null,adminfinalurl:p.adminurl===admin?p.adminfinalurl||null:null});
    Object.assign(p,{sitekey:key,previewurl:preview,adminurl:admin,adminstatus:p.adminurl===admin?p.adminstatus||'unchecked':'unchecked'});
    const connected=connectedLeadForProject()||active;
    if(connected?.id){
      const {error}=await db.from('crm').update({sitekey:key,previewurl:preview,updated:new Date().toISOString()}).eq('id',connected.id);
      if(error)throw error;
      Object.assign(connected,{sitekey:key,previewurl:preview});
      active=connected;
    }
    message('Links saved.');renderDetail();
  }

  async function checkAdmin(){
    await saveLinks();
    const p=activeProject,url=p.adminurl||currentAdmin();message('Checking admin page…');
    let result=null;
    try{
      const invoke=await db.functions.invoke('check-admin-page',{body:{url}});
      if(!invoke.error&&invoke.data)result=invoke.data;
    }catch(_){}
    if(!result){
      try{
        const response=await fetch(url,{method:'GET',redirect:'manual'});
        if(response.type==='opaqueredirect'||(response.status>=300&&response.status<400))result={status:'redirect',valid:false,httpStatus:response.status,finalUrl:''};
        else if(response.ok)result={status:'valid',valid:true,httpStatus:response.status,finalUrl:url};
        else result={status:'missing',valid:false,httpStatus:response.status,finalUrl:url};
      }catch(error){result={status:'error',valid:false,finalUrl:'',error:'Automatic check unavailable. Open the admin link and use Mark Admin Ready/Missing.'}}
    }
    const checked=new Date().toISOString(),state=String(result.status||'error');
    await updateSite(p.id,{adminstatus:state,adminchecked:checked,adminfinalurl:result.finalUrl||''});
    Object.assign(p,{adminstatus:state,adminchecked:checked,adminfinalurl:result.finalUrl||''});
    message(state==='valid'?'Admin page is ready.':state==='redirect'?'Admin page redirects and needs work.':state==='missing'?'Admin page is missing.':'Could not automatically verify admin page.',state==='error');
    renderDetail();
  }

  async function markAdmin(state){const p=await ensureProject({sitekey:currentSiteKey(),previewurl:currentPreview(),adminurl:currentAdmin()});const checked=new Date().toISOString();await updateSite(p.id,{adminurl:currentAdmin(),adminstatus:state,adminchecked:checked,adminfinalurl:state==='valid'?currentAdmin():''});Object.assign(p,{adminurl:currentAdmin(),adminstatus:state,adminchecked:checked,adminfinalurl:state==='valid'?currentAdmin():''});message(state==='valid'?'Admin marked ready.':'Admin marked missing.');renderDetail()}

  async function add(input){const project=await ensureProject(),files=[...input].filter(file=>file.name!=='.DS_Store'&&!String(file.webkitRelativePath||file.pipelinePath).includes('node_modules')&&!String(file.webkitRelativePath||file.pipelinePath).includes('/.git/'));if(size(project)+files.reduce((n,file)=>n+file.size,0)>MAX)return message('This website exceeds 25 MB.',true);for(const file of files){const path=file.pipelinePath||file.webkitRelativePath||file.name;await uploadSiteFile(project.id,path,file);const meta={path,size:file.size,type:file.type||'application/octet-stream'},index=(project.files||[]).findIndex(item=>item.path===path);project.files=project.files||[];index>=0?project.files[index]=meta:project.files.push(meta)}await updateSite(project.id,{files:project.files});message(`${files.length} files uploaded.`);renderDetail()}
  function entry(item,path=''){return new Promise(resolve=>{if(item.isFile)item.file(file=>{file.pipelinePath=path+file.name;resolve([file])});else{const reader=item.createReader(),all=[];const next=()=>reader.readEntries(async entries=>{if(!entries.length)return resolve(all);for(const child of entries)all.push(...await entry(child,`${path}${item.name}/`));next()});next()}})}
  async function dropped(dt){const entries=[...(dt.items||[])].map(item=>item.webkitGetAsEntry?.()).filter(Boolean),out=[];if(!entries.length)return[...dt.files];for(const item of entries)out.push(...await entry(item));return out}

  function copyListRows(mode='all'){
    let rows=[...leads];
    if(mode==='website')rows=rows.filter(needsWebsite);
    if(mode==='admin')rows=rows.filter(needsAdmin);
    const keys=rows.map(lead=>{const p=projectFor(lead);return slug(lead.sitekey||p?.sitekey||lead.company||lead.name)}).filter(Boolean);
    return keys.join('\n');
  }
  async function copyQueueList(mode,label){
    const text=copyListRows(mode);
    if(!text){message(`No ${label.toLowerCase()} items to copy.`,true);return}
    await navigator.clipboard.writeText(text);
    message(`${text.split('\n').length} ${label.toLowerCase()} item${text.includes('\n')?'s':''} copied.`);
  }

  function bulkRelativePath(file){return String(file.webkitRelativePath||file.pipelinePath||file.name||'').replace(/^\/+/, '').replace(/\\/g,'/');}

  function bulkFolders(){
    const folders=new Map();
    for(const file of bulkFiles){
      const path=bulkRelativePath(file),root=path.split('/')[0]||'unknown';
      if(!folders.has(root))folders.set(root,[]);
      folders.get(root).push(file);
    }
    return folders;
  }

  function renderBulkQueue(){
    const list=document.getElementById('bulkDropList'),summary=document.getElementById('bulkDropSummary'),action=document.getElementById('pushBulkGithub');
    if(!list||!summary||!action)return;
    const rows=[...bulkFolders().entries()];
    const allLinked=rows.length>0&&rows.every(([name])=>Boolean(bulkFolderLinks[name]));
    const readyToPush=allLinked&&bulkConnectionsSaved;

    summary.innerHTML=`<strong>${rows.length} folder${rows.length===1?'':'s'} · ${bulkFiles.length} file${bulkFiles.length===1?'':'s'}</strong><span>${readyToPush?'CRM connected · ready for GitHub':'Connect every folder to CRM first'}</span>`;
    list.innerHTML=rows.length?rows.map(([name,files])=>{
      const lead=leads.find(item=>String(item.id)===String(bulkFolderLinks[name]));
      return `<span><i class="bi bi-folder2-open"></i>${esc(name)}<small>${lead?`CRM: ${esc(lead.company||lead.name||'Connected')}${bulkConnectionsSaved?' · saved':''}`:`${files.length} file${files.length===1?'':'s'} · CRM not connected`}</small></span>`;
    }).join(''):'<em>No folders queued.</em>';

    action.disabled=!bulkFiles.length;
    action.textContent=readyToPush?'Push All to GitHub':'Connect to CRM';
    action.dataset.mode=readyToPush?'push':'crm';
  }

  function queueBulkFiles(files){
    const incoming=[...files].filter(file=>file.name!=='.DS_Store'&&!bulkRelativePath(file).includes('/node_modules/')&&!bulkRelativePath(file).includes('/.git/'));
    const byPath=new Map(bulkFiles.map(file=>[bulkRelativePath(file),file]));
    for(const file of incoming){const path=bulkRelativePath(file);if(path&&path.includes('/'))byPath.set(path,file)}
    bulkFiles=[...byPath.values()];
    bulkConnectionsSaved=false;
    const liveFolders=new Set([...bulkFolders().keys()]);
    Object.keys(bulkFolderLinks).forEach(name=>{if(!liveFolders.has(name))delete bulkFolderLinks[name]});
    Object.keys(bulkFolderSearch).forEach(name=>{if(!liveFolders.has(name))delete bulkFolderSearch[name]});
    Object.keys(bulkFolderTags).forEach(name=>{if(!liveFolders.has(name))delete bulkFolderTags[name]});
    Object.keys(bulkFolderNewMode).forEach(name=>{if(!liveFolders.has(name))delete bulkFolderNewMode[name]});
    Object.keys(bulkFolderNewDraft).forEach(name=>{if(!liveFolders.has(name))delete bulkFolderNewDraft[name]});
    renderBulkQueue();
    message(`${incoming.length} file${incoming.length===1?'':'s'} added to local bulk queue.`);
  }

  function bulkLeadMatches(folder){
    const q=String(bulkFolderSearch[folder]||'').trim().toLowerCase();
    return leads.filter(lead=>!q||[lead.company,lead.name,lead.phone,lead.email].some(value=>String(value||'').toLowerCase().includes(q))).slice(0,25);
  }

  function renderBulkConnectModal(){
    const list=document.getElementById('bulkConnectList'),status=document.getElementById('bulkConnectStatus'),confirm=document.getElementById('confirmBulkPush');
    const folders=[...bulkFolders().entries()];
    list.innerHTML=folders.map(([folder,files])=>{
      const selectedId=bulkFolderLinks[folder]||'',selected=leads.find(lead=>String(lead.id)===String(selectedId)),matches=bulkLeadMatches(folder);
      const newMode=Boolean(bulkFolderNewMode[folder]);
      const draft=bulkFolderNewDraft[folder]||{company:folder.replace(/-/g,' '),name:'',phone:'',email:''};
      const selectedTags=bulkFolderTags[folder]||(selected&&Array.isArray(selected.sources)?[...selected.sources]:[]);
      return `<section class="folder-connect-card">
        <div class="folder-connect-head"><div><strong>${esc(folder)}</strong><small>${files.length} file${files.length===1?'':'s'} · https://viewyoursite.today/Sites/${esc(folder)}/</small></div><span class="folder-connect-state ${selected?'connected':''}">${selected?'Connected':newMode?'New CRM':'Choose CRM'}</span></div>

        <div class="crm-connect-switch compact">
          <button class="btn secondary ${!newMode?'active-choice':''}" type="button" data-folder-existing="${esc(folder)}">Existing CRM</button>
          <button class="btn secondary ${newMode?'active-choice':''}" type="button" data-folder-new="${esc(folder)}">+ New CRM</button>
        </div>

        ${newMode?`
          <div class="new-crm-form compact">
            <div class="new-crm-grid">
              <label><span>Business name</span><input data-folder-new-field="company" data-folder-new-name="${esc(folder)}" value="${esc(draft.company||'')}" placeholder="Business name"></label>
              <label><span>Contact name</span><input data-folder-new-field="name" data-folder-new-name="${esc(folder)}" value="${esc(draft.name||'')}" placeholder="Owner / contact"></label>
              <label><span>Phone</span><input data-folder-new-field="phone" data-folder-new-name="${esc(folder)}" value="${esc(draft.phone||'')}" placeholder="Phone number"></label>
              <label><span>Email</span><input data-folder-new-field="email" data-folder-new-name="${esc(folder)}" value="${esc(draft.email||'')}" placeholder="Email"></label>
            </div>
            <div class="crm-connect-actions new-crm-actions">
              <button class="btn" type="button" data-create-folder-crm="${esc(folder)}"><i class="bi bi-person-plus-fill"></i> Add New CRM</button>
              <button class="btn secondary tags-toggle-btn ${bulkFolderTagsOpen[folder]?'active-choice':''}" type="button" data-toggle-folder-tags="${esc(folder)}"><i class="bi bi-tags-fill"></i> Tags</button>
            </div>
            ${bulkFolderTagsOpen[folder]?`<div class="source-tag-block tag-panel-after-actions">
              <strong>Where was this lead found?</strong>
              <small>Choose from sources already used in the CRM.</small>
              ${sourcePickerHTML(selectedTags,`data-folder-tag-picker="${esc(folder)}"`)}
            </div>`:''}
          </div>
        `:`
          <label class="folder-crm-search"><i class="bi bi-search"></i><input type="search" data-folder-search="${esc(folder)}" value="${esc(bulkFolderSearch[folder]||'')}" placeholder="Search CRM by business, name, phone, or email…"></label>
          <div class="folder-crm-results">${matches.length?matches.map(lead=>{const chosen=String(lead.id)===String(selectedId);return `<button class="folder-crm-option ${chosen?'selected':''}" type="button" data-folder="${esc(folder)}" data-folder-crm="${esc(lead.id)}"><span><strong>${esc(lead.company||'Unnamed business')}</strong><small>${esc([lead.name,lead.phone,lead.email].filter(Boolean).join(' · ')||'No contact information')}</small></span><i class="bi ${chosen?'bi-check-circle-fill':'bi-circle'}"></i></button>`}).join(''):'<div class="crm-connect-empty">No CRM records match this search.</div>'}</div>
          <div class="source-tag-block">
            <strong>Add sources</strong>
            <small>Selected sources will be added to the CRM record when the connection is saved.</small>
            ${sourcePickerHTML(selectedTags,`data-folder-tag-picker="${esc(folder)}"`)}
          </div>
        `}
      </section>`;
    }).join('');
    const missing=folders.filter(([folder])=>!bulkFolderLinks[folder]);
    confirm.disabled=!folders.length||missing.length>0;
    status.className='status';
    status.textContent=missing.length?`Connect ${missing.length} folder${missing.length===1?'':'s'} to CRM before continuing.`:'All folders have a CRM record. Save the CRM connections to continue.';
  }

  async function createBulkCrm(folder){
    const draft=bulkFolderNewDraft[folder]||{};
    const company=String(draft.company||'').trim();
    if(!company)throw Error(`Business name is required for ${folder}.`);
    const sources=mergeSources([],bulkFolderTags[folder]||[]);
    const {data,error}=await db.from('crm').insert({
      company,
      name:String(draft.name||'').trim(),
      phone:String(draft.phone||'').trim(),
      email:String(draft.email||'').trim(),
      sources,
      updated:new Date().toISOString()
    }).select().single();
    if(error)throw error;
    leads.push(data);
    bulkFolderLinks[folder]=data.id;
    bulkFolderTags[folder]=[...(Array.isArray(data.sources)?data.sources:[])];
    bulkFolderNewMode[folder]=false;
    bulkFolderTagsOpen[folder]=false;
    bulkConnectionsSaved=false;
    renderBulkConnectModal();
    renderBulkQueue();
  }

  function openBulkConnect(){if(!bulkFiles.length)return;document.getElementById('bulkConnectModal').hidden=false;document.body.style.overflow='hidden';renderBulkConnectModal()}
  function closeBulkConnect(){document.getElementById('bulkConnectModal').hidden=true;document.body.style.overflow=''}

  async function saveBulkConnection(folder,leadId){
    const lead=leads.find(item=>String(item.id)===String(leadId));
    if(!lead)throw Error(`CRM record for ${folder} could not be found.`);
    const preview=`https://viewyoursite.today/Sites/${encodeURIComponent(folder)}/`;
    let project=projects.find(item=>String(item.sitekey||'').toLowerCase()===String(folder).toLowerCase())||projects.find(item=>String(item.lead_id||'')===String(lead.id));

    if(project){
      const previousCrm=project.lead_id;
      if(previousCrm&&String(previousCrm)!==String(lead.id)){
        const {error:oldError}=await db.from('crm').update({sitekey:null,previewurl:null,updated:new Date().toISOString()}).eq('id',previousCrm);
        if(oldError)throw oldError;
      }
      await updateSite(project.id,{crmid:lead.id,sitekey:folder,previewurl:preview});
      Object.assign(project,{crmid:lead.id,lead_id:lead.id,sitekey:folder,previewurl:preview});
    }else{
      project=await createSite({leadId:lead.id,company:lead.company||folder,contactName:lead.name||'',email:lead.email||'',phone:lead.phone||'',sitekey:folder,previewurl:preview});
      projects.push(project);
    }

    const mergedSources=mergeSources(lead.sources,bulkFolderTags[folder]||[]);
    const {error}=await db.from('crm').update({sitekey:folder,previewurl:preview,sources:mergedSources,updated:new Date().toISOString()}).eq('id',lead.id);
    if(error)throw error;
    Object.assign(lead,{sitekey:folder,previewurl:preview,sources:mergedSources});
  }

  async function saveBulkCrmConnections(){
    if(!bulkFiles.length)return;
    const folders=[...bulkFolders().keys()];
    const missing=folders.filter(folder=>!bulkFolderLinks[folder]);
    if(missing.length){openBulkConnect();return}

    const button=document.getElementById('confirmBulkPush'),status=document.getElementById('bulkConnectStatus');
    button.disabled=true;
    button.textContent='Saving CRM…';
    status.className='status';
    status.textContent='Saving CRM connections and sources…';

    try{
      for(const folder of folders)await saveBulkConnection(folder,bulkFolderLinks[folder]);
      bulkConnectionsSaved=true;
      status.className='status success';
      status.textContent='CRM connections saved. You can now push all folders to GitHub.';
      renderBulkQueue();
      renderList();
      setTimeout(()=>{
        closeBulkConnect();
        message('CRM connections saved. Next step: Push All to GitHub.');
      },450);
    }catch(error){
      bulkConnectionsSaved=false;
      status.className='status error';
      status.textContent=`Unsuccessful: ${error.message||error}`;
      message(`Unsuccessful: ${error.message||error}`,true);
    }finally{
      button.textContent='Save CRM Connections';
      button.disabled=false;
    }
  }

  async function pushBulkGithub(){
    if(!bulkFiles.length)return;
    const folders=[...bulkFolders().keys()];
    const missing=folders.filter(folder=>!bulkFolderLinks[folder]);
    if(missing.length||!bulkConnectionsSaved){openBulkConnect();return}

    const action=document.getElementById('pushBulkGithub');
    action.disabled=true;
    action.textContent='Pushing to GitHub…';
    message('CRM is connected. Pushing folders to GitHub…');

    try{
      const form=new FormData();
      for(const file of bulkFiles){form.append('files',file,file.name);form.append('paths',bulkRelativePath(file))}
      const {data:sessionData}=await db.auth.getSession();
      const token=sessionData?.session?.access_token;
      if(!token)throw Error('Your dashboard session expired. Sign in again.');

      const response=await fetch('https://glonbvrcudwuzjundrii.supabase.co/functions/v1/publish-viewyoursite-bulk',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form});
      const text=await response.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={error:text}}
      if(!response.ok||data?.error)throw Error(data?.error||`Bulk publish failed (${response.status})`);

      const count=data.siteCount||folders.length;
      bulkFiles=[];bulkFolderLinks={};bulkFolderSearch={};bulkFolderTags={};bulkFolderNewMode={};bulkFolderTagsOpen={};bulkFolderNewDraft={};bulkConnectionsSaved=false;
      renderBulkQueue();
      renderList();
      message(`${count} site${count===1?'':'s'} pushed to GitHub successfully.`);
    }catch(error){
      message(`GitHub push unsuccessful: ${error.message||error}`,true);
      renderBulkQueue();
    }
  }

  document.getElementById('copyFullList').onclick=()=>copyQueueList('all','Full List');
  document.getElementById('copyNeedsSite').onclick=()=>copyQueueList('website','Needs Site');
  document.getElementById('copyNeedsAdmin').onclick=()=>copyQueueList('admin','Needs Admin');

  const bulkPanel=document.getElementById('bulkDropPanel'),bulkPicker=document.getElementById('bulkFolderPicker'),bulkZone=document.getElementById('bulkDropZone');
  document.getElementById('openBulkDrop').onclick=()=>{bulkPanel.hidden=!bulkPanel.hidden;if(!bulkPanel.hidden){renderBulkQueue();bulkPanel.scrollIntoView({behavior:'smooth',block:'start'})}};
  document.getElementById('chooseBulkFolders').onclick=()=>bulkPicker.click();
  bulkPicker.onchange=()=>{queueBulkFiles(bulkPicker.files);bulkPicker.value=''};
  document.getElementById('clearBulkDrop').onclick=()=>{bulkFiles=[];bulkFolderLinks={};bulkFolderSearch={};bulkFolderTags={};bulkFolderNewMode={};bulkFolderTagsOpen={};bulkFolderNewDraft={};bulkConnectionsSaved=false;renderBulkQueue();message('Local bulk queue cleared.')};
  document.getElementById('pushBulkGithub').onclick=()=>{const action=document.getElementById('pushBulkGithub');action.dataset.mode==='push'?pushBulkGithub():openBulkConnect()};
  bulkZone.ondragover=e=>{e.preventDefault();bulkZone.classList.add('dragging')};
  bulkZone.ondragleave=()=>bulkZone.classList.remove('dragging');
  bulkZone.ondrop=async e=>{e.preventDefault();bulkZone.classList.remove('dragging');try{queueBulkFiles(await dropped(e.dataTransfer))}catch(error){message(error.message,true)}};

  document.getElementById('closeBulkConnect').onclick=closeBulkConnect;
  document.getElementById('cancelBulkConnect').onclick=closeBulkConnect;
  document.getElementById('confirmBulkPush').onclick=saveBulkCrmConnections;
  document.getElementById('bulkConnectModal').onclick=e=>{if(e.target.id==='bulkConnectModal')closeBulkConnect()};
  document.getElementById('bulkConnectList').oninput=e=>{
    const search=e.target.closest('[data-folder-search]');
    if(search){
      bulkFolderSearch[search.dataset.folderSearch]=search.value;
      renderBulkConnectModal();
      const next=document.querySelector(`[data-folder-search="${CSS.escape(search.dataset.folderSearch)}"]`);
      if(next){next.focus();next.setSelectionRange(next.value.length,next.value.length)}
      return;
    }
    const field=e.target.closest('[data-folder-new-field]');
    if(field){
      const folder=field.dataset.folderNewName,key=field.dataset.folderNewField;
      bulkFolderNewDraft[folder]=bulkFolderNewDraft[folder]||{company:folder.replace(/-/g,' '),name:'',phone:'',email:''};
      bulkFolderNewDraft[folder][key]=field.value;
      bulkConnectionsSaved=false;
    }
  };
  document.getElementById('bulkConnectList').onclick=async e=>{
    const existing=e.target.closest('[data-folder-existing]');
    if(existing){bulkFolderNewMode[existing.dataset.folderExisting]=false;bulkFolderTagsOpen[existing.dataset.folderExisting]=false;bulkConnectionsSaved=false;renderBulkConnectModal();return}
    const newer=e.target.closest('[data-folder-new]');
    if(newer){
      const folder=newer.dataset.folderNew;
      bulkFolderNewMode[folder]=true;
      bulkConnectionsSaved=false;
      bulkFolderNewDraft[folder]=bulkFolderNewDraft[folder]||{company:folder.replace(/-/g,' '),name:'',phone:'',email:''};
      if(!bulkFolderTags[folder])bulkFolderTags[folder]=[];
      if(!(folder in bulkFolderTagsOpen))bulkFolderTagsOpen[folder]=false;
      renderBulkConnectModal();return
    }
    const toggleFolderTags=e.target.closest('[data-toggle-folder-tags]');
    if(toggleFolderTags){
      const folder=toggleFolderTags.dataset.toggleFolderTags;
      bulkFolderTagsOpen[folder]=!bulkFolderTagsOpen[folder];
      renderBulkConnectModal();return
    }
    const tag=e.target.closest('[data-folder-tag-picker] [data-source-value]');
    if(tag){
      const picker=tag.closest('[data-folder-tag-picker]'),folder=picker.dataset.folderTagPicker;
      bulkFolderTags[folder]=bulkFolderTags[folder]||[];
      toggleSource(bulkFolderTags[folder],tag.dataset.sourceValue);
      bulkConnectionsSaved=false;
      renderBulkConnectModal();return
    }
    const create=e.target.closest('[data-create-folder-crm]');
    if(create){
      try{await createBulkCrm(create.dataset.createFolderCrm)}
      catch(error){const st=document.getElementById('bulkConnectStatus');st.className='status error';st.textContent=error.message||String(error)}
      return
    }
    const button=e.target.closest('[data-folder-crm]');if(!button)return;
    bulkFolderLinks[button.dataset.folder]=button.dataset.folderCrm;
    bulkConnectionsSaved=false;
    const lead=leads.find(item=>String(item.id)===String(button.dataset.folderCrm));
    bulkFolderTags[button.dataset.folder]=[...(Array.isArray(lead?.sources)?lead.sources:[])];
    renderBulkConnectModal();renderBulkQueue();
  };
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.getElementById('bulkConnectModal').hidden)closeBulkConnect()});

  document.getElementById('stagingFilters').onclick=e=>{const b=e.target.closest('[data-filter]');if(!b)return;filterMode=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));renderList()};
  listEl.onclick=e=>{const b=e.target.closest('[data-lead]');if(b)openLead(b.dataset.lead)};
  document.getElementById('backToStaging').onclick=showList;
  document.getElementById('stagingSearch').oninput=renderList;
  document.getElementById('uploadWorkspace').oninput=e=>{
    const field=e.target.closest('[data-new-crm-field]');
    if(field){crmNewDraft[field.dataset.newCrmField]=field.value;return}
    if(e.target?.id!=='crmConnectSearch')return;
    crmConnectQuery=e.target.value;
    const results=document.getElementById('crmConnectResults');
    if(!results)return;
    const matches=crmConnectionMatches();
    results.innerHTML=matches.length?matches.map(lead=>{
      const isSelected=String(lead.id)===String(crmConnectSelectedId);
      return `<button class="crm-result ${isSelected?'selected':''}" type="button" data-crm-select="${esc(lead.id)}"><span class="crm-result-main"><strong>${esc(lead.company||'Unnamed business')}</strong><small>${esc([lead.name,lead.phone,lead.email].filter(Boolean).join(' · ')||'No contact information')}</small></span><i class="bi ${isSelected?'bi-check-circle-fill':'bi-circle'}"></i></button>`;
    }).join(''):'<div class="crm-connect-empty">No CRM records match this search.</div>';
  };
  document.getElementById('uploadWorkspace').onclick=async e=>{const b=e.target.closest('button');if(!b)return;try{
    if(b.hasAttribute('data-existing-crm')){crmNewMode=false;crmNewTagsOpen=false;renderDetail();return}
    if(b.hasAttribute('data-new-crm')){crmNewMode=true;crmConnectSelectedId='';crmConnectTags=[];crmNewTagsOpen=false;renderDetail();return}
    if(b.hasAttribute('data-toggle-new-crm-tags')){crmNewTagsOpen=!crmNewTagsOpen;renderDetail();return}
    if(b.closest('[data-single-tag-picker]')&&b.hasAttribute('data-tag-value')){toggleSource(crmConnectTags,b.dataset.sourceValue);renderDetail();return}
    if(b.hasAttribute('data-crm-select')){
      crmConnectSelectedId=b.dataset.crmSelect;
      const selectedLead=leads.find(lead=>String(lead.id)===String(crmConnectSelectedId));
      crmConnectTags=[...(Array.isArray(selectedLead?.sources)?selectedLead.sources:[])];
      renderDetail();
      return;
    }
    if(b.hasAttribute('data-create-connect-crm')){await createNewCrmAndConnect();return}
    if(b.hasAttribute('data-connect-crm')){await connectCrm();return}
    if(b.hasAttribute('data-disconnect-crm')){await disconnectCrm();return}
    if(b.hasAttribute('data-files'))filePicker.click();
    if(b.hasAttribute('data-folder'))folderPicker.click();
    if(b.hasAttribute('data-save-links'))await saveLinks();
    if(b.hasAttribute('data-open-preview'))window.open(document.getElementById('previewUrlInput').value,'_blank','noopener');
    if(b.hasAttribute('data-open-admin'))window.open(document.getElementById('adminUrlInput').value,'_blank','noopener');
    if(b.hasAttribute('data-check-admin'))await checkAdmin();
    if(b.hasAttribute('data-admin-ready'))await markAdmin('valid');
    if(b.hasAttribute('data-admin-missing'))await markAdmin('missing');
    if(b.hasAttribute('data-review')){const p=await ensureProject();await updateSite(p.id,{status:'review',returnNote:''});message('Sent to Review');showList()}
  }catch(error){
    const connectionStatus=document.getElementById('connectionStatus');
    if(connectionStatus&&(b.hasAttribute('data-connect-crm')||b.hasAttribute('data-disconnect-crm'))){
      connectionStatus.className='connection-status error';
      connectionStatus.textContent=`Unsuccessful: ${error.message||error}`;
    }
    message(error.message||String(error),true);
  }};
  for(const picker of[filePicker,folderPicker])picker.onchange=async()=>{try{await add(picker.files)}catch(error){message(error.message,true)}picker.value=''};
  document.getElementById('uploadWorkspace').ondragover=e=>{if(e.target.closest('[data-drop]'))e.preventDefault()};
  document.getElementById('uploadWorkspace').ondrop=async e=>{if(!e.target.closest('[data-drop]'))return;e.preventDefault();try{await add(await dropped(e.dataTransfer))}catch(error){message(error.message,true)}};
  load();
})();
