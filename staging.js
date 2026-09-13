(() => {
 const style=document.createElement('style');style.textContent='.research-workflow{margin:-15px -15px 18px;padding:18px;border:1px solid #2e8bff;border-radius:14px;background:linear-gradient(145deg,#08213c,#041323)}.workflow-steps{display:grid;grid-template-columns:34px 1fr 34px;align-items:center;gap:9px;margin-bottom:18px}.workflow-steps i{height:2px;background:#17436f}.workflow-step{display:grid;place-items:center;width:34px;height:34px;border:1px solid #17436f;border-radius:50%;color:#8eb4dc;font-weight:900}.workflow-step.active{border-color:#73bdff;background:#1267ae;color:#fff}.workflow-step.complete{border-color:#1ed886;background:#168a53;color:#fff}.workflow-page{display:none}.workflow-page.active{display:block;animation:workflow-in .22s ease}.workflow-kicker{color:#73bdff;font-size:10px;font-weight:900;letter-spacing:.16em}.workflow-page h3{margin:4px 0;font-size:22px}.workflow-page p{margin:0 0 13px;color:#8eb4dc}.workflow-prompt,.workflow-results{width:100%;min-height:245px;padding:13px;border:1px solid #17436f;border-radius:10px;background:#03101e;color:#eef7ff;line-height:1.45;resize:vertical}.workflow-results{min-height:180px;margin-top:6px}.workflow-label{display:block;margin-top:14px;color:#73bdff;font-size:12px;font-weight:800}.workflow-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}.build-files{display:none}.workflow-ready .build-files{display:block}.build-files-title{margin:22px 0 12px;padding-top:18px;border-top:1px solid #17436f;color:#73bdff;font-size:12px;font-weight:900;letter-spacing:.12em}@keyframes workflow-in{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}';document.head.appendChild(style);
 const listEl=document.getElementById('stagingList'),status=document.getElementById('status'),filePicker=document.getElementById('filePicker'),folderPicker=document.getElementById('folderPicker');let leads=[],projects=[],active=null,activeProject=null,workflowStep=1,researchDraft='';const MAX=25*1024*1024,fmt=n=>n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`,size=x=>(x?.files||[]).reduce((n,f)=>n+(f.size||0),0),message=(t,e=false)=>{status.textContent=t;status.classList.toggle('error',e)};
 const researchPrompt=`Look up everything you can find publicly about this company: **[COMPANY NAME]**.

Your goal is to collect accurate, website-ready business information.

Research:

- Owner or primary business contact’s name
- Business address, but only if publicly listed on Google Maps, Apple Maps, or another reputable business directory—never include a private residential address
- Company phone number and public email address
- Business hours
- Known services, specialties, products, and publicly advertised pricing
- Service areas, cities, neighborhoods, and locations served
- Social profiles, including Instagram, Facebook, Nextdoor, TikTok, LinkedIn, YouTube, Yelp, and others
- Current and previous websites, including useful archived information
- Google Business Profile, Apple Maps, Yelp, BBB, and other directory listings
- Public links to photos of completed work, products, employees, storefronts, logos, vehicles, or other useful business imagery
- Reviews, ratings, testimonials, awards, licenses, certifications, and years in business
- Brand details, including slogans, colors, tone, values, and unique selling points
- Frequently mentioned customer questions, needs, or concerns
- Any other verified information that would help create a professional website

Research rules:

- Cross-reference multiple reliable public sources whenever possible.
- Do not guess, assume, or invent missing information.
- Put a direct source link beside every finding.
- Clearly label conflicting or uncertain information as “Unverified.”
- Use “Not found” when no reliable information is available.
- Do not include the owner’s private home address.
- Only include an address when it is publicly presented as the business address on a reputable map or business listing.
- Do not treat similarly named businesses as the same company without supporting evidence.
- Prefer official profiles, map listings, government records, and established business directories.
- Do not copy long passages from sources; summarize the information.

Format the response exactly as follows:

**Business Research Report**

**1. Business Overview**

- **Company name:**
- **Business category:**
- **Short description:**
- **Years in business:**
- **Owner or primary contact:**
- **License or certification details:**

**2. Contact Information**

- **Business phone:**
- **Public email:**
- **Business address:**
- **Business hours:**
- **Primary service area:**

**3. Services and Products**

|   |
| - |

**Service or product**

|   |
| - |

**Description**

|   |
| - |

**Price, if public**

|   |
| - |

**Source**

**4. Locations Served**

- **Cities:**
- **Neighborhoods:**
- **Counties or regions:**
- **Travel or service-radius information:**

**5. Online Profiles**

|   |
| - |

**Platform**

|   |
| - |

**Profile name**

|   |
| - |

**Direct URL**

|   |
| - |

**Verified match?**

**6. Websites**

|   |
| - |

**Website**

|   |
| - |

**Current or previous**

|   |
| - |

**Useful information found**

|   |
| - |

**Source**

**7. Photos and Brand Assets**

|   |
| - |

**Asset type**

|   |
| - |

**Description**

|   |
| - |

**Direct source URL**

|   |
| - |

**Usage notes**

Include public links to relevant photos, logos, completed work, products, storefronts, employees, or company vehicles. Do not claim that an image is free to reuse unless the source explicitly provides reuse permission.

**8. Reviews and Reputation**

- **Average rating:**
- **Number of reviews:**
- **Common positive themes:**
- **Common complaints or concerns:**
- **Strong testimonial excerpts, paraphrased:**
- **Awards or recognition:**

**9. Brand and Website Direction**

- **Known slogan:**
- **Brand colors:**
- **Brand tone:**
- **Unique selling points:**
- **Customer priorities:**
- **Recommended website sections:**
- **Recommended calls to action:**

**10. Frequently Asked Questions**

|   |
| - |

**Question**

|   |
| - |

**Verified or suggested answer**

|   |
| - |

**Source**

**11. Missing or Unverified Information**

List every important item that could not be verified, along with any conflicting information that needs confirmation from the business owner.

**12. Sources**

Provide a numbered list of every source used. Include the source name and complete direct URL. Do not include search-result URLs.

Keep the report concise but thorough. Use short bullets, plain language, consistent capitalization, and Markdown tables exactly where specified. Every factual statement must include a source or clearly say “Not found,” “Unverified,” or “Suggested.”`;
 const websitePrompt=`**Site Development Prompt**

Create a unique, professional, mobile-responsive website using the company research data provided below.

**Design Requirements**

- Create an original design tailored to this specific company.
- Do not use a generic template or duplicate another website.
- Build a desktop version and a fully responsive mobile version.
- Include a mobile navigation menu represented by a three-line hamburger icon.
- Prevent mobile zooming in and zooming out.
- Disable text highlighting and text selection throughout the website.
- Use accessible contrast, readable typography, clear spacing, and polished visual hierarchy.
- Make buttons, phone numbers, email addresses, map links, social links, and other provided links functional.
- Use subtle, professional animations where appropriate.
- Ensure the website loads quickly and works across modern browsers.

**Content Requirements**

Use only information supported by the research data. Do not invent facts, prices, reviews, locations, credentials, or services.

Include these sections only when reliable information is available:

- Business overview
- About the company
- Owner or team information
- Products and services
- Service areas and locations
- Business hours
- Contact information
- Google, Yelp, or other verified reviews
- Testimonials
- Photo gallery
- Frequently asked questions
- Social-media links
- Current or previous website links
- Awards, licenses, certifications, or years in business
- Clear calls to action

If reviews, photos, a gallery, products, services, locations, or other information are unavailable, do not create empty sections or placeholder claims. Omit those sections entirely.

If no suitable business photos are available online, use tasteful, relevant stock photos that match the company’s industry and brand. Clearly identify stock imagery in the asset list and do not imply that it shows the actual business, employees, products, or completed work.

**Data and Accuracy Rules**

- Use the research data exactly as the factual source.
- Do not guess or fill gaps with invented information.
- Mark conflicting information for review.
- Exclude private residential addresses and other sensitive personal information.
- Only show a business address if it is publicly listed as the company’s business address.
- Preserve direct source links where appropriate.
- Do not copy long passages from other websites.
- Keep the writing natural, concise, professional, and specific to the company.

**Deliverables**

Provide:

1. Website structure and page layout.
2. Complete website copy for every included section.
3. Desktop and mobile design direction.
4. Color palette, typography, spacing, and component guidance.
5. Image and asset recommendations.
6. Functional calls-to-action.
7. SEO title, meta description, headings, and local SEO recommendations.
8. A list of missing information, unsupported claims, and items requiring approval.
9. A final quality checklist confirming that:
   - The mobile menu works.
   - The site cannot zoom in or out on mobile.
   - Text highlighting is disabled.
   - No unavailable sections were included.
   - No unsupported claims were added.
   - All links and contact actions work.

**Company Research Data**

[BUSINESS RESEARCH REPORT from step one HERE]`;
 function workflowMarkup(){const company=active?.company||active?.name||'this company',developmentPrompt=websitePrompt.replace('[BUSINESS RESEARCH REPORT from step one HERE]',researchDraft||'[BUSINESS RESEARCH REPORT from step one HERE]');return `<section class="research-workflow"><div class="workflow-steps"><span class="workflow-step ${workflowStep===1?'active':'complete'}" data-workflow-dot="1">1</span><i></i><span class="workflow-step ${workflowStep===2?'active':''}" data-workflow-dot="2">2</span></div><div class="workflow-page ${workflowStep===1?'active':''}" data-workflow-page="1"><span class="workflow-kicker">STEP 1 · RESEARCH</span><h3>Research ${SitePipeline.escapeHTML(company)}</h3><p>Copy this prompt, complete the research, then paste the report below.</p><textarea class="workflow-prompt" id="researchPrompt" readonly>${SitePipeline.escapeHTML(researchPrompt.replace('[COMPANY NAME]',company))}</textarea><div class="workflow-actions"><button class="btn primary" data-copy-research type="button"><i class="bi bi-copy"></i> Copy Research Prompt</button></div><label class="workflow-label" for="researchResults">Paste research results</label><textarea class="workflow-results" id="researchResults" placeholder="Paste the completed Business Research Report here…">${SitePipeline.escapeHTML(researchDraft)}</textarea><div class="workflow-actions"><button class="btn primary" data-next-workflow type="button">Continue to Site Development <i class="bi bi-arrow-right"></i></button></div></div><div class="workflow-page ${workflowStep===2?'active':''}" data-workflow-page="2"><span class="workflow-kicker">STEP 2 · SITE DEVELOPMENT</span><h3>Create the website</h3><p>Your research report is already included at the bottom. Copy the complete prompt to begin the build.</p><textarea class="workflow-prompt" id="websitePrompt" readonly>${SitePipeline.escapeHTML(developmentPrompt)}</textarea><div class="workflow-actions"><button class="btn" data-back-workflow type="button"><i class="bi bi-arrow-left"></i> Back</button><button class="btn primary" data-copy-website type="button"><i class="bi bi-copy"></i> Copy Site Development Prompt</button></div></div></section>`}
 function setWorkflowStep(step){workflowStep=step;document.getElementById('uploadWorkspace').classList.toggle('workflow-ready',step===2);document.querySelectorAll('[data-workflow-page]').forEach(page=>page.classList.toggle('active',Number(page.dataset.workflowPage)===step));document.querySelectorAll('[data-workflow-dot]').forEach(dot=>{const n=Number(dot.dataset.workflowDot);dot.classList.toggle('active',n===step);dot.classList.toggle('complete',n<step)})}
 const previewUrl=(...values)=>{for(const value of values){const raw=String(value||'').trim();if(!raw)continue;try{const u=new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw)?raw:`https://${raw}`),h=u.hostname.toLowerCase().replace(/^www\./,'');if(h==='viewyoursite.today'||h.endsWith('.viewyoursite.today'))return u.href}catch{}}return''};
 async function load(){try{const db=await SitePipeline.init(),[crm,sites]=await Promise.all([db.from('crm').select('*').order('company',{ascending:true}),SitePipeline.list()]);if(crm.error)throw crm.error;projects=sites;const sitePreviewByCrm=new Map();for(const site of sites){const preview=previewUrl(site.previewurl,site.liveurl);if(preview&&site.lead_id&&!sitePreviewByCrm.has(String(site.lead_id)))sitePreviewByCrm.set(String(site.lead_id),preview)}leads=(crm.data||[]).filter(lead=>!previewUrl(lead.previewurl,lead.website,sitePreviewByCrm.get(String(lead.id))));renderList();if(active){active=leads.find(lead=>lead.id===active.id)||null;if(active){activeProject=projects.find(item=>item.lead_id===active.id)||activeProject;renderDetail()}else showList()}}catch(error){message(error.message,true)}}
 function renderList(){const q=String(document.getElementById('stagingSearch').value||'').trim().toLowerCase(),matches=leads.filter(lead=>!q||[lead.company,lead.name,lead.phone,lead.email].some(value=>String(value||'').toLowerCase().includes(q)));message(`${matches.length} lead${matches.length===1?'':'s'} need a site`);listEl.innerHTML=matches.map(lead=>`<button class="card staging-lead" data-lead="${SitePipeline.escapeHTML(lead.id)}" type="button"><span class="staging-lead-icon"><i class="bi bi-buildings"></i></span><span><strong>${SitePipeline.escapeHTML(lead.company||'Unnamed business')}</strong><span>${SitePipeline.escapeHTML(lead.name||'No contact')} · ${SitePipeline.escapeHTML(lead.phone||'No phone')}</span></span><span class="needs-site">Needs Site</span></button>`).join('')||'<div class="empty"><div><i class="bi bi-check2-circle"></i><strong>Every CRM lead has a site preview.</strong></div></div>'}
 function showList(){active=null;activeProject=null;workflowStep=1;researchDraft='';document.getElementById('stagingDirectory').hidden=false;document.getElementById('stagingDetail').hidden=true;renderList();window.scrollTo({top:0,behavior:'smooth'})}
 function openLead(id){active=leads.find(lead=>String(lead.id)===String(id));if(!active)return;activeProject=projects.find(item=>String(item.lead_id)===String(active.id))||null;workflowStep=1;researchDraft='';document.getElementById('stagingDirectory').hidden=true;document.getElementById('stagingDetail').hidden=false;renderDetail();window.scrollTo({top:0,behavior:'smooth'})}
 function renderDetail(){document.getElementById('detailCompany').textContent=active.company||'Unnamed business';document.getElementById('detailContact').textContent=[active.name,active.email,active.phone].filter(Boolean).join(' · ')||'No contact information';const files=activeProject?.files||[],workspace=document.getElementById('uploadWorkspace');workspace.classList.toggle('workflow-ready',workflowStep===2);workspace.innerHTML=`${workflowMarkup()}<div class="build-files"><div class="build-files-title">WEBSITE FILES</div><div class="upload-head"><div class="company"><strong>${SitePipeline.escapeHTML(active.company||'Unnamed business')}</strong><span>${SitePipeline.escapeHTML(active.name||'No contact')}</span></div><span class="badge">Needs Site</span></div><div class="drop-zone" data-drop><i class="bi bi-envelope-arrow-up-fill"></i><strong>Drag and drop files or folders</strong><span>HTML, CSS, JS, pages, folders, and assets</span><div class="drop-actions"><button class="btn secondary" data-files>Choose Files</button><button class="btn secondary" data-folder>Choose Folder</button></div></div><div class="file-summary"><strong>${files.length} files · ${fmt(size(activeProject))}</strong><span>25 MB maximum</span></div><div class="file-list">${files.map(file=>`<span><i class="bi bi-file-earmark-code"></i>${SitePipeline.escapeHTML(file.path)}<small>${fmt(file.size)}</small></span>`).join('')||'<em>No files attached.</em>'}</div><div class="review-actions"><button class="btn" data-review ${files.length?'':'disabled'}>Send to Review</button></div></div>`}
 async function ensureProject(){if(activeProject)return activeProject;activeProject=await SitePipeline.create({leadId:active.id,company:active.company,contactName:active.name,email:active.email,phone:active.phone});projects.push(activeProject);return activeProject}
 async function add(input){const project=await ensureProject(),files=[...input].filter(file=>file.name!=='.DS_Store'&&!String(file.webkitRelativePath||file.pipelinePath).includes('node_modules')&&!String(file.webkitRelativePath||file.pipelinePath).includes('/.git/'));if(size(project)+files.reduce((n,file)=>n+file.size,0)>MAX)return message('This website exceeds 25 MB.',true);for(const file of files){const path=file.pipelinePath||file.webkitRelativePath||file.name;await SitePipeline.upload(project.id,path,file);const meta={path,size:file.size,type:file.type||'application/octet-stream'},index=(project.files||[]).findIndex(item=>item.path===path);project.files=project.files||[];index>=0?project.files[index]=meta:project.files.push(meta)}await SitePipeline.update(project.id,{files:project.files});message(`${files.length} files uploaded.`);renderDetail()}
 function entry(item,path=''){return new Promise(resolve=>{if(item.isFile)item.file(file=>{file.pipelinePath=path+file.name;resolve([file])});else{const reader=item.createReader(),all=[];const next=()=>reader.readEntries(async entries=>{if(!entries.length)return resolve(all);for(const child of entries)all.push(...await entry(child,`${path}${item.name}/`));next()});next()}})}async function dropped(dt){const entries=[...(dt.items||[])].map(item=>item.webkitGetAsEntry?.()).filter(Boolean),out=[];if(!entries.length)return[...dt.files];for(const item of entries)out.push(...await entry(item));return out}
 listEl.onclick=e=>{const b=e.target.closest('[data-lead]');if(b)openLead(b.dataset.lead)};document.getElementById('backToStaging').onclick=showList;document.getElementById('stagingSearch').oninput=renderList;document.getElementById('uploadWorkspace').onclick=async e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-files'))filePicker.click();if(b.hasAttribute('data-folder'))folderPicker.click();if(b.hasAttribute('data-review')){const p=await ensureProject();await SitePipeline.update(p.id,{status:'review',returnNote:''});message('Sent to Review');showList()}};for(const picker of[filePicker,folderPicker])picker.onchange=async()=>{try{await add(picker.files)}catch(error){message(error.message,true)}picker.value=''};document.getElementById('uploadWorkspace').ondragover=e=>{if(e.target.closest('[data-drop]'))e.preventDefault()};document.getElementById('uploadWorkspace').ondrop=async e=>{if(!e.target.closest('[data-drop]'))return;e.preventDefault();try{await add(await dropped(e.dataTransfer))}catch(error){message(error.message,true)}};load();
 document.getElementById('uploadWorkspace').addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-copy-research')){await navigator.clipboard.writeText(document.getElementById('researchPrompt').value);message('Research prompt copied.')}if(b.hasAttribute('data-copy-website')){await navigator.clipboard.writeText(document.getElementById('websitePrompt').value);message('Site development prompt copied.')}if(b.hasAttribute('data-next-workflow')){const results=document.getElementById('researchResults');researchDraft=results.value.trim();if(!researchDraft)return message('Paste the research results before continuing.',true);document.getElementById('websitePrompt').value=websitePrompt.replace('[BUSINESS RESEARCH REPORT from step one HERE]',researchDraft);setWorkflowStep(2);window.scrollTo({top:0,behavior:'smooth'})}if(b.hasAttribute('data-back-workflow')){researchDraft=document.getElementById('researchResults')?.value.trim()||researchDraft;setWorkflowStep(1);window.scrollTo({top:0,behavior:'smooth'})}});
})();
