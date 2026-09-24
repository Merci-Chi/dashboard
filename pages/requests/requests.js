const URL='https://wfxuxrvygyzonkflpwoq.supabase.co';
    const ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmeHV4cnZ5Z3l6b25rZmxwd29xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4ODI2MjEsImV4cCI6MjEwMzQ1ODYyMX0.SpvX06m-ZptRRy5LNU6pOa-ZvMmGJ-8vFUi9cZekS7M';
    const REST=URL+'/rest/v1/website_requests';
    let rows=[];

    const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    const label=value=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
    const date=value=>value?new Date(value).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}):'Unknown date';

    async function api(path='',options={}){
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),8000);
      try{
        const response=await fetch(REST+path,{
          ...options,
          cache:'no-store',
          signal:controller.signal,
          headers:{
            apikey:ANON_KEY,
            Authorization:'Bearer '+ANON_KEY,
            'Content-Type':'application/json',
            ...(options.headers||{})
          }
        });
        const raw=await response.text();
        let body=null;
        try{body=raw?JSON.parse(raw):null}catch{body=raw}
        if(!response.ok)throw new Error(body?.message||body?.error||('Request failed ('+response.status+')'));
        return body;
      }finally{
        clearTimeout(timeout);
      }
    }

    async function load(){
      const list=document.querySelector('#list');
      try{
        const data=await api('?select=*&order=created_at.desc');
        rows=Array.isArray(data)?data:[];
        render();
      }catch(error){
        rows=[];
        render();
        const message=error?.name==='AbortError'?'The requests connection timed out.':(error?.message||'Could not connect to website_requests.');
        list.innerHTML='<div class="error card"><strong>Could not load requests.</strong><br>'+esc(message)+'</div>';
      }
    }

    function render(){
      document.querySelector('#total').textContent=rows.length;
      document.querySelector('#newCount').textContent=rows.filter(r=>r.status==='new').length;
      document.querySelector('#progressCount').textContent=rows.filter(r=>r.status==='in_progress').length;
      document.querySelector('#doneCount').textContent=rows.filter(r=>r.status==='completed').length;
      const query=document.querySelector('#search').value.trim().toLowerCase();
      const status=document.querySelector('#statusFilter').value;
      const type=document.querySelector('#typeFilter').value;
      const priority=document.querySelector('#priorityFilter').value;
      const shown=rows.filter(r=>(!status||r.status===status)&&(!type||r.request_type===type)&&(!priority||r.priority===priority)&&(!query||[r.subject,r.details,r.source_site,r.submitted_by,r.page].join(' ').toLowerCase().includes(query)));
      document.querySelector('#list').innerHTML=shown.length?shown.map(card).join(''):'<div class="empty card">No requests yet.</div>';
      bind();
    }

    function card(r){return `<article class="request card"><div class="request-top"><div class="tags"><span class="tag ${esc(r.request_type)}">${esc(label(r.request_type))}</span><span class="tag ${esc(r.priority)}">${esc(label(r.priority))}</span><span class="tag">${esc(label(r.status))}</span></div><div class="actions"><select data-status="${esc(r.id)}" aria-label="Request status"><option value="new" ${r.status==='new'?'selected':''}>New</option><option value="in_progress" ${r.status==='in_progress'?'selected':''}>In progress</option><option value="completed" ${r.status==='completed'?'selected':''}>Completed</option><option value="closed" ${r.status==='closed'?'selected':''}>Closed</option></select><button class="delete" data-delete="${esc(r.id)}" title="Delete request" aria-label="Delete request"><i class="bi bi-trash3"></i></button></div></div><h2>${esc(r.subject)}</h2><p>${esc(r.details)}</p><div class="meta"><span><i class="bi bi-building"></i> ${esc(r.source_site||'Website')}</span><span><i class="bi bi-window"></i> ${esc(r.page||'Other')}</span><span><i class="bi bi-person"></i> ${esc(r.submitted_by||'Unknown')}</span><span><i class="bi bi-clock"></i> ${esc(date(r.created_at))}</span></div></article>`}

    function bind(){
      document.querySelectorAll('[data-status]').forEach(input=>input.onchange=async()=>{
        input.disabled=true;
        try{
          await api('?id=eq.'+encodeURIComponent(input.dataset.status),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:input.value,updated_at:new Date().toISOString()})});
          await load();
        }catch(error){input.disabled=false;alert(error.message)}
      });
      document.querySelectorAll('[data-delete]').forEach(button=>button.onclick=async()=>{
        if(!confirm('Delete this request permanently?'))return;
        button.disabled=true;
        try{
          await api('?id=eq.'+encodeURIComponent(button.dataset.delete),{method:'DELETE',headers:{Prefer:'return=minimal'}});
          await load();
        }catch(error){button.disabled=false;alert(error.message)}
      });
    }

    ['search','statusFilter','typeFilter','priorityFilter'].forEach(id=>document.querySelector('#'+id).addEventListener(id==='search'?'input':'change',render));
    document.querySelector('#refresh').onclick=load;
    window.addEventListener('pageshow',load);
    load();
