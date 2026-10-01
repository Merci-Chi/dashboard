const SUPABASE_URL='https://wfxuxrvygyzonkflpwoq.supabase.co';
const SUPABASE_KEY='sb_publishable_e2h4t8AvCobzftt36UrDbw_NJGq8qlJ';
const BASE=SUPABASE_URL+'/rest/v1/';
let rows=[];

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const label=value=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const date=value=>value?new Date(value).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}):'Unknown date';

async function api(table,path='',options={}){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch(BASE+table+path,{
      ...options,
      cache:'no-store',
      signal:controller.signal,
      headers:{
        apikey:SUPABASE_KEY,
        Authorization:'Bearer '+SUPABASE_KEY,
        'Content-Type':'application/json',
        ...(options.headers||{})
      }
    });
    const raw=await response.text();
    let body=null;
    try{body=raw?JSON.parse(raw):null}catch{body=raw}
    if(!response.ok)throw new Error(body?.message||body?.error||('Request failed ('+response.status+')'));
    return body;
  }finally{clearTimeout(timeout)}
}

async function load(){
  const list=document.querySelector('#list');
  try{
    const [website,emailRequests]=await Promise.all([
      api('website_requests','?select=*&order=created_at.desc'),
      api('dflandscape_email_requests','?select=*&order=created_at.desc')
    ]);
    rows=[
      ...(Array.isArray(website)?website:[]).map(r=>({...r,_kind:'website'})),
      ...(Array.isArray(emailRequests)?emailRequests:[]).map(r=>({...r,_kind:'email'}))
    ].sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
    render();
  }catch(error){
    rows=[];
    render();
    const message=error?.name==='AbortError'?'The requests connection timed out.':(error?.message||'Could not connect to requests.');
    list.innerHTML='<div class="error card"><strong>Could not load requests.</strong><br>'+esc(message)+'</div>';
  }
}

function requestType(r){return r._kind==='email'?'email_account':r.request_type}
function isPaid(r){return String(r.payment_status||'').toLowerCase()==='paid'}

function render(){
  document.querySelector('#total').textContent=rows.length;
  document.querySelector('#websiteCount').textContent=rows.filter(r=>r._kind==='website').length;
  document.querySelector('#emailCount').textContent=rows.filter(r=>r._kind==='email').length;
  document.querySelector('#paidCount').textContent=rows.filter(r=>r._kind==='email'&&isPaid(r)).length;

  const query=document.querySelector('#search').value.trim().toLowerCase();
  const status=document.querySelector('#statusFilter').value;
  const type=document.querySelector('#typeFilter').value;
  const priority=document.querySelector('#priorityFilter').value;

  const shown=rows.filter(r=>{
    const haystack=r._kind==='email'
      ? [r.requested_by_email,r.billing_cycle,r.status,...(Array.isArray(r.requested_emails)?r.requested_emails.flatMap(x=>[x?.name,x?.username,x?.email]):[])].join(' ').toLowerCase()
      : [r.subject,r.details,r.source_site,r.submitted_by,r.page].join(' ').toLowerCase();
    return (!status||r.status===status)&&(!type||requestType(r)===type)&&(!priority||r._kind==='email'||r.priority===priority)&&(!query||haystack.includes(query));
  });

  document.querySelector('#list').innerHTML=shown.length?shown.map(card).join(''):'<div class="empty card">No requests yet.</div>';
  bind();
}

function card(r){return r._kind==='email'?emailCard(r):websiteCard(r)}

function websiteCard(r){
  return `<article class="request card"><div class="request-top"><div class="tags"><span class="tag ${esc(r.request_type)}">${esc(label(r.request_type))}</span><span class="tag ${esc(r.priority)}">${esc(label(r.priority))}</span><span class="tag">${esc(label(r.status))}</span></div><div class="actions"><select data-table="website_requests" data-status="${esc(r.id)}"><option value="new" ${r.status==='new'?'selected':''}>New</option><option value="in_progress" ${r.status==='in_progress'?'selected':''}>In progress</option><option value="completed" ${r.status==='completed'?'selected':''}>Completed</option><option value="closed" ${r.status==='closed'?'selected':''}>Closed</option></select><button class="delete" data-table="website_requests" data-delete="${esc(r.id)}"><i class="bi bi-trash3"></i></button></div></div><h2>${esc(r.subject)}</h2><p>${esc(r.details)}</p><div class="meta"><span><i class="bi bi-building"></i> ${esc(r.source_site||'Website')}</span><span><i class="bi bi-window"></i> ${esc(r.page||'Other')}</span><span><i class="bi bi-person"></i> ${esc(r.submitted_by||'Unknown')}</span><span><i class="bi bi-clock"></i> ${esc(date(r.created_at))}</span></div></article>`;
}

function emailCard(r){
  const quantity=Number(r.quantity||0);
  const cycle=String(r.billing_cycle||'monthly').toLowerCase();
  const total=cycle==='yearly'?quantity*24:quantity*2;
  const period=cycle==='yearly'?'year':'month';
  const emails=Array.isArray(r.requested_emails)?r.requested_emails:[];
  const paid=isPaid(r);

  return `<article class="request card">
    <div class="request-top">
      <div class="tags">
        <span class="tag email_account">Email accounts</span>
        <span class="tag">${esc(label(r.status||'pending'))}</span>
        <span class="payment-pill ${paid?'paid':'not-paid'}"><i class="bi ${paid?'bi-check-circle-fill':'bi-x-circle-fill'}"></i> ${paid?'Paid':'Not paid'}</span>
      </div>
      <div class="actions">
        <select data-table="dflandscape_email_requests" data-status="${esc(r.id)}">
          <option value="pending" ${r.status==='pending'?'selected':''}>Pending</option>
          <option value="approved" ${r.status==='approved'?'selected':''}>Approved</option>
          <option value="completed" ${r.status==='completed'?'selected':''}>Completed</option>
          <option value="declined" ${r.status==='declined'?'selected':''}>Declined</option>
          <option value="cancelled" ${r.status==='cancelled'?'selected':''}>Cancelled</option>
        </select>
        <button class="delete" data-table="dflandscape_email_requests" data-delete="${esc(r.id)}"><i class="bi bi-trash3"></i></button>
      </div>
    </div>
    <h2>${quantity} additional email${quantity===1?'':'s'} — $${total}/${period}</h2>
    <p>Requested by ${esc(r.requested_by_email||'Unknown')}</p>
    <div class="email-list"><strong>Requested addresses</strong>${emails.length?emails.map(item=>`<div>${esc(item?.email||item?.username||item?.name||'Unnamed email')}</div>`).join(''):'<div>No email names saved.</div>'}</div>
    <div class="request-extra">
      <span><i class="bi bi-credit-card"></i> Payment: <strong>${paid?'Paid':'Not paid'}</strong></span>
      <span><i class="bi bi-arrow-repeat"></i> ${esc(label(cycle))}</span>
      ${r.paid_at?`<span><i class="bi bi-check-circle"></i> Paid ${esc(date(r.paid_at))}</span>`:''}
      ${r.square_payment_link?`<a href="${esc(r.square_payment_link)}" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i> Open Square checkout</a>`:''}
    </div>
    <div class="meta"><span><i class="bi bi-person"></i> ${esc(r.requested_by_email||'Unknown')}</span><span><i class="bi bi-clock"></i> ${esc(date(r.created_at))}</span></div>
  </article>`;
}

function bind(){
  document.querySelectorAll('[data-status]').forEach(input=>input.onchange=async()=>{
    input.disabled=true;
    try{
      await api(input.dataset.table,'?id=eq.'+encodeURIComponent(input.dataset.status),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:input.value,updated_at:new Date().toISOString()})});
      await load();
    }catch(error){input.disabled=false;alert(error.message)}
  });
  document.querySelectorAll('[data-delete]').forEach(button=>button.onclick=async()=>{
    if(!confirm('Delete this request permanently?'))return;
    button.disabled=true;
    try{
      await api(button.dataset.table,'?id=eq.'+encodeURIComponent(button.dataset.delete),{method:'DELETE',headers:{Prefer:'return=minimal'}});
      await load();
    }catch(error){button.disabled=false;alert(error.message)}
  });
}

['search','statusFilter','typeFilter','priorityFilter'].forEach(id=>document.querySelector('#'+id).addEventListener(id==='search'?'input':'change',render));
document.querySelector('#refresh').onclick=load;
window.addEventListener('pageshow',load);
load();
