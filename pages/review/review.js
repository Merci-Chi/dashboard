(() => {
const SUPABASE_URL='https://glonbvrcudwuzjundrii.supabase.co';
const SUPABASE_KEY='sb_publishable_VZbed_uuOXSE744UrAfHXw_z2xDdYtr';
const STORAGE_BUCKET='site-code';

let reviewClient=null;

const escapeHTML=value=>String(value??'').replace(/[&<>'"]/g,char=>({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  "'":'&#39;',
  '"':'&quot;'
}[char]));

async function initReviewClient(){
  if(!reviewClient&&window.parent!==window){
    reviewClient=window.parent.supabaseClient||null;
  }

  if(!reviewClient){
    if(!window.supabase?.createClient)throw Error('Supabase library did not load.');

    reviewClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
      auth:{
        persistSession:true,
        autoRefreshToken:true,
        detectSessionInUrl:false
      }
    });
  }

  const {data}=await reviewClient.auth.getSession();

  if(!data.session){
    throw Error('Sign in to the main dashboard first.');
  }

  return reviewClient;
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

async function listReviewSites(){
  const client=await initReviewClient();

  const {data,error}=await client
    .from('sites')
    .select('*')
    .in('stage',['review'])
    .order('created',{ascending:true});

  if(error)throw error;

  return (data||[]).map(normalizeSite);
}

async function updateReviewSite(id,changes){
  const client=await initReviewClient();
  const row={updated:new Date().toISOString()};

  if('status' in changes)row.stage=changes.status;
  if('files' in changes)row.files=changes.files;
  if('checks' in changes)row.checks=changes.checks;
  if('returnNote' in changes)row.notes=changes.returnNote;
  if('clientData' in changes)row.returndata=changes.clientData;

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

async function downloadReviewFile(id,path){
  const client=await initReviewClient();
  const {data,error}=await client.storage
    .from(STORAGE_BUCKET)
    .download(`${id}/${path}`);

  if(error)throw error;

  return data;
}

const labels=[['responsive','Mobile and desktop verified'],['links','Links, forms, and buttons tested'],['content','Content and contact details verified'],['console','No console errors or broken assets']];
 let items=[];
 const root=document.getElementById('queue'),status=document.getElementById('status');
 const msg=(t,e=false)=>{status.textContent=t;status.classList.toggle('error',e)};
 const siteKey=x=>String(x.sitekey||x.site_slug||x.slug||'').trim();
 const githubBase=x=>siteKey(x)?`Sites/${siteKey(x)}/`:'';
 const defaultMode=x=>(x.files||[]).some(f=>/^admin(?:\.html|\/)/i.test(String(f?.path||'')))?'admin':'site';
 const publishTarget=(x,f,mode)=>{const base=githubBase(x),path=String(f?.path||'').replace(/^\/+/, '');if(mode==='admin'){const p=path.replace(/^admin\//i,'');return base+'admin/'+((/^admin\.html$/i.test(p)||/^index\.html$/i.test(p))?'index.html':p)}return base+((/^site\.html$/i.test(path))?'index.html':path)};
 async function load(){try{items=await listReviewSites();render()}catch(e){msg(e.message,true)}}
 function render(){root.innerHTML=items.map(x=>{const files=x.files||[],mode=defaultMode(x);return `<article class="review-grid card"><section class="review-panel"><div class="upload-head"><span class="badge">Under review</span><button class="btn secondary" data-download="${x.id}">Download All (.zip)</button></div><h2>${escapeHTML(x.company||x.name||'Unnamed business')}</h2><div class="file-tree">${files.map(f=>`<span><i class="bi bi-file-earmark-code"></i><b>${escapeHTML(f.path)}</b><small>${f.size} B</small></span>`).join('')||'<span><i class="bi bi-link-45deg"></i><b>No uploaded files yet</b></span>'}</div><textarea data-notes="${x.id}" placeholder="Review notes">${escapeHTML(x.notes)}</textarea></section><aside class="review-panel"><h3>Verification checklist</h3><div class="review-list">${labels.map(([k,v])=>`<label><input type="checkbox" data-check="${k}" data-id="${x.id}" ${x.checks[k]?'checked':''}>${v}</label>`).join('')}</div><label class="stack-label">Site key<input class="text-input" data-sitekey="${x.id}" value="${escapeHTML(siteKey(x))}"></label><label class="stack-label">Publish as<select class="text-input" data-mode="${x.id}"><option value="site" ${mode==='site'?'selected':''}>Regular Site</option><option value="admin" ${mode==='admin'?'selected':''}>Admin Page</option></select></label><div class="card" style="padding:12px;margin-top:10px"><strong>GitHub destination</strong><div data-targets="${x.id}" style="margin-top:7px;color:#8eb4dc;font-size:12px">${files.length?files.map(f=>`<div><code>${escapeHTML(publishTarget(x,f,mode))}</code></div>`).join(''):'Upload files before publishing.'}</div></div><div class="review-actions"><button class="btn secondary" data-return="${x.id}">Return to Staging</button><button class="btn" data-publish="${x.id}">Publish to ViewYourSite</button></div></aside></article>`}).join('')||'<div class="empty"><div><i class="bi bi-code-square"></i><strong>No sites under review.</strong></div></div>'}
 async function zip(x){if(!(x.files||[]).length)return msg('There are no files to download.',true);const z=new JSZip();for(const f of x.files||[])z.file(f.path,await downloadReviewFile(x.id,f.path));const blob=await z.generateAsync({type:'blob'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${(x.company||x.name||'site').replace(/\W+/g,'-')}.zip`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
 function refreshTargets(x,mode){const box=root.querySelector(`[data-targets="${x.id}"]`);if(!box)return;box.innerHTML=(x.files||[]).length?(x.files||[]).map(f=>`<div><code>${escapeHTML(publishTarget(x,f,mode))}</code></div>`).join(''):'Upload files before publishing.'}
 async function extractFunctionError(error){
  try{
   if(error?.context?.json){const body=await error.context.json();if(body?.error)return body.error;if(body?.message)return body.message}
  }catch(_){}
  try{
   if(error?.context?.text){const text=await error.context.text();if(text)return text}
  }catch(_){}
  return error?.message||String(error||'Publish failed');
 }
 root.addEventListener('change',async e=>{const id=e.target.dataset.id||e.target.dataset.sitekey||e.target.dataset.mode;const x=items.find(i=>i.id===id);if(!x)return;if(e.target.dataset.check){x.checks[e.target.dataset.check]=e.target.checked;await updateReviewSite(x.id,{checks:x.checks})}if(e.target.dataset.sitekey!==undefined){x.sitekey=e.target.value.trim();await updateReviewSite(x.id,{sitekey:x.sitekey})}if(e.target.dataset.mode!==undefined)refreshTargets(x,e.target.value);if(e.target.dataset.mode===undefined)load()});
 root.addEventListener('input',e=>{const x=items.find(i=>i.id===e.target.dataset.notes);if(x)x.notes=e.target.value});
 root.addEventListener('focusout',async e=>{const x=items.find(i=>i.id===e.target.dataset.notes);if(x)await updateReviewSite(x.id,{notes:x.notes})});
 root.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;try{
  if(b.dataset.download){await zip(items.find(i=>i.id===b.dataset.download));return}
  if(b.dataset.return){const note=prompt('Optional: add a note explaining what should be changed.','');if(note===null)return;await updateReviewSite(b.dataset.return,{status:'staging',returnNote:note.trim(),checks:{responsive:false,links:false,content:false,console:false}});await load();return}
  if(b.dataset.publish){const x=items.find(i=>i.id===b.dataset.publish);if(!x)return;const missing=[];if(!siteKey(x))missing.push('site key');if(!(x.files||[]).length)missing.push('uploaded files');for(const [k,v] of labels)if(!x.checks[k])missing.push(v);if(missing.length){msg(`Before publishing: ${missing.join(' · ')}`,true);return}const mode=root.querySelector(`[data-mode="${x.id}"]`)?.value==='admin'?'admin':'site';b.disabled=true;b.textContent='Publishing…';msg(`Publishing ${x.company||x.name||siteKey(x)}…`);const client=await initReviewClient();const {data,error}=await client.functions.invoke('publish-viewyoursite',{body:{projectId:x.id,mode}});if(error)throw new Error(await extractFunctionError(error));if(data?.error)throw new Error(data.error);await updateReviewSite(x.id,{status:'published'});items=items.filter(i=>i.id!==x.id);render();msg(`Published successfully to ViewYourSite${data?.commitSha?` · ${data.commitSha.slice(0,7)}`:''}`);return}
 }catch(err){msg(err?.message||String(err),true);const publishBtn=b?.dataset?.publish?b:null;if(publishBtn){publishBtn.disabled=false;publishBtn.textContent='Publish to ViewYourSite'}}});
 load();
})();
