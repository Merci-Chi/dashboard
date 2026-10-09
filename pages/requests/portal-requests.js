import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const db=createClient('https://glonbvrcudwuzjundrii.supabase.co','sb_publishable_VZbed_uuOXSE744UrAfHXw_z2xDdYtr');
const box=document.getElementById('portal-requests-list');
const status=document.getElementById('portal-requests-status');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const states=['submitted','under_review','in_progress','completed','declined'];
let records=[];
async function load(){
 status.textContent='Loading portal requests…';box.innerHTML='';
 const {data:{session}}=await db.auth.getSession();
 if(!session){status.textContent='Sign in to the Steady Hands admin dashboard, then reload this page.';return}
 const {data,error}=await db.from('portal_service_requests').select('id,company_name,request_type,title,details,status,created_at,user_id').order('created_at',{ascending:false}).limit(200);
 if(error){status.textContent='Unable to load: '+error.message+'. If access is denied, run the Admin Requests SQL below.';return}
 records=data||[];
 status.textContent=records.length+' portal request'+(records.length===1?'':'s');
 box.innerHTML=records.length?records.map(r=>`<article class="portal-request-card"><div class="portal-request-info"><strong>${esc(r.title)}</strong><small>${esc(r.company_name)} · ${esc(r.request_type.replaceAll('_',' '))} · ${esc(new Date(r.created_at).toLocaleString())}</small><p>${esc(r.details)}</p><small>Submitted by account: ${esc(r.user_id)}</small></div><div class="portal-request-controls"><label>Status<select data-request-id="${esc(r.id)}">${states.map(s=>`<option value="${s}" ${s===r.status?'selected':''}>${esc(s.replaceAll('_',' '))}</option>`).join('')}</select></label></div></article>`).join(''):'<div class="empty card">No portal requests have been submitted.</div>';
}
box.addEventListener('change',async e=>{
 const field=e.target.closest('select[data-request-id]');if(!field)return;
 const id=field.dataset.requestId,chosen=field.value,old=records.find(r=>r.id===id)?.status;
 field.disabled=true;
 const {error}=await db.from('portal_service_requests').update({status:chosen}).eq('id',id);
 if(error){field.value=old;status.textContent='Could not update status: '+error.message;}else{status.textContent='Request status saved. The client will see it on their Requests page.';if(records.find(r=>r.id===id))records.find(r=>r.id===id).status=chosen}
 field.disabled=false;
});
document.getElementById('portal-refresh').addEventListener('click',load);
window.addEventListener('pageshow',load);
load();
