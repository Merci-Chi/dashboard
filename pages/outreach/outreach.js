(() => {
    const URL='https://glonbvrcudwuzjundrii.supabase.co',KEY='sb_publishable_VZbed_uuOXSE744UrAfHXw_z2xDdYtr';
    const GITHUB_USER='Merci-Chi',GITHUB_REPO='viewyoursite',SITES_FOLDER='Sites';
    const $=s=>document.querySelector(s),PENDING_CALL_KEY='steady-hands-pending-outreach-call';let client,leads=[],active=null,noteTimer,loggedInName='____',directoryCategory='uncalled',siteFilterMode='has-site',callPending=false,pendingCallAt='',selectedOutcomes=new Set(),editingTags=new Set(),availableSiteKeys=new Set();
    const TAG_GROUPS=[{title:'Website',description:'Website condition',color:'#58b6ff',tags:['Broken Site','Outdated Site','Site Removed','Already have a website']},{title:'Contact',description:'Language and contact limitations',color:'#b77cff',tags:['Spanish?','No Phone']},{title:'Lead Status',description:'Interest and next-step signals',color:'#ffad55',tags:['Hot Lead','Interested','Call Back','Needs More Info','Skeptical']},{title:'Call Outcome',description:'Unreachable or negative outcomes',color:'#ff6e7c',tags:['No Answer','Left Voicemail','Not Interested','Wrong Number']},{title:'Conversion',description:'Completed sales',color:'#f2cf55',tags:['Conversion','Sold']}];

    const AREA_CODE_ZONES={};
    function addAreaCodes(zone,codes){String(codes).trim().split(/\s+/).filter(Boolean).forEach(code=>AREA_CODE_ZONES[code]=zone)}
    addAreaCodes('America/Los_Angeles',`206 209 213 253 279 310 323 341 360 369 408 415 424 425 442 458 503 509 510 530 541 559 562 619 626 628 650 657 661 669 702 707 714 725 747 760 775 805 818 820 831 840 858 909 916 925 949 951 971 986`);
    addAreaCodes('America/Phoenix',`480 520 602 623 928`);
    addAreaCodes('America/Denver',`303 307 385 406 435 505 575 719 720 801 970 983`);
    addAreaCodes('America/Boise',`208 986`);
    addAreaCodes('America/Chicago',`205 210 214 217 224 225 228 251 254 262 281 308 309 312 314 316 318 319 320 325 331 334 346 361 409 417 430 432 447 469 479 501 504 507 512 515 534 539 563 573 580 601 605 608 612 615 618 620 630 636 641 651 660 662 682 701 708 712 713 715 726 737 763 769 779 785 806 815 816 817 830 832 847 850 870 872 903 913 918 920 936 940 945 956 972 975 979 985`);
    addAreaCodes('America/New_York',`201 202 203 207 212 215 216 220 223 227 229 231 234 239 240 248 252 267 269 272 276 301 302 304 305 313 315 321 330 332 336 339 347 351 352 380 386 401 404 407 410 412 413 419 423 434 440 445 448 470 475 478 484 502 508 513 516 517 518 540 551 561 567 570 571 574 582 585 586 603 606 607 609 610 614 616 617 631 640 646 656 659 667 678 680 681 689 703 704 706 716 717 724 727 732 734 740 743 754 757 762 765 770 772 774 781 786 802 803 804 810 813 814 826 828 835 843 845 848 850 854 856 857 859 860 862 863 864 878 904 908 910 912 914 917 919 929 930 934 937 941 943 947 948 954 959 980 984 989`);
    addAreaCodes('America/Anchorage',`907`);
    addAreaCodes('Pacific/Honolulu',`808`);
    const CALL_WINDOW={start:9*60,end:16*60+30,label:'Monday–Friday · 9:00 AM–4:30 PM local'};
    function phoneAreaCode(phone){
      const digits=String(phone||'').replace(/\D/g,'');
      if(digits.length===11&&digits.startsWith('1'))return digits.slice(1,4);
      if(digits.length>=10)return digits.slice(0,3);
      return '';
    }
    function normalizedStoredZone(value){
      const raw=String(value||'').trim();
      if(!raw)return'';
      if(raw.includes('/'))return raw;
      const key=raw.toLowerCase().replace(/\s+/g,'');
      if(/pacific|pst|pdt/.test(key))return'America/Los_Angeles';
      if(/mountain|mst|mdt/.test(key))return'America/Denver';
      if(/central|cst|cdt/.test(key))return'America/Chicago';
      if(/eastern|est|edt/.test(key))return'America/New_York';
      if(/arizona/.test(key))return'America/Phoenix';
      if(/alaska|akst|akdt/.test(key))return'America/Anchorage';
      if(/hawai|hst/.test(key))return'Pacific/Honolulu';
      return'';
    }
    function leadZoneInfo(lead){
      const area=phoneAreaCode(lead?.phone),areaZone=AREA_CODE_ZONES[area];
      if(areaZone)return{zone:areaZone,area,source:'area'};
      const stored=normalizedStoredZone(lead?.timezone);
      if(stored)return{zone:stored,area,source:'crm'};
      return{zone:'America/Los_Angeles',area,source:'fallback'};
    }
    function zoneLabel(zone){
      return {'America/Los_Angeles':'Pacific Time','America/Phoenix':'Arizona Time','America/Denver':'Mountain Time','America/Boise':'Mountain Time','America/Chicago':'Central Time','America/New_York':'Eastern Time','America/Anchorage':'Alaska Time','Pacific/Honolulu':'Hawaii Time'}[zone]||zone.replace(/_/g,' ');
    }
    function localClockParts(zone,date=new Date()){
      const parts=new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'short',hour:'numeric',minute:'2-digit',hour12:false}).formatToParts(date);
      const get=type=>parts.find(p=>p.type===type)?.value||'';
      return{weekday:get('weekday'),hour:Number(get('hour'))%24,minute:Number(get('minute'))};
    }
    function callStatus(lead,date=new Date()){
      const info=leadZoneInfo(lead),p=localClockParts(info.zone,date),minutes=p.hour*60+p.minute,weekdayIndex={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[p.weekday]??0;
      const weekday=weekdayIndex>=1&&weekdayIndex<=5;
      let state='late',label='Outside best hours',score=5000;
      if(weekday&&minutes>=CALL_WINDOW.start&&minutes<=CALL_WINDOW.end){state='good';label='Good time to call now';score=minutes-CALL_WINDOW.start}
      else if(weekday&&minutes<CALL_WINDOW.start){state='wait';label='Best later today at 9:00 AM';score=1000+(CALL_WINDOW.start-minutes)}
      else{
        state='late';
        const days=weekdayIndex===5?3:weekdayIndex===6?2:weekdayIndex===0?1:1;
        label=days===1?'Best next weekday at 9:00 AM':'Best Monday at 9:00 AM';
        score=2000+(days*1440)+(CALL_WINDOW.start-minutes);
      }
      return{...info,...p,minutes,state,label,score};
    }
    function localTimeText(lead,date=new Date()){
      const info=leadZoneInfo(lead);
      return new Intl.DateTimeFormat('en-US',{timeZone:info.zone,weekday:'long',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(date);
    }
    function timezoneSourceText(lead){
      const info=leadZoneInfo(lead);
      if(info.source==='area')return 'Based on area code '+info.area+' · '+zoneLabel(info.zone);
      if(info.source==='crm')return 'Using CRM timezone · '+zoneLabel(info.zone);
      return 'Timezone could not be identified from the area code · showing Pacific Time';
    }

    const clean=(v,f='Not provided')=>String(v??'').trim()||f;
    const escapeHtml=v=>{const n=document.createElement('div');n.textContent=String(v??'');return n.innerHTML};
    function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),1800)}
    function preferred(lead){return clean([lead.preferredcontact,lead.preferreddays,lead.timepreference,lead.specifictime].filter(Boolean).join(' · '))}
    function slug(lead){const raw=clean(lead.company,lead.name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');return raw||'site-preview'}
    function normalizedSiteKey(value){
      return String(value||'').trim();
    }
    function hasOutreachPreview(lead){
      const folder=normalizedSiteKey(lead?.sitekey);
      return Boolean(folder&&availableSiteKeys.has(folder));
    }
    function outreachPreviewUrl(lead){
      if(!hasOutreachPreview(lead))return'';
      const folder=normalizedSiteKey(lead?.sitekey);
      return 'https://viewyoursite.today/Sites/'+encodeURIComponent(folder)+'/';
    }
    async function loadAvailableSiteKeys(){
      const response=await fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/git/trees/main?recursive=1`,{
        headers:{Accept:'application/vnd.github+json'}
      });
      if(!response.ok)throw new Error(`GitHub site directory lookup failed (${response.status})`);
      const data=await response.json();
      if(!Array.isArray(data.tree))throw new Error('GitHub site directory response was invalid');
      if(data.truncated)console.warn('GitHub returned a truncated repository tree.');
      const prefix=SITES_FOLDER+'/';
      const suffix='/index.html';
      availableSiteKeys=new Set(
        data.tree
          .filter(item=>item?.type==='blob'&&String(item.path||'').startsWith(prefix)&&String(item.path||'').endsWith(suffix))
          .map(item=>String(item.path).slice(prefix.length,-suffix.length))
          .filter(folder=>folder&&!folder.includes('/'))
      );
      return availableSiteKeys;
    }
    function firstName(value){const name=clean(value,'____');return name==='Not provided'?'____':name.split(/\s+/)[0]}
    const normalizeStatus=value=>String(value||'').trim().toLowerCase().replace(/[\s_-]+/g,'');
    function leadTags(lead){return [...(Array.isArray(lead?.tags)?lead.tags:[]),...(Array.isArray(lead?.sources)?lead.sources:[])]}
    function isNotInterested(lead){return [...leadTags(lead),lead?.stage,lead?.outcome].some(value=>normalizeStatus(value)==='notinterested')}
    function leadCategory(lead){if(isNotInterested(lead))return'notinterested';return lead?.lastcalled?'followups':'uncalled'}
    function categoryLabel(category){return category==='notinterested'?'Not Interested':category==='followups'?'Follow Up':'Not Called'}
    function lastCalledLabel(lead){
      if(!lead?.lastcalled)return clean(lead?.phone,'No phone number');
      const date=new Date(lead.lastcalled);
      return Number.isNaN(date.getTime())?'Previously called':'Last called '+date.toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
    }
    function renderDirectory(){
      const counts={uncalled:0,followups:0,notinterested:0};
      leads.forEach(lead=>counts[leadCategory(lead)]++);
      Object.entries(counts).forEach(([key,value])=>{const node=document.querySelector('[data-count="'+key+'"]');if(node)node.textContent=value});
      const needle=String($('#directorySearch')?.value||'').trim().toLowerCase();
      const matches=leads.filter(lead=>{
        if(leadCategory(lead)!==directoryCategory)return false;
        if(hasOutreachPreview(lead)!==(siteFilterMode==='has-site'))return false;
        if(!needle)return true;
        return [lead.company,lead.name,lead.phone,lead.email,lead.leadtype,...leadTags(lead)].some(value=>String(value||'').toLowerCase().includes(needle));
      });
      const sortMode=$('#callSort')?.value||'best';
      matches.sort((a,b)=>sortMode==='company'?clean(a.company,a.name).localeCompare(clean(b.company,b.name)):callStatus(a).score-callStatus(b).score||clean(a.company,a.name).localeCompare(clean(b.company,b.name)));
      $('#directoryStatus').textContent=matches.length+' '+(matches.length===1?'lead':'leads')+' in '+(directoryCategory==='uncalled'?'Leads Not Called':directoryCategory==='followups'?'Follow Ups':'Not Interested')+' · '+(siteFilterMode==='has-site'?'Has Site Preview':'Does Not Have Site Preview');
      $('#leadList').innerHTML=matches.length?matches.map(lead=>{
        const category=leadCategory(lead);
        const subtitle=category==='notinterested'?'Marked Not Interested':lastCalledLabel(lead);
        const hasPreview=hasOutreachPreview(lead),call=callStatus(lead),theirTime=localTimeText(lead);
        return '<button class="lead-choice" type="button" data-lead-id="'+escapeHtml(lead.id)+'"><span class="choice-icon"><i class="bi bi-building"></i></span><span class="choice-main"><strong>'+escapeHtml(clean(lead.company,'Unnamed business'))+'</strong><span>'+escapeHtml(clean(lead.name,'No contact name'))+' · '+escapeHtml(subtitle)+'</span><span class="their-local-time"><i class="bi bi-clock"></i><strong>For them:</strong> '+escapeHtml(theirTime)+' · '+escapeHtml(zoneLabel(call.zone))+'</span><span class="site-preview-state'+(hasPreview?'':' missing')+'">'+(hasPreview?'Has site preview':'Does not have site preview')+'</span></span><span class="choice-status status-'+category+'">'+categoryLabel(category)+'</span><i class="bi bi-chevron-right choice-chevron"></i></button>';
      }).join(''):'<div class="directory-empty">No leads are in this category.</div>';
    }
    function showDirectory(){
      active=null;
      history.replaceState({outreachDirectory:true},'',location.href);
      $('#leadDirectory').hidden=false;
      $('#detailTop').hidden=true;
      $('#content').hidden=true;
      renderDirectory();
      window.scrollTo({top:0,behavior:'smooth'});
    }
    function openLead(id){
      const lead=leads.find(item=>String(item.id)===String(id));
      if(!lead)return;
      active=lead;
      localStorage.setItem('steady-hands-active-outreach-id',active.id);
      history.pushState({outreachLead:active.id},'',location.href);
      $('#leadDirectory').hidden=true;
      $('#detailTop').hidden=false;
      render();
      window.scrollTo({top:0,behavior:'smooth'});
    }
    function savePendingCall(){if(!active?.id||!callPending)return;localStorage.setItem(PENDING_CALL_KEY,JSON.stringify({leadId:active.id,calledAt:pendingCallAt||new Date().toISOString()}))}
    function clearPendingCall(){localStorage.removeItem(PENDING_CALL_KEY)}
    function restorePendingCall(){let saved;try{saved=JSON.parse(localStorage.getItem(PENDING_CALL_KEY)||'null')}catch{clearPendingCall();return false}if(!saved?.leadId||!leads.some(lead=>String(lead.id)===String(saved.leadId))){clearPendingCall();return false}callPending=true;pendingCallAt=saved.calledAt||new Date().toISOString();openLead(saved.leadId);return true}
    function updateTranscripts(){
      const clientName=escapeHtml(firstName(active?.name)),staffName=escapeHtml(firstName(loggedInName));
      $('#noSiteText').innerHTML='Hey <span class="highlight">'+clientName+'</span>, this is <span class="highlight">'+staffName+'</span>. I was looking into your business earlier and <span class="highlight">I couldn’t find a website</span>. I help businesses get set up with a professional site. Is that something you’re considering?';
      $('#outdatedText').innerHTML='Hey <span class="highlight">'+clientName+'</span>, this is <span class="highlight">'+staffName+'</span>. I was looking at your website earlier and <span class="highlight">noticed it seems dated</span>. I help businesses redesign and upgrade older sites. Would you be open to talking about it?';
      $('#brokenText').innerHTML='Hey <span class="highlight">'+clientName+'</span>, this is <span class="highlight">'+staffName+'</span>. I noticed <span class="highlight">parts of your website weren’t working properly</span>. I can help get it fixed or rebuild it. Would you be interested?';
      $('#spanishText').innerHTML='No hay problema. <span class="highlight">Un miembro de mi equipo habla español</span>. Puedo pedirle que le llame?';
    }
    function hasAdminSite(lead){
      if(String(lead?.adminurl||'').trim())return true;
      if(String(lead?.adminstatus||'').trim().toLowerCase()==='valid')return true;
      const tier=String(lead?.tier||'').toLowerCase();
      const tags=[...(Array.isArray(lead?.tags)?lead.tags:[]),...(Array.isArray(lead?.sources)?lead.sources:[])].join(' ').toLowerCase();
      return tier.includes('30')||tier.includes('admin')||tier.includes('backend')||tags.includes('admin ready')||tags.includes('admin site');
    }
    function outreachAdminUrl(lead){const direct=String(lead?.adminurl||'').trim();if(direct)return direct.endsWith('/')?direct:direct+'/';const site=outreachPreviewUrl(lead);return site&&hasAdminSite(lead)?site+'admin/':''}
    function historyRows(lead){let rows=[];if(Array.isArray(lead.history))rows=lead.history;else if(lead.history){try{rows=JSON.parse(lead.history)}catch{rows=String(lead.history).split('\n')}}return rows.slice(-8).reverse()}
    function render(){
      $('#content').hidden=!active;if(!active)return;
      $('#callLead').disabled=!String(active.phone||'').trim();updateCallButton();$('#company').textContent=clean(active.company,'Unnamed business');$('#category').textContent=clean(active.leadtype||active.category,'Category not provided');
      const zoneInfo=leadZoneInfo(active);
      $('#owner').textContent=clean(active.name,'Name not provided');$('#phone').textContent=clean(active.phone);$('#email').textContent=clean(active.email);$('#timezone').textContent=zoneLabel(zoneInfo.zone)+(zoneInfo.source==='area'&&zoneInfo.area?' (area code '+zoneInfo.area+')':'');$('#preferred').textContent=preferred(active);$('#bestCallHours').textContent=CALL_WINDOW.label;
      const tags=[...(Array.isArray(active.sources)?active.sources:[]),...(Array.isArray(active.tags)?active.tags:[])];
      
      if(active.spanish)tags.push('Spanish?');
      if(active.stage)tags.push(active.stage==='outreach'?'In Outreach':active.stage==='notinterested'?'Not Interested':active.stage);
      if(active.answer)tags.push(active.answer);
      if(active.outcome)tags.push(active.outcome);
      tags.push(active.lastcalled?'Called':'Not yet called');
      $('#tags').innerHTML=[...new Set(tags.map(x=>clean(x,'')).filter(Boolean))].map(x=>'<span class="tag">'+escapeHtml(x)+'</span>').join('');
      $('#notes').value=clean(active.notes,'')==='Not provided'?'':clean(active.notes,'');
      const rows=historyRows(active);$('#history').innerHTML=(rows.length?rows:['Lead added']).map(row=>'<div class="history-row"><i class="bi bi-journal-text"></i><span>'+escapeHtml(typeof row==='string'?row:(row.text||row.action||row.note||'Activity updated'))+'</span></div>').join('');
      updateTranscripts();
      const base=outreachPreviewUrl(active);
      const siteUrl=base?(base.endsWith('/')?base:base+'/'):'';
      $('#siteUrl').textContent=siteUrl||'Does not have site preview';
      $('#copySite').hidden=!siteUrl;
      $('#copySite').disabled=!siteUrl;
      const adminPreview=outreachAdminUrl(active);
      const adminReady=Boolean(adminPreview);
      $('#adminUrl').textContent=adminReady?adminPreview:'Admin site currently unavailable';
      $('#copyAdmin').hidden=!adminReady;
      $('#copyAdmin').disabled=!adminReady;
    }
    function renderTagEditor(){const known=new Set(TAG_GROUPS.flatMap(group=>group.tags)),custom=[...editingTags].filter(tag=>!known.has(tag));const groups=custom.length?[...TAG_GROUPS,{title:'Other',description:'Existing custom tags',color:'#8eb4dc',tags:custom}]:TAG_GROUPS;$('#tagGroups').innerHTML=groups.map(group=>'<section class="tag-group" style="--group-color:'+group.color+'"><h3>'+escapeHtml(group.title)+'</h3><p>'+escapeHtml(group.description)+'</p><div class="tag-options">'+group.tags.map(tag=>'<button class="tag-option'+(editingTags.has(tag)?' selected':'')+'" type="button" data-edit-tag="'+escapeHtml(tag)+'" aria-pressed="'+String(editingTags.has(tag))+'">'+escapeHtml(tag)+'<i class="bi bi-check-lg"></i></button>').join('')+'</div></section>').join('')}
    function openTagEditor(){if(!active)return;editingTags=new Set((Array.isArray(active.tags)?active.tags:[]).map(tag=>String(tag||'').trim()).filter(Boolean));if(active.spanish)editingTags.add('Spanish?');renderTagEditor();$('#tagEditorModal').hidden=false}
    function closeTagEditor(){$('#tagEditorModal').hidden=true}
    $('#editTags').onclick=openTagEditor;
    $('#closeTagEditor').onclick=closeTagEditor;
    $('#cancelTagEditor').onclick=closeTagEditor;
    $('#tagGroups').onclick=event=>{const button=event.target.closest('[data-edit-tag]');if(!button)return;const tag=button.dataset.editTag;if(editingTags.has(tag))editingTags.delete(tag);else editingTags.add(tag);button.classList.toggle('selected',editingTags.has(tag));button.setAttribute('aria-pressed',String(editingTags.has(tag)))};
    $('#saveTags').onclick=async()=>{if(!active)return;const button=$('#saveTags');button.disabled=true;const tags=[...editingTags].filter(tag=>String(tag||'').trim().toLowerCase()!=='no site'),siteTags=['Broken Site','Outdated Site','Site Removed'],selectedSite=siteTags.find(tag=>editingTags.has(tag))||'',outcomeNames=['Interested','Call Back','Needs More Info','Skeptical','No Answer','Left Voicemail','Not Interested','Wrong Number','Already have a website','Conversion','Sold'],outcomes=outcomeNames.filter(tag=>editingTags.has(tag)),stage=editingTags.has('Sold')||editingTags.has('Conversion')?'complete':editingTags.has('Not Interested')?'notinterested':active.lastcalled?'outreach':'notstarted',leadtype=selectedSite||(siteTags.includes(active.leadtype)?'':active.leadtype||''),patch={tags,spanish:editingTags.has('Spanish?'),leadtype,outcome:outcomes.join(', '),stage,updated:new Date().toISOString()};const {error}=await client.from('crm').update(patch).eq('id',active.id);button.disabled=false;if(error)return toast('Could not save tags');Object.assign(active,patch);closeTagEditor();render();renderDirectory();toast('Tags saved')};
    function populate(query=''){
      const needle=String(query||'').trim().toLowerCase();
      const matches=leads.filter(l=>!needle||[l.company,l.name,l.phone,l.email,l.leadtype,...(Array.isArray(l.tags)?l.tags:[]),...(Array.isArray(l.sources)?l.sources:[])].some(value=>String(value||'').toLowerCase().includes(needle)));
      $('#leadSelect').innerHTML=matches.map(l=>'<option value="'+escapeHtml(l.id)+'">'+escapeHtml(clean(l.company,l.name))+' — '+escapeHtml(clean(l.name,l.phone))+'</option>').join('');
      if(matches.length)$('#leadSelect').selectedIndex=0;
    }
    async function getClient(){for(let i=0;i<30;i++){const p=window.parent!==window?window.parent.supabaseClient:null;if(p){const refreshed=await p.auth.refreshSession();const current=refreshed.data?.session||(await p.auth.getSession()).data?.session;if(current){const user=current.user||{};loggedInName=user.user_metadata?.full_name||user.user_metadata?.display_name||user.user_metadata?.name||String(user.email||'').split('@')[0]||'____';return p}}await new Promise(r=>setTimeout(r,250))}return window.parent!==window&&window.parent.supabaseClient?window.parent.supabaseClient:window.supabase.createClient(URL,KEY)}
    setInterval(()=>{if(!$('#leadDirectory')?.hidden)renderDirectory()},60000);

    async function load(){
      client=await getClient();
      $('#directoryStatus').textContent='Checking live site previews…';
      await loadAvailableSiteKeys();
      const [crmResult,siteResult]=await Promise.all([
        client.from('crm').select('*').order('businessrank',{ascending:true,nullsFirst:false}).order('company',{ascending:true}),
        client.from('sites').select('id,crmid,sitekey,previewurl,adminurl,adminstatus')
      ]);
      if(crmResult.error)throw crmResult.error;
      if(siteResult.error)console.warn('Could not load site/admin preview links',siteResult.error);
      const sites=siteResult.data||[],byCrm=new Map(),byKey=new Map();
      sites.forEach(site=>{if(site.crmid)byCrm.set(String(site.crmid),site);if(site.sitekey)byKey.set(String(site.sitekey).trim().toLowerCase(),site)});
      leads=(crmResult.data||[]).map(lead=>{const key=String(lead.sitekey||'').trim().toLowerCase(),site=byCrm.get(String(lead.id))||(key?byKey.get(key):null);return site?{...lead,sitekey:site.sitekey||lead.sitekey,previewurl:site.previewurl||lead.previewurl||'',adminurl:site.adminurl||lead.adminurl||'',adminstatus:site.adminstatus||lead.adminstatus||''}:lead});
      if(!restorePendingCall())showDirectory();
    }
    function setWizardStep(step){document.querySelectorAll('.wizard-page').forEach(page=>page.classList.toggle('active',Number(page.dataset.step)===step));document.querySelectorAll('[data-step-dot]').forEach(dot=>{const n=Number(dot.dataset.stepDot);dot.classList.toggle('active',n===step);dot.classList.toggle('complete',n<step)})}
    function updateCallButton(){const button=$('#callLead');if(!button)return;button.classList.toggle('pending',callPending);button.innerHTML=callPending?'<i class="bi bi-check2-circle"></i>Done calling':'<i class="bi bi-telephone-fill"></i>Call'}
    function shakeBack(){const button=$('#backToList');button.classList.remove('attention-shake');void button.offsetWidth;button.classList.add('attention-shake');button.animate?.([{translate:'0 0'},{translate:'-8px 0'},{translate:'7px 0'},{translate:'-5px 0'},{translate:'3px 0'},{translate:'0 0'}],{duration:480,easing:'ease'})}
    function requestBack(){if(callPending){shakeBack();$('#callCompleteModal').hidden=false;return}showDirectory()}
    function resetCallWizard(limited=false){selectedOutcomes=new Set();$('#callNotes').value='';$('#outcomeNext').disabled=true;$('#outcomeHeading').textContent=limited?'What happened? Select all that apply':'Choose one or more call statuses';document.querySelectorAll('[data-outcome]').forEach(button=>{button.classList.remove('selected');button.hidden=limited&&!button.hasAttribute('data-negative-outcome')});setWizardStep(1)}
    function parsedHistory(lead){if(Array.isArray(lead?.history))return [...lead.history];if(!lead?.history)return[];try{const parsed=JSON.parse(lead.history);return Array.isArray(parsed)?parsed:[]}catch{return[]}}
    function openCallTimeConfirmation(){
      if(!active?.phone)return toast('No phone number provided.');
      $('#theirLocalTime').textContent=localTimeText(active);
      $('#theirTimezoneSource').textContent=timezoneSourceText(active);
      $('#confirmBestCallHours').textContent=CALL_WINDOW.label;
      const status=callStatus(active),button=$('#confirmCallTime');
      button.innerHTML=status.state==='good'?'<i class="bi bi-telephone-fill"></i> Call now':'<i class="bi bi-telephone-fill"></i> Call anyway';
      $('#callTimeConfirmModal').hidden=false;
    }
    function beginCall(){
      $('#callTimeConfirmModal').hidden=true;
      callPending=true;pendingCallAt=new Date().toISOString();savePendingCall();updateCallButton();
      location.href='tel:'+String(active.phone).replace(/[^+\d]/g,'');
    }
    $('#callLead').onclick=()=>{if(callPending){$('#callCompleteModal').hidden=false;return}openCallTimeConfirmation()};
    $('#cancelCallTime').onclick=()=>{$('#callTimeConfirmModal').hidden=true};
    $('#confirmCallTime').onclick=beginCall;
    $('#backToList').onclick=requestBack;
    $('#completeCallNo').onclick=()=>{$('#callCompleteModal').hidden=true;resetCallWizard(true);$('#callWizardModal').hidden=false};
    $('#completeCallYes').onclick=()=>{$('#callCompleteModal').hidden=true;resetCallWizard(false);$('#callWizardModal').hidden=false};
    $('#didNotCall').onclick=()=>{callPending=false;pendingCallAt='';selectedOutcomes=new Set();clearPendingCall();updateCallButton();$('#callCompleteModal').hidden=true;showDirectory();toast('No call recorded')};
    document.querySelector('.outcome-grid').onclick=event=>{const button=event.target.closest('[data-outcome]');if(!button)return;const value=button.dataset.outcome;if(selectedOutcomes.has(value))selectedOutcomes.delete(value);else selectedOutcomes.add(value);button.classList.toggle('selected',selectedOutcomes.has(value));$('#outcomeNext').disabled=selectedOutcomes.size===0};
    $('#outcomeNext').onclick=()=>{if(selectedOutcomes.size)setWizardStep(2)};
    $('#outcomeBack').onclick=()=>setWizardStep(1);
    $('#finishCall').onclick=async()=>{if(!active||!callPending||!selectedOutcomes.size)return;const button=$('#finishCall');button.disabled=true;const outcomes=[...selectedOutcomes],calledAt=pendingCallAt||new Date().toISOString(),note=String($('#callNotes').value||'').trim(),history=parsedHistory(active),outcomeKeys=new Set(['interested','callback','needsmoreinfo','skeptical','noanswer','leftvoicemail','notinterested','wrongnumber','alreadyhaveawebsite','conversion','sold']),tags=(Array.isArray(active.tags)?active.tags:[]).filter(tag=>!outcomeKeys.has(normalizeStatus(tag)));history.push({type:'called',actor:loggedInName,at:calledAt,text:'Called by '+loggedInName});if(note)history.push({type:'note',actor:loggedInName,at:new Date().toISOString(),note,text:'Note added by '+loggedInName+' — '+note});tags.push(...outcomes);const nextNotes=note?(String(active.notes||'').trim()?String(active.notes).trim()+'\n'+note:note):String(active.notes||'');const stage=outcomes.includes('Not Interested')?'notinterested':'outreach';const patch={lastcalled:calledAt,updated:new Date().toISOString(),outcome:outcomes.join(', '),tags,history,notes:nextNotes,stage};const {error}=await client.from('crm').update(patch).eq('id',active.id);if(error){button.disabled=false;toast('Could not save call completion');return}Object.assign(active,patch);callPending=false;pendingCallAt='';clearPendingCall();updateCallButton();$('#callSuccessMessage').textContent=stage==='notinterested'?'Saved to Not Interested':'Saved to Follow Ups';setWizardStep(3);renderDirectory();setTimeout(()=>{$('#callWizardModal').hidden=true;button.disabled=false;directoryCategory=stage==='notinterested'?'notinterested':'followups';document.querySelectorAll('[data-category]').forEach(item=>{const selected=item.dataset.category===directoryCategory;item.classList.toggle('active',selected);item.setAttribute('aria-selected',String(selected))});showDirectory()},1450)};
    window.addEventListener('popstate',()=>{if(active){if(callPending){history.pushState({outreachLead:active.id},'',location.href);requestBack()}else showDirectory()}});
    window.addEventListener('beforeunload',event=>{if(!callPending)return;event.preventDefault();event.returnValue=''});
    $('#refreshLeads').onclick=async()=>{const button=$('#refreshLeads');button.disabled=true;$('#directoryStatus').textContent='Refreshing leads…';try{await load()}catch(error){toast(error.message||'Could not refresh leads')}finally{button.disabled=false}};
    $('#directorySearch').oninput=renderDirectory;
    $('#callSort').onchange=renderDirectory;
    document.querySelector('.category-tabs').onclick=event=>{const button=event.target.closest('[data-category]');if(!button)return;directoryCategory=button.dataset.category;document.querySelectorAll('[data-category]').forEach(item=>{const selected=item===button;item.classList.toggle('active',selected);item.setAttribute('aria-selected',String(selected))});renderDirectory()};
    document.querySelector('.site-filter-tabs').onclick=event=>{const button=event.target.closest('[data-site-filter]');if(!button)return;siteFilterMode=button.dataset.siteFilter==='no-site'?'no-site':'has-site';document.querySelectorAll('[data-site-filter]').forEach(item=>{const selected=item===button;item.classList.toggle('active',selected);item.setAttribute('aria-selected',String(selected))});renderDirectory()};
    $('#leadList').onclick=event=>{const button=event.target.closest('[data-lead-id]');if(button)openLead(button.dataset.leadId)};
    $('#notes').oninput=()=>{clearTimeout(noteTimer);$('#saveState').textContent='Saving…';noteTimer=setTimeout(async()=>{if(!active)return;const value=$('#notes').value;const {error}=await client.from('crm').update({notes:value,updated:new Date().toISOString()}).eq('id',active.id);$('#saveState').textContent=error?'Could not save': 'Saved automatically';if(!error)active.notes=value},650)};
    document.addEventListener('click',async e=>{const b=e.target.closest('[data-copy-text],[data-copy-id]');if(!b)return;const value=b.dataset.copyText||(document.getElementById(b.dataset.copyId)?.textContent||'');await navigator.clipboard.writeText(value);toast('Copied')});
    $('.tabs').onclick=e=>{const b=e.target.closest('.tab');if(!b)return;document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.script').forEach(x=>x.classList.toggle('active',x.id===b.dataset.target));};
    $('#openMessages').onclick=()=>{
      if(!active?.phone)return toast('No phone number provided.');
      const lines=[$('#previewMessage').textContent],siteUrl=outreachPreviewUrl(active);
      if(siteUrl)lines.push('','Site Preview: '+siteUrl+(siteUrl.endsWith('/')?'':'/'));
      if(siteUrl&&hasAdminSite(active))lines.push('Admin Preview: '+$('#adminUrl').textContent);
      location.href='sms:'+active.phone+'?&body='+encodeURIComponent(lines.join('\n'));
    };
    load().catch(e=>console.error('Outreach load failed',e));
  })();
