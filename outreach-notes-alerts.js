(() => {
  const SUPABASE_URL='https://glonbvrcudwuzjundrii.supabase.co';
  const SUPABASE_KEY='sb_publishable_VZbed_uuOXSE744UrAfHXw_z2xDdYtr';
  const client=window.supabase?.createClient?.(SUPABASE_URL,SUPABASE_KEY);
  if(!client)return;

  let currentLead=null,currentRows=[],activeTab='notes',formKind='note',authorName='',isAdmin=false,selectedCrmId='';
  let popupTimer=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const style=document.createElement('style');
  style.textContent=`
    .na-button{display:flex;align-items:center;gap:8px;min-height:46px;padding:0 16px;border:1px solid #aa64ff;border-radius:12px;background:#23113f;color:#f4e9ff;font-weight:850}.na-button i{color:#d6adff}
    .na-shell{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:18px;background:#000c;backdrop-filter:blur(7px)}.na-shell[hidden]{display:none!important}
    .na-panel{width:min(680px,100%);max-height:min(82vh,760px);overflow:auto;padding:20px;border:1px solid #1267ae;border-radius:16px;background:linear-gradient(145deg,#071d35,#041323);box-shadow:0 24px 70px #0009;color:#f4f8ff}
    .na-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.na-head h2{margin:0;font-size:24px}.na-head p{margin:3px 0 0;color:#8eb4dc}.na-close{border:0;background:none;color:#8eb4dc;font-size:21px}
    .na-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0 12px}.na-tab{min-height:42px;border:1px solid #153e65;border-radius:10px;background:#061a30;color:#8eb4dc;font-weight:850}.na-tab.active{border-color:#73bdff;background:#0b3155;color:#fff}
    .na-actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.na-action{min-height:40px;padding:0 13px;border:1px solid #1267ae;border-radius:9px;background:#08213c;color:#fff;font-weight:800}.na-action.primary{margin-left:auto;border-color:#238cff;background:linear-gradient(180deg,#35a4ff,#087cf2)}
    .na-list{display:grid;gap:10px}.na-empty{padding:26px 14px;border:1px dashed #153e65;border-radius:11px;color:#8eb4dc;text-align:center}.na-card{display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:11px;padding:13px;border:1px solid #153e65;border-radius:12px;background:#05172a}.na-card.alert{border-color:#ff9d5166;background:#2b180d}.na-icon{width:40px;height:40px;display:grid;place-items:center;border:1px solid #1267ae;border-radius:10px;background:#08213c;color:#73bdff;font-size:18px}.na-card.alert .na-icon{border-color:#ff9d5188;background:#4b250e;color:#ffc096}.na-card h4{margin:0}.na-desc{margin:4px 0 0;color:#c9def4}.na-meta{margin-top:7px;color:#8eb4dc;font-size:11px}.na-delete{align-self:start;width:34px;height:34px;display:grid;place-items:center;border:1px solid #ff526866;border-radius:9px;background:#451822;color:#ff94a1}.na-delete:hover{border-color:#ff5268;background:#63202e;color:#fff}
    .na-form{display:grid;gap:12px}.na-form label span{display:block;margin-bottom:5px;color:#8eb4dc;font-size:12px;font-weight:800}.na-form input,.na-form textarea,.na-form select{width:100%;border:1px solid #1267ae;border-radius:9px;background:#03101e;color:#fff}.na-form input,.na-form select{height:44px;padding:0 11px}.na-form textarea{min-height:105px;padding:11px;resize:vertical}.na-required{color:#ff8c9b}.na-template{display:flex;align-items:center;gap:8px;padding:11px;border:1px solid #153e65;border-radius:10px;background:#061a30}.na-template input{width:auto;height:auto}.na-form-actions{display:flex;justify-content:flex-end;gap:8px}.na-error{min-height:18px;color:#ff8c9b;font-size:12px}
    .na-popup{position:fixed;right:18px;top:18px;z-index:100;width:min(360px,calc(100vw - 36px));padding:14px 42px 14px 14px;border:1px solid #ff9d51;border-radius:13px;background:#2b180f;color:#fff;box-shadow:0 18px 46px #0008}.na-popup-head{display:flex;gap:10px;align-items:start}.na-popup i{color:#ffc096;font-size:20px}.na-popup strong{display:block}.na-popup p{margin:4px 0 0;color:#ffd7bb}.na-popup small{display:block;margin-top:7px;color:#d8a987}.na-popup button{position:absolute;right:8px;top:7px;width:30px;height:30px;display:grid;place-items:center;border:0;border-radius:8px;background:transparent;color:#ffd7bb;font-size:17px}.na-popup button:hover{background:#ffffff12;color:#fff}
  `;
  document.head.appendChild(style);

  const main=document.createElement('div');
  main.id='notesAlertsModal';main.className='na-shell';main.hidden=true;
  main.innerHTML=`<section class="na-panel"><div class="na-head"><div><h2>Notes & Alerts</h2><p id="naLeadName">Select a lead first.</p></div><button class="na-close" id="naClose"><i class="bi bi-x-lg"></i></button></div><div class="na-tabs"><button class="na-tab active" data-na-tab="notes">Notes</button><button class="na-tab" data-na-tab="alerts">Alerts</button></div><div class="na-actions"><button class="na-action" id="naAddNote"><i class="bi bi-journal-plus"></i> Add Note</button><button class="na-action primary" id="naAddAlert"><i class="bi bi-bell-fill"></i> Add Alert</button></div><div class="na-list" id="naList"></div></section>`;
  document.body.appendChild(main);

  const form=document.createElement('div');
  form.id='naFormModal';form.className='na-shell';form.hidden=true;
  form.innerHTML=`<section class="na-panel" style="width:min(520px,100%)"><div class="na-head"><div><h2 id="naFormHeading">Add Note</h2><p>Saved with your signed-in account automatically.</p></div><button class="na-close" id="naFormClose"><i class="bi bi-x-lg"></i></button></div><form class="na-form" id="naForm"><label id="naTemplateWrap" hidden><span>Template</span><div class="na-template"><input type="checkbox" id="naSeeNotes"><div><strong>See notes</strong><div style="color:#8eb4dc;font-size:12px">Basic alert telling the team to check this lead's notes.</div></div></div></label><label><span>Title <b class="na-required">*</b></span><input id="naTitle" maxlength="80" required placeholder="Short title"></label><label><span>Description <small>(optional)</small></span><textarea id="naDescription" maxlength="700" placeholder="Add more detail if needed"></textarea></label><div class="na-error" id="naFormError"></div><div class="na-form-actions"><button type="button" class="na-action" id="naCancel">Cancel</button><button type="submit" class="na-action primary" id="naSave">Save</button></div></form></section>`;
  document.body.appendChild(form);

  const topActions=document.querySelector('.top-actions');
  if(topActions){const b=document.createElement('button');b.className='na-button';b.id='notesAlertsButton';b.type='button';b.innerHTML='<i class="bi bi-journal-text"></i> Notes / Alerts';topActions.prepend(b);}

  async function getAuthor(){
    const {data}=await client.auth.getUser();const u=data?.user;if(!u){isAdmin=false;return null;}
    authorName=String(u.user_metadata?.display_name||u.user_metadata?.full_name||u.email||'Team member').trim();
    const {data:permission}=await client.from('team_permissions').select('role,active').eq('user_id',u.id).maybeSingle();
    isAdmin=permission?.active!==false&&String(permission?.role||'').trim().toUpperCase()==='ADMIN';
    return u;
  }

  function visibleLeadText(){
    const detail=[...document.querySelectorAll('.lead-title h2')].find(el=>el.offsetParent!==null);
    return detail?.textContent?.trim()||'';
  }

  async function resolveLead(){
    if(selectedCrmId){
      const {data,error}=await client.from('crm').select('id,company,name,phone,notes').eq('id',selectedCrmId).maybeSingle();
      if(error)throw error;
      if(data)return data;
    }
    const company=visibleLeadText();if(!company)return null;
    let q=client.from('crm').select('id,company,name,phone,notes').eq('company',company).limit(5);
    const {data,error}=await q;if(error)throw error;if(!data?.length)return null;
    if(data.length===1)return data[0];
    const bodyText=document.body.innerText;
    return data.find(x=>x.phone&&bodyText.includes(x.phone))||data[0];
  }

  async function loadRows(){
    currentLead=await resolveLead();
    document.getElementById('naLeadName').textContent=currentLead?`${currentLead.company}${currentLead.name?' · '+currentLead.name:''}`:'Open a lead first.';
    if(!currentLead){currentRows=[];render();return;}
    const {data,error}=await client.from('outreach_notes_alerts').select('*').eq('crmid',currentLead.id).order('created_at',{ascending:false});
    if(error){currentRows=[];document.getElementById('naList').innerHTML='<div class="na-empty">Notes/alerts storage is not ready yet. Run the SQL setup for outreach_notes_alerts.</div>';return;}
    currentRows=data||[];render();
  }

  function render(){
    const list=document.getElementById('naList');
    const kind=activeTab==='notes'?'note':'alert';
    const rows=currentRows.filter(x=>x.kind===kind);
    document.querySelectorAll('[data-na-tab]').forEach(b=>b.classList.toggle('active',b.dataset.naTab===activeTab));
    if(!rows.length){list.innerHTML=`<div class="na-empty">No ${activeTab} yet.</div>`;return;}
    list.innerHTML=rows.map(r=>`<article class="na-card ${r.kind==='alert'?'alert':''}"><div class="na-icon"><i class="bi ${esc(r.icon|| (r.kind==='alert'?'bi-bell-fill':'bi-journal-text'))}"></i></div><div><h4>${esc(r.title)}</h4>${r.description?`<p class="na-desc">${esc(r.description)}</p>`:''}<div class="na-meta">${r.kind==='alert'?'Alert created by':'Note written by'} ${esc(r.author_name||'Team member')} · ${new Date(r.created_at).toLocaleString()}</div></div>${isAdmin?`<button class="na-delete" type="button" data-na-delete="${esc(r.id)}" aria-label="Delete ${r.kind}"><i class="bi bi-trash3-fill"></i></button>`:''}</article>`).join('');
  }

  function openForm(kind){
    if(!currentLead)return;
    formKind=kind;document.getElementById('naFormHeading').textContent=kind==='alert'?'Add Alert':'Add Note';document.getElementById('naTemplateWrap').hidden=kind!=='alert';document.getElementById('naSeeNotes').checked=false;document.getElementById('naTitle').value='';document.getElementById('naDescription').value='';document.getElementById('naFormError').textContent='';form.hidden=false;setTimeout(()=>document.getElementById('naTitle').focus(),50);
  }

  async function saveEntry(e){
    e.preventDefault();const title=document.getElementById('naTitle').value.trim(),description=document.getElementById('naDescription').value.trim(),err=document.getElementById('naFormError');
    if(!title){err.textContent='Title is required.';return;}
    const user=await getAuthor();if(!user){err.textContent='You need to be signed in.';return;}
    const payload={crmid:currentLead.id,userid:user.id,kind:formKind,title,description,icon:formKind==='alert'?'bi-exclamation-triangle-fill':'bi-journal-text',author_name:authorName,template_key:document.getElementById('naSeeNotes').checked?'see_notes':null};
    const {error}=await client.from('outreach_notes_alerts').insert(payload);if(error){err.textContent=error.message;return;}
    form.hidden=true;await loadRows();activeTab=formKind==='alert'?'alerts':'notes';render();
    if(formKind==='alert')showPopup({...payload,created_at:new Date().toISOString()});
  }

  async function deleteEntry(id){
    if(!isAdmin)return;
    if(!window.confirm('Delete this note/alert?'))return;
    const {error}=await client.from('outreach_notes_alerts').delete().eq('id',id);
    if(error){alert(error.message);return;}
    currentRows=currentRows.filter(r=>String(r.id)!==String(id));
    render();
  }

  function dismissPopup(){
    if(popupTimer){clearTimeout(popupTimer);popupTimer=null;}
    document.querySelector('.na-popup')?.remove();
  }

  function showPopup(r){
    dismissPopup();
    const el=document.createElement('div');el.className='na-popup';el.innerHTML=`<button type="button" aria-label="Close alert"><i class="bi bi-x-lg"></i></button><div class="na-popup-head"><i class="bi ${esc(r.icon||'bi-bell-fill')}"></i><div><strong>${esc(r.title)}</strong>${r.description?`<p>${esc(r.description)}</p>`:''}<small>Alert created by ${esc(r.author_name||'Team member')}</small></div></div>`;document.body.appendChild(el);
    el.querySelector('button').onclick=dismissPopup;
    popupTimer=setTimeout(dismissPopup,5000);
  }

  async function showLatestAlertForLead(){
    try{const lead=await resolveLead();if(!lead)return;const {data}=await client.from('outreach_notes_alerts').select('*').eq('crmid',lead.id).eq('kind','alert').order('created_at',{ascending:false}).limit(1);if(data?.[0])showPopup(data[0]);}catch(_){ }
  }

  document.getElementById('notesAlertsButton')?.addEventListener('click',async()=>{main.hidden=false;await getAuthor();await loadRows();});
  document.getElementById('naClose').onclick=()=>main.hidden=true;document.getElementById('naFormClose').onclick=()=>form.hidden=true;document.getElementById('naCancel').onclick=()=>form.hidden=true;
  document.getElementById('naAddNote').onclick=()=>openForm('note');document.getElementById('naAddAlert').onclick=()=>openForm('alert');document.getElementById('naForm').onsubmit=saveEntry;
  document.getElementById('naSeeNotes').onchange=e=>{if(e.target.checked){document.getElementById('naTitle').value='See notes';document.getElementById('naDescription').value='Please see the notes for this lead.';}else if(document.getElementById('naTitle').value==='See notes'){document.getElementById('naTitle').value='';document.getElementById('naDescription').value='';}};
  main.addEventListener('click',e=>{const t=e.target.closest('[data-na-tab]');if(t){activeTab=t.dataset.naTab;render();return;}const d=e.target.closest('[data-na-delete]');if(d){deleteEntry(d.dataset.naDelete);}});
  main.addEventListener('click',e=>{if(e.target===main)main.hidden=true});form.addEventListener('click',e=>{if(e.target===form)form.hidden=true});

  document.addEventListener('click',e=>{
    if(e.target.closest('.back-button')){selectedCrmId='';currentLead=null;dismissPopup();}
    const choice=e.target.closest('.lead-choice');
    if(choice){
      selectedCrmId=String(choice.dataset.leadId||'').trim();
      currentLead=null;
      dismissPopup();
      setTimeout(showLatestAlertForLead,350);
    }
  });
})();