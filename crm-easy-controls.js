(() => {
  const categories=[
    [1,'General contractors / construction','Very high'],[2,'Roofers','Very high'],[3,'HVAC companies','Very high'],[4,'Plumbers','Very high'],[5,'Electricians','Very high'],[6,'Remodeling / renovation contractors','Very high'],[7,'Landscaping / lawn-care companies','Very high'],[8,'Handyman services','Very high'],[9,'Concrete / masonry contractors','Very high'],[10,'Painters','Very high'],[11,'Tree-removal services','Very high'],[12,'Flooring installers','Very high'],[13,'Fencing companies','Very high'],[14,'Junk removal / hauling','Very high'],[15,'Pest-control companies','Very high'],[16,'Cleaning companies','High'],[17,'Auto-detailing businesses','High'],[18,'Mobile mechanics','High'],[19,'Auto-repair shops / mechanics','High'],[20,'Auto-body / collision shops','High'],[21,'Towing companies','High'],[22,'Garage-door services','High'],[23,'Pressure-washing businesses','High'],[24,'Pool installation / maintenance','High'],[25,'Moving companies','High'],[26,'Event planners','High'],[27,'Wedding vendors','High'],[28,'Caterers','High'],[29,'Photographers / videographers','High'],[30,'Nail salons','Medium-high'],[31,'Hair salons / barbershops','Medium-high'],[32,'Med spas / estheticians','Medium-high'],[33,'Massage therapists','Medium-high'],[34,'Personal trainers / independent gyms','Medium-high'],[35,'Pet groomers','Medium-high'],[36,'Daycares / preschools','Medium-high'],[37,'Tire shops','Medium'],[38,'Restaurants','Medium'],[39,'Food trucks','Medium'],[40,'Bakeries','Medium'],[41,'Independent retailers / boutiques','Medium'],[42,'Tattoo shops','Medium'],[43,'Appliance-repair services','Medium'],[44,'Locksmiths','Medium'],[45,'Car dealerships / used-car lots','Medium'],[46,'Convenience stores','Low'],[47,'Liquor stores','Low'],[48,'Laundromats','Low'],[49,'Smoke / vape shops','Low'],[50,'Gas stations','Very low']
  ];
  const potentialOptions=['Very high','High','Medium-high','Medium','Low','Very low'];
  const colorClasses=['blue','purple','orange','red','yellow'];
  const MASTER_TAGS=['Broken Site','Outdated Site','Site Removed','Spanish?','No Phone','Hot Lead','Interested','Call Back','Needs More Info','Skeptical','No Answer','Not Interested','Wrong Number'];
  const MASTER_SOURCES=['Google','Google Maps','Yelp','Facebook','Instagram','Nextdoor','Facebook Marketplace','TikTok','Reddit','Threads','LinkedIn','X / Twitter','OfferUp'];
  const tagColorGroups={
    blue:new Set(['Broken Site','Outdated Site','Site Removed']),
    purple:new Set(['Spanish?','No Phone']),
    orange:new Set(['Hot Lead','Interested','Call Back','Needs More Info','Skeptical']),
    red:new Set(['No Answer','Not Interested','Wrong Number'])
  };
  const tokens=s=>String(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(x=>x.length>2);
  const norm=s=>String(s||'').trim().toLowerCase();
  function closestCategory(text){
    const source=new Set(tokens(text));
    let best=categories[0],score=-1;
    for(const c of categories){let s=0;for(const t of tokens(c[1]))if(source.has(t))s++;if(s>score){score=s;best=c;}}
    return best;
  }
  function colorIndex(value){
    for(const [name,set] of Object.entries(tagColorGroups))if(set.has(String(value||'').trim()))return colorClasses.indexOf(name);
    let h=0;for(const ch of String(value||'').toLowerCase())h=((h<<5)-h)+ch.charCodeAt(0);
    return Math.abs(h)%colorClasses.length;
  }
  function uniqueSorted(values){
    const map=new Map();
    for(const raw of values||[]){const v=String(raw||'').trim();if(v&&!map.has(norm(v)))map.set(norm(v),v);}
    return [...map.values()].sort((a,b)=>colorIndex(a)-colorIndex(b)||a.localeCompare(b,undefined,{sensitivity:'base'}));
  }
  function availableValues(kind){
    const key=kind==='tag'?'tags':'sources';
    if(kind==='source'){
      const currentRecordSources=(typeof sources!=='undefined'&&Array.isArray(sources))?sources:[];
      return uniqueSorted([...MASTER_SOURCES,...currentRecordSources]);
    }
    const all=[...MASTER_TAGS];
    if(typeof leads!=='undefined'&&Array.isArray(leads))for(const lead of leads)if(Array.isArray(lead?.[key]))all.push(...lead[key]);
    if(typeof tags!=='undefined'&&Array.isArray(tags))all.push(...tags);
    return uniqueSorted(all);
  }
  function selectedList(kind){return kind==='tag'?tags:sources;}
  function isSelected(kind,value){return selectedList(kind).some(x=>norm(x)===norm(value));}
  function toggleValue(kind,value){
    const list=selectedList(kind),i=list.findIndex(x=>norm(x)===norm(value));
    if(i>=0)list.splice(i,1);else list.push(value);
    renderAllButtons();
  }
  function style(){
    const s=document.createElement('style');s.textContent=`
      .easy-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.easy-card{padding:14px}.easy-card h3{margin:0 0 10px;font-size:16px}.easy-card .hint{color:var(--muted);font-size:11px;margin:-5px 0 10px}.button-select{display:flex;gap:7px;flex-wrap:wrap}.button-select button{min-height:38px;padding:0 13px;border:1px solid var(--soft);border-radius:999px;background:#061a30;color:var(--muted);font-weight:800}.button-select button.active{border-color:var(--cyan);background:#0b3155;color:#fff;box-shadow:inset 0 0 0 1px #73bdff33}.tag-buttons{gap:8px!important;align-items:flex-start}.tag-btn,.available-pill{min-height:38px!important;border-radius:999px!important;padding:0 13px!important;font-weight:800!important;transition:.15s}.available-pill{border:1px solid;background:#07182a;color:#dcecff;opacity:.72}.available-pill:hover{opacity:1;transform:translateY(-1px)}.available-pill.selected{opacity:1;color:#fff;box-shadow:inset 0 0 0 1px #ffffff18}.available-pill i{margin-left:7px}.available-pill.blue{border-color:#238cff;color:#86c7ff}.available-pill.blue.selected{background:#0b3155}.available-pill.purple{border-color:#aa64ff;color:#d6adff}.available-pill.purple.selected{background:#2a1647}.available-pill.red{border-color:#ff5268;color:#ff9baa}.available-pill.red.selected{background:#481923}.available-pill.orange{border-color:#ff9d51;color:#ffc096}.available-pill.orange.selected{background:#40240f}.available-pill.yellow{border-color:#ffd033;color:#ffe176}.available-pill.yellow.selected{background:#3b310b}.tag-add{display:none!important}.tag-add .btn{border-radius:999px}.date-buttons{display:grid;grid-template-columns:1fr 1fr;gap:9px}.date-button{position:relative}.date-button input{width:100%;height:44px;border:1px solid var(--line)!important;border-radius:10px!important;background:#08213c!important;color:#fff!important;padding:0 11px!important;font-weight:800}.simple-select{height:44px!important;border-color:var(--line)!important;background:#08213c!important;font-weight:800}.rank-badge{display:inline-flex;align-items:center;justify-content:center;min-width:42px;height:30px;padding:0 10px;border:1px solid var(--purple);border-radius:999px;color:#e6c8ff;background:#24133d;font-weight:900}.section h3{font-size:16px!important}.field label{font-size:11px!important}.identity{padding:14px!important}.editor{gap:10px!important}.section{padding:13px!important}.fields{gap:9px!important}.all-pill-hint{margin:0 0 8px;color:var(--muted);font-size:11px}
      @media(max-width:760px){.easy-row,.date-buttons{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }
  function ensureEasyPanel(){
    if(document.getElementById('easyLeadControls'))return;
    const statusSection=[...document.querySelectorAll('.section')].find(x=>x.querySelector('h3')?.textContent.trim()==='Status');
    if(!statusSection)return;
    const panel=document.createElement('section');panel.id='easyLeadControls';panel.className='card easy-card';panel.innerHTML=`
      <h3>Lead Setup</h3><div class="hint">Choose the closest business type. Rank and lead potential fill automatically.</div>
      <div class="easy-row">
        <div class="field"><label>Business Type / Category</label><select class="simple-select" id="businessCategory"></select></div>
        <div class="field"><label>Rank</label><div style="height:44px;display:flex;align-items:center"><span class="rank-badge" id="businessRankBadge">—</span></div></div>
        <div class="field"><label>Lead Potential</label><select class="simple-select" data-field="leadpotential" id="leadPotentialSelect"></select></div>
      </div>`;
    statusSection.parentNode.insertBefore(panel,statusSection);
    document.getElementById('businessCategory').innerHTML=categories.map(([r,n])=>`<option value="${r}">${r}. ${n}</option>`).join('');
    document.getElementById('leadPotentialSelect').innerHTML=potentialOptions.map(v=>`<option>${v}</option>`).join('');
    document.getElementById('businessCategory').addEventListener('change',()=>{const c=categories.find(x=>String(x[0])===document.getElementById('businessCategory').value)||categories[0];document.getElementById('businessRankBadge').textContent=c[0];document.getElementById('leadPotentialSelect').value=c[2];});
    const callbackField=document.querySelector('[data-field="callbackdate"]')?.closest('.field');
    const callbackTime=document.querySelector('[data-field="callbacktime"]')?.closest('.field');
    if(callbackField&&callbackTime){const wrap=document.createElement('div');wrap.className='field full';wrap.innerHTML='<label>Callback</label><div class="date-buttons"></div>';callbackField.parentNode.insertBefore(wrap,callbackField);wrap.querySelector('.date-buttons').append(callbackField,callbackTime);callbackField.classList.add('date-button');callbackTime.classList.add('date-button');}
    let contact=document.querySelector('[data-field="contactmethod"]');
    if(!contact){const statusFields=statusSection.querySelector('.fields');const f=document.createElement('div');f.className='field full';f.innerHTML='<label>Contact Method</label><div class="button-select" id="contactMethodButtons"><button type="button" data-contact="text">Text</button><button type="button" data-contact="call">Call</button><button type="button" data-contact="email">Email</button></div><input type="hidden" data-field="contactmethod" id="contactMethodValue">';statusFields.appendChild(f);contact=f.querySelector('input');}
    else {const f=contact.closest('.field');f.innerHTML='<label>Contact Method</label><div class="button-select" id="contactMethodButtons"><button type="button" data-contact="text">Text</button><button type="button" data-contact="call">Call</button><button type="button" data-contact="email">Email</button></div><input type="hidden" data-field="contactmethod" id="contactMethodValue">';contact=f.querySelector('input');}
    document.getElementById('contactMethodButtons').addEventListener('click',e=>{const b=e.target.closest('[data-contact]');if(!b)return;document.getElementById('contactMethodValue').value=b.dataset.contact;document.querySelectorAll('[data-contact]').forEach(x=>x.classList.toggle('active',x===b));});
    if(!document.querySelector('[data-field="preferreddate"]')){const f=document.createElement('div');f.className='field full';f.innerHTML='<label>Preferred Date / Time</label><div class="date-buttons"><div class="date-button"><input type="date" data-field="preferreddate"></div><div class="date-button"><input type="time" data-field="preferredtime"></div></div>';statusSection.querySelector('.fields').appendChild(f);}
  }
  function renderAllButtons(){
    const configs=[['tag','#tagButtons'],['source','#sourceButtons']];
    for(const [kind,selector] of configs){
      const box=document.querySelector(selector);if(!box)continue;
      const values=availableValues(kind);
      box.innerHTML=values.length?values.map(v=>{const selected=isSelected(kind,v),color=colorClasses[colorIndex(v)];return `<button class="available-pill ${color}${selected?' selected':''}" type="button" data-all-${kind}="${String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}">${String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}${selected?' <i class="bi bi-check-lg"></i>':''}</button>`}).join(''):'<span style="color:var(--muted);font-size:12px">No available '+(kind==='tag'?'tags':'sources')+'.</span>';
      const section=box.closest('.section');if(section&&!section.querySelector('.all-pill-hint')){const hint=document.createElement('div');hint.className='all-pill-hint';hint.textContent='All available '+(kind==='tag'?'tags':'sources')+' — click to add or remove.';box.before(hint);}
    }
  }
  function refreshEasyControls(){
    if(typeof active==='undefined'||!active)return;
    const exact=categories.find(c=>String(c[1]).toLowerCase()===String(active.leadtype||'').toLowerCase());
    const c=exact||closestCategory([active.leadtype,active.company,active.issue,...(Array.isArray(active.tags)?active.tags:[])].join(' '));
    const cat=document.getElementById('businessCategory');if(cat)cat.value=String(active.businessrank||c[0]);
    const chosen=categories.find(x=>String(x[0])===String(cat?.value))||c;
    const rank=document.getElementById('businessRankBadge');if(rank)rank.textContent=active.businessrank||chosen[0];
    const pot=document.getElementById('leadPotentialSelect');if(pot)pot.value=active.leadpotential||chosen[2];
    const method=String(active.contactmethod||'').toLowerCase();const hidden=document.getElementById('contactMethodValue');if(hidden)hidden.value=method;document.querySelectorAll('[data-contact]').forEach(b=>b.classList.toggle('active',b.dataset.contact===method));
    const pd=document.querySelector('[data-field="preferreddate"]');if(pd)pd.value=active.preferreddate||'';const pt=document.querySelector('[data-field="preferredtime"]');if(pt)pt.value=active.preferredtime||'';
    renderAllButtons();
  }
  function hookSave(){
    const save=document.getElementById('saveLead');if(!save||save.dataset.easyHook)return;save.dataset.easyHook='1';
    save.addEventListener('click',()=>{if(typeof active==='undefined'||!active)return;const cat=categories.find(x=>String(x[0])===document.getElementById('businessCategory')?.value);if(cat){active.leadtype=cat[1];active.businessrank=cat[0];const lp=document.getElementById('leadPotentialSelect');if(lp&&!lp.value)lp.value=cat[2];setTimeout(()=>client.from('crm').update({leadtype:cat[1],businessrank:cat[0],leadpotential:lp?.value||cat[2],contactmethod:document.getElementById('contactMethodValue')?.value||null,preferreddate:document.querySelector('[data-field="preferreddate"]')?.value||null,preferredtime:document.querySelector('[data-field="preferredtime"]')?.value||null,tags:Array.isArray(tags)?tags:[],sources:Array.isArray(sources)?sources:[]}).eq('id',active.id),50);}},true);
  }
  function hookPills(){
    const tagBox=document.getElementById('tagButtons'),sourceBox=document.getElementById('sourceButtons');
    if(tagBox&&!tagBox.dataset.allHook){tagBox.dataset.allHook='1';tagBox.addEventListener('click',e=>{const b=e.target.closest('[data-all-tag]');if(!b)return;e.stopImmediatePropagation();toggleValue('tag',b.dataset.allTag);},true);}
    if(sourceBox&&!sourceBox.dataset.allHook){sourceBox.dataset.allHook='1';sourceBox.addEventListener('click',e=>{const b=e.target.closest('[data-all-source]');if(!b)return;e.stopImmediatePropagation();toggleValue('source',b.dataset.allSource);},true);}
    const addTag=document.getElementById('addTag'),addSource=document.getElementById('addSource');
    if(addTag&&!addTag.dataset.allHook){addTag.dataset.allHook='1';addTag.addEventListener('click',()=>setTimeout(renderAllButtons,0));}
    if(addSource&&!addSource.dataset.allHook){addSource.dataset.allHook='1';addSource.addEventListener('click',()=>setTimeout(renderAllButtons,0));}
  }
  function hookDetail(){
    document.getElementById('leadList')?.addEventListener('click',e=>{if(!e.target.closest('[data-lead-id]'))return;setTimeout(()=>{ensureEasyPanel();refreshEasyControls();hookSave();hookPills();renderAllButtons();},80)});
  }
  style();ensureEasyPanel();hookSave();hookPills();hookDetail();
})();