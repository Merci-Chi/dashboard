(() => {
 const URL='https://glonbvrcudwuzjundrii.supabase.co',KEY='sb_publishable_VZbed_uuOXSE744UrAfHXw_z2xDdYtr',BUCKET='site-code';let client;
 const escapeHTML=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
 async function init(){if(!client&&window.parent!==window)client=window.parent.supabaseClient||null;if(!client){if(!window.supabase?.createClient)throw Error('Supabase library did not load.');client=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}})}const{data}=await client.auth.getSession();if(!data.session)throw Error('Sign in to the main dashboard first.');return client}
 const normalize=x=>({...x,contactName:x.contact_name||'',returnNote:x.return_note||'',checks:x.review_checks||{},liveAt:x.live_at||'',clientData:x.client_data||{}});
 async function list(statuses=[]){await init();let q=client.from('site_projects').select('*').order('created_at',{ascending:true});if(statuses.length)q=q.in('status',statuses);const{data,error}=await q;if(error)throw error;return(data||[]).map(normalize)}
 async function listBilling(){await init();const{data,error}=await client.from('billing_subscriptions').select('*, payment_history(*)').in('status',['ACTIVE','CANCELED','PAUSED','DEACTIVATED','PENDING']).order('created_at',{ascending:true});if(error)throw error;return data||[]}
 async function listAgreements(){await init();const{data,error}=await client.from('hosting_agreements').select('*').order('signed_at',{ascending:false});if(error)throw error;return data||[]}
 async function create(p){await init();const{data,error}=await client.from('site_projects').insert({lead_id:String(p.leadId||''),company:p.company,contact_name:p.contactName||'',email:p.email||'',phone:p.phone||'',status:'staging'}).select().single();if(error)throw error;return normalize(data)}
 async function update(id,changes){await init();const map={contactName:'contact_name',returnNote:'return_note',checks:'review_checks',liveAt:'live_at',clientData:'client_data'},row={};for(const[k,v]of Object.entries(changes))row[map[k]||k]=v;const{error}=await client.from('site_projects').update(row).eq('id',id);if(error)throw error;return{...changes,id}}
 async function remove(id){await init();const{error}=await client.from('site_projects').delete().eq('id',id);if(error)throw error}
 async function upload(id,path,file){await init();const{error}=await client.storage.from(BUCKET).upload(`${id}/${path}`,file,{upsert:true,contentType:file.type||'application/octet-stream'});if(error)throw error}
 async function download(id,path){await init();const{data,error}=await client.storage.from(BUCKET).download(`${id}/${path}`);if(error)throw error;return data}
 async function removeFiles(id,files){await init();const paths=(files||[]).map(f=>`${id}/${f.path}`);if(!paths.length)return;const{error}=await client.storage.from(BUCKET).remove(paths);if(error)throw error}
 window.SitePipeline={init,list,listBilling,listAgreements,create,update,remove,upload,download,removeFiles,escapeHTML};
})();
