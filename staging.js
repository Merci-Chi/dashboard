(() => {
  const listEl=document.getElementById('stagingList'),status=document.getElementById('status'),filePicker=document.getElementById('filePicker'),folderPicker=document.getElementById('folderPicker');
  let db=null,leads=[],projects=[],active=null,activeProject=null,filterMode='all';
  const MAX=25*1024*1024;
  const fmt=n=>n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`;
  const size=x=>(x?.files||[]).reduce((n,f)=>n+(f.size||0),0);
  const message=(t,e=false)=>{status.textContent=t;status.classList.toggle('error',e)};
  const esc=v=>SitePipeline.escapeHTML(v);
  const slug=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const siteUrl=key=>`https://viewyoursite.today/Sites/${encodeURIComponent(String(key||'').trim())}/`;
  const adminUrl=key=>`${siteUrl(key)}admin/`;
  const previewUrl=(...values)=>{for(const value of values){const raw=String(value||'').trim();if(!raw)continue;try{const u=new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw)?raw:`https://${raw}`),h=u.hostname.toLowerCase().replace(/^www\./,'');if(h==='viewyoursite.today'||h.endsWith('.viewyoursite.today'))return u.href}catch{}}return''};
  const projectFor=lead=>projects.find(item=>String(item.lead_id)===String(lead.id))||projects.find(item=>item.sitekey&&lead.sitekey&&String(item.sitekey).toLowerCase()===String(lead.sitekey).toLowerCase())||null;
  const websiteReady=lead=>Boolean(previewUrl(lead.previewurl,lead.website,projectFor(lead)?.previewurl,projectFor(lead)?.liveurl));
  const adminState=lead=>{const p=projectFor(lead),state=String(p?.adminstatus||'').toLowerCase();if(state==='valid')return'ready';if(['missing','redirect','error'].includes(state))return state;return'missing'};
  const needsWebsite=lead=>!websiteReady(lead);
  const needsAdmin=lead=>websiteReady(lead)&&adminState(lead)!=='ready';
  const inQueue=lead=>needsWebsite(lead)||needsAdmin(lead);

  async function load(){
    try{
      db=await SitePipeline.init();
      const [crm,sites]=await Promise.all([db.from('crm').select('*').order('company',{ascending:true}),SitePipeline.list()]);
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
  function openLead(id){active=leads.find(lead=>String(lead.id)===String(id));if(!active)return;activeProject=projectFor(active);document.getElementById('stagingDirectory').hidden=true;document.getElementById('stagingDetail').hidden=false;renderDetail();window.scrollTo({top:0,behavior:'smooth'})}

  function currentSiteKey(){return String(activeProject?.sitekey||active?.sitekey||slug(active?.company)||'').trim()}
  function currentPreview(){return String(activeProject?.previewurl||active?.previewurl||siteUrl(currentSiteKey())).trim()}
  function currentAdmin(){return String(activeProject?.adminurl||adminUrl(currentSiteKey())).trim()}

  function renderDetail(){
    document.getElementById('detailCompany').textContent=active.company||'Unnamed business';
    document.getElementById('detailContact').textContent=[active.name,active.email,active.phone].filter(Boolean).join(' · ')||'No contact information';
    const files=activeProject?.files||[],ws=websiteReady(active),as=adminState(active),key=currentSiteKey(),preview=currentPreview(),admin=currentAdmin();
    const statusText=as==='ready'?'Ready':as==='redirect'?'Redirects':as==='error'?'Check failed':'Missing / unchecked';
    document.getElementById('uploadWorkspace').innerHTML=`
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
      <div class="upload-head"><div class="company"><strong>${esc(active.company||'Unnamed business')}</strong><span>${esc(active.name||'No contact')}</span></div><span class="badge">${needsWebsite(active)?'Needs Website':needsAdmin(active)?'Needs Admin':'Ready'}</span></div>
      <div class="drop-zone" data-drop><i class="bi bi-envelope-arrow-up-fill"></i><strong>Drag and drop website or admin files</strong><span>For an admin build, include the admin folder/page in the files you upload.</span><div class="drop-actions"><button class="btn secondary" data-files>Choose Files</button><button class="btn secondary" data-folder>Choose Folder</button></div></div>
      <div class="file-summary"><strong>${files.length} files · ${fmt(size(activeProject))}</strong><span>25 MB maximum</span></div>
      <div class="file-list">${files.map(file=>`<span><i class="bi bi-file-earmark-code"></i>${esc(file.path)}<small>${fmt(file.size)}</small></span>`).join('')||'<em>No files attached.</em>'}</div>
      <div class="review-actions"><button class="btn" data-review ${files.length?'':'disabled'}>Send to Review</button></div>`;
  }

  async function ensureProject(extra={}){
    if(activeProject)return activeProject;
    const key=extra.sitekey||currentSiteKey();
    activeProject=await SitePipeline.create({leadId:active.id,company:active.company,contactName:active.name,email:active.email,phone:active.phone,sitekey:key,previewurl:extra.previewurl||active.previewurl||null,adminurl:extra.adminurl||null,adminstatus:extra.adminstatus||null});
    projects.push(activeProject);return activeProject;
  }

  async function saveLinks(){
    const key=String(document.getElementById('siteKeyInput').value||'').trim();
    if(!key)throw Error('Site key is required.');
    const preview=String(document.getElementById('previewUrlInput').value||'').trim()||siteUrl(key);
    const admin=String(document.getElementById('adminUrlInput').value||'').trim()||adminUrl(key);
    const p=await ensureProject({sitekey:key,previewurl:preview,adminurl:admin});
    await SitePipeline.update(p.id,{sitekey:key,previewurl:preview,adminurl:admin,adminstatus:p.adminurl===admin?p.adminstatus||'unchecked':'unchecked',adminchecked:p.adminurl===admin?p.adminchecked||null:null,adminfinalurl:p.adminurl===admin?p.adminfinalurl||null:null});
    Object.assign(p,{sitekey:key,previewurl:preview,adminurl:admin,adminstatus:p.adminurl===admin?p.adminstatus||'unchecked':'unchecked'});
    const {error}=await db.from('crm').update({sitekey:key,previewurl:preview,updated:new Date().toISOString()}).eq('id',active.id);if(error)throw error;
    Object.assign(active,{sitekey:key,previewurl:preview});
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
    await SitePipeline.update(p.id,{adminstatus:state,adminchecked:checked,adminfinalurl:result.finalUrl||''});
    Object.assign(p,{adminstatus:state,adminchecked:checked,adminfinalurl:result.finalUrl||''});
    message(state==='valid'?'Admin page is ready.':state==='redirect'?'Admin page redirects and needs work.':state==='missing'?'Admin page is missing.':'Could not automatically verify admin page.',state==='error');
    renderDetail();
  }

  async function markAdmin(state){const p=await ensureProject({sitekey:currentSiteKey(),previewurl:currentPreview(),adminurl:currentAdmin()});const checked=new Date().toISOString();await SitePipeline.update(p.id,{adminurl:currentAdmin(),adminstatus:state,adminchecked:checked,adminfinalurl:state==='valid'?currentAdmin():''});Object.assign(p,{adminurl:currentAdmin(),adminstatus:state,adminchecked:checked,adminfinalurl:state==='valid'?currentAdmin():''});message(state==='valid'?'Admin marked ready.':'Admin marked missing.');renderDetail()}

  async function add(input){const project=await ensureProject(),files=[...input].filter(file=>file.name!=='.DS_Store'&&!String(file.webkitRelativePath||file.pipelinePath).includes('node_modules')&&!String(file.webkitRelativePath||file.pipelinePath).includes('/.git/'));if(size(project)+files.reduce((n,file)=>n+file.size,0)>MAX)return message('This website exceeds 25 MB.',true);for(const file of files){const path=file.pipelinePath||file.webkitRelativePath||file.name;await SitePipeline.upload(project.id,path,file);const meta={path,size:file.size,type:file.type||'application/octet-stream'},index=(project.files||[]).findIndex(item=>item.path===path);project.files=project.files||[];index>=0?project.files[index]=meta:project.files.push(meta)}await SitePipeline.update(project.id,{files:project.files});message(`${files.length} files uploaded.`);renderDetail()}
  function entry(item,path=''){return new Promise(resolve=>{if(item.isFile)item.file(file=>{file.pipelinePath=path+file.name;resolve([file])});else{const reader=item.createReader(),all=[];const next=()=>reader.readEntries(async entries=>{if(!entries.length)return resolve(all);for(const child of entries)all.push(...await entry(child,`${path}${item.name}/`));next()});next()}})}
  async function dropped(dt){const entries=[...(dt.items||[])].map(item=>item.webkitGetAsEntry?.()).filter(Boolean),out=[];if(!entries.length)return[...dt.files];for(const item of entries)out.push(...await entry(item));return out}

  function copyListRows(mode='all'){
    let rows=[...leads];
    if(mode==='website')rows=rows.filter(needsWebsite);
    if(mode==='admin')rows=rows.filter(needsAdmin);
    const keys=rows.map(lead=>{const p=projectFor(lead);return slug(lead.sitekey||p?.sitekey||lead.company||lead.name)}).filter(Boolean);
    return [...new Set(keys)].join('\n');
  }
  async function copyQueueList(mode,label){
    const text=copyListRows(mode);
    if(!text){message(`No ${label.toLowerCase()} items to copy.`,true);return}
    await navigator.clipboard.writeText(text);
    message(`${text.split('\n').length} ${label.toLowerCase()} item${text.includes('\n')?'s':''} copied.`);
  }

  document.getElementById('copyFullList').onclick=()=>copyQueueList('all','Full List');
  document.getElementById('copyNeedsSite').onclick=()=>copyQueueList('website','Needs Site');
  document.getElementById('copyNeedsAdmin').onclick=()=>copyQueueList('admin','Needs Admin');

  document.getElementById('stagingFilters').onclick=e=>{const b=e.target.closest('[data-filter]');if(!b)return;filterMode=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));renderList()};
  listEl.onclick=e=>{const b=e.target.closest('[data-lead]');if(b)openLead(b.dataset.lead)};
  document.getElementById('backToStaging').onclick=showList;
  document.getElementById('stagingSearch').oninput=renderList;
  document.getElementById('uploadWorkspace').onclick=async e=>{const b=e.target.closest('button');if(!b)return;try{if(b.hasAttribute('data-files'))filePicker.click();if(b.hasAttribute('data-folder'))folderPicker.click();if(b.hasAttribute('data-save-links'))await saveLinks();if(b.hasAttribute('data-open-preview'))window.open(document.getElementById('previewUrlInput').value,'_blank','noopener');if(b.hasAttribute('data-open-admin'))window.open(document.getElementById('adminUrlInput').value,'_blank','noopener');if(b.hasAttribute('data-check-admin'))await checkAdmin();if(b.hasAttribute('data-admin-ready'))await markAdmin('valid');if(b.hasAttribute('data-admin-missing'))await markAdmin('missing');if(b.hasAttribute('data-review')){const p=await ensureProject();await SitePipeline.update(p.id,{status:'review',returnNote:''});message('Sent to Review');showList()}}catch(error){message(error.message,true)}};
  for(const picker of[filePicker,folderPicker])picker.onchange=async()=>{try{await add(picker.files)}catch(error){message(error.message,true)}picker.value=''};
  document.getElementById('uploadWorkspace').ondragover=e=>{if(e.target.closest('[data-drop]'))e.preventDefault()};
  document.getElementById('uploadWorkspace').ondrop=async e=>{if(!e.target.closest('[data-drop]'))return;e.preventDefault();try{await add(await dropped(e.dataTransfer))}catch(error){message(error.message,true)}};
  load();
})();
