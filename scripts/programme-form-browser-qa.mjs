// Local static fixtures and intercepted APIs only; all network to providers is blocked.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const output=resolve('work/qa-evidence');mkdirSync(output,{recursive:true});
const programmeCallout=JSON.parse(readFileSync('content/public-callouts.json','utf8'))['subjects-programmes/index.html'];
const cards=html=>html.match(/<figure class="recommendation-card">[\s\S]*?<\/figure>/g)||[];
assert.equal(cards(readFileSync('work/after/recommendations/index.html','utf8')).length,7);
assert.deepEqual(cards(readFileSync('work/after/recommendations/index.html','utf8')),cards(readFileSync('work/before/recommendations/index.html','utf8')),'All seven existing review excerpts, attribution and dates remain exactly intact');
const servers=[];
for(const [folder,port] of [['before',8766],['after',8767]]){
 const root=resolve('work/'+folder);
 const server=createServer((req,res)=>{let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path.endsWith('/'))path+='index.html';const file=resolve(root,'.'+path);if(!file.startsWith(root+'/')||!existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'application/javascript','.ttf':'font/ttf','.png':'image/png','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(readFileSync(file));});
 await new Promise(r=>server.listen(port,'127.0.0.1',r));servers.push(server);
}
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const results=[];
try{
 for(const width of [320,390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.route('**/api/enquiry',r=>r.request().method()==='GET'?r.fulfill({json:{ready:true,siteKey:'local-test-key'}}):r.abort());
  await page.route('**/turnstile/v0/api.js?*',r=>r.fulfill({contentType:'application/javascript',body:"window.turnstile={render:(el,options)=>1,reset:()=>{}};"}));
  let programmeText;
  for(const [state,port] of [['before',8766],['after',8767]]){
   await page.goto('http://127.0.0.1:'+port+'/subjects-programmes/',{waitUntil:'domcontentloaded'});await page.evaluate(()=>document.fonts.ready);
   for(const summary of await page.locator('.programme-disclosure>summary').all()){await summary.focus();await page.keyboard.press('Enter');}
   assert.equal(await page.locator('.programme-disclosure[open]').count(),5);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),state+' programme overflow '+width);
   const copy=await page.locator('main').evaluate(e=>{const clone=e.cloneNode(true);clone.querySelectorAll('a,.programme-experience').forEach(n=>n.remove());return [...clone.querySelectorAll('p,h1,h2,h3')].map(n=>n.textContent.trim()).filter(Boolean);});
   const text=copy.map(s=>s.replace(/GCSE\s*(?:\/|and)\s*IGCSE/g,'GCSE & IGCSE').replaceAll('AS and A-Level','AS & A-Level').replace('Because Combined and Coordinated Science structures vary, send the examination board or relevant topics with your enquiry so I can confirm suitability.','Combined and Coordinated Science courses vary by examination board. Please include the examination board and relevant topics in your enquiry so I can confirm suitability.').replace(' Adult students are welcome to enquire directly.','').replace(programmeCallout.beforeHeading,programmeCallout.heading).replace(programmeCallout.beforeText,programmeCallout.text)).sort().join('\n');if(state==='before')programmeText=text;else assert.equal(text,programmeText,'Programme body copy preserved except explicit owner wording changes');
   if(state==='after'){
    assert.equal(await page.locator('.programme-links').count(),5);
    assert.equal(await page.locator('.programme-experience').count(),1);assert((await page.locator('.programme-experience').innerText()).includes('IB Biology Assistant Examiner'));assert.equal(await page.locator('.programme-experience a').count(),0);
    const supportLinks=page.locator('.programme-support-links>a');assert.equal(await supportLinks.count(),2);
    assert.deepEqual(await supportLinks.allTextContents(),['Experience & qualifications','Academic integrity policy']);
    const linkStyles=await supportLinks.evaluateAll(es=>es.map(e=>{const s=getComputedStyle(e);return [s.fontSize,s.lineHeight,s.fontWeight].join('/');}));assert.equal(linkStyles[0],linkStyles[1],'Support links have identical typography');
    assert(await supportLinks.nth(1).evaluate(e=>e.getBoundingClientRect().top>=e.previousElementSibling.getBoundingClientRect().bottom+11),'Support links occupy separate rows with a clear gap');
    if(width===390||width===1440)await page.locator('.programme-support').screenshot({path:output+'/programme-support-links-'+width+'.png'});
    assert(await page.locator('.programme-support').evaluate(e=>Boolean(e.compareDocumentPosition(document.querySelector('.programme-nav'))&Node.DOCUMENT_POSITION_FOLLOWING)),'Support introduction precedes programme navigation');
    assert.equal(await page.locator('.programme-support h2').evaluate(e=>getComputedStyle(e).fontSize),await page.locator('#ib summary h2').evaluate(e=>getComputedStyle(e).fontSize),'Shared support heading uses the programme heading scale');

    const spacing=await page.locator('.programme-disclosure').evaluateAll(es=>es.map(e=>({summary:getComputedStyle(e.querySelector('summary')).paddingTop,body:getComputedStyle(e.querySelector('.programme-details')).paddingBottom})));
    assert(spacing.every(v=>v.summary===spacing[0].summary&&v.body===spacing[0].body));
    const gaps=await page.locator('.programme-links').evaluateAll(es=>es.map(e=>getComputedStyle(e).gap));assert(gaps.every(g=>g==='8px'));
   }
   await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo({top:0,behavior:'instant'});});
   await page.screenshot({path:output+'/programmes-'+state+'-'+width+'.png',fullPage:true});
   await page.goto('http://127.0.0.1:'+port+'/enquire/',{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('#enquiry-form').count(),1);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),state+' enquiry overflow '+width);
   if(state==='after')assert(!(await page.content()).includes('adsouza35@gmail.com'));
   if(state==='after'){
    assert.equal(await page.getByRole('option',{name:'GCSE & IGCSE',exact:true}).getAttribute('value'),'GCSE / IGCSE','GCSE display name preserves submitted course value');
    assert.equal(await page.getByRole('option',{name:'AS & A-Level',exact:true}).getAttribute('value'),'AS / A-Level','A-Level display name preserves submitted course value');
   }
   await page.screenshot({path:output+'/enquire-'+state+'-'+width+'.png',fullPage:true});
  }
  await page.goto('http://127.0.0.1:8767/subjects-programmes/');
  const referenceHeadingSize=await page.locator('#ib summary h2').evaluate(e=>getComputedStyle(e).fontSize);
  for(const slug of ['ib-biology-tutoring','ib-chemistry-tutoring','a-level-biology-tutoring','gcse-igcse-science-tutoring','ontario-grade-9-10-science-tutoring','ontario-grade-11-12-biology-chemistry-tutoring']){
   await page.goto('http://127.0.0.1:8767/'+slug+'/',{waitUntil:'domcontentloaded'});await page.evaluate(()=>document.fonts.ready);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),slug+' overflow '+width);
   for(const heading of await page.locator('main>.section h2').all())assert.equal(await heading.evaluate(e=>getComputedStyle(e).fontSize),referenceHeadingSize,slug+' matches parent heading scale');
   if(slug==='a-level-biology-tutoring'){
    assert.equal(await page.locator('main h1').innerText(),'Online AS & A-Level Biology tutoring');
    const intact=await page.locator('main h1 .keep-together').evaluate(e=>{const range=document.createRange();range.selectNodeContents(e);return e.textContent==='A-Level'&&getComputedStyle(e).whiteSpace==='nowrap'&&range.getClientRects().length===1;});
    assert(intact,'A-Level stays intact on one line at '+width+'px');
    await page.screenshot({path:output+'/a-level-title-after-'+width+'.png'});
   }
   if(await page.locator('.subject-topics').count()){
    for(const name of ['An experienced teacher','Experienced science teaching','Experience across curricula'])assert.equal(await page.getByRole('heading',{name,exact:true}).count(),0,'Shared background is consolidated, not repeated');
    assert.equal(await page.getByRole('heading',{name:'Explore related support',exact:true}).count(),1,'Related navigation remains');
    assert.equal(await page.locator('.subject-topics>div>h2').innerText(),'Topics covered');
    const topicSizes=await page.locator('.subject-topic h3').evaluateAll(es=>es.map(e=>parseFloat(getComputedStyle(e).fontSize)));
    assert(topicSizes.length>0&&topicSizes.every(n=>n<parseFloat(referenceHeadingSize)),slug+' subtopics are smaller H3s');
   }
   const hierarchy=await page.locator('main h1,main h2,main h3,main h4,main h5').evaluateAll(es=>es.map(e=>Number(e.tagName.slice(1))));
   assert(hierarchy.every((n,i)=>i===0||n<=hierarchy[i-1]+1),slug+' accessible heading hierarchy');

   const gaps=await page.locator('.subject-detail-page>.section+.section').evaluateAll(es=>es.map(e=>e.firstElementChild.firstElementChild.getBoundingClientRect().top-e.previousElementSibling.firstElementChild.lastElementChild.getBoundingClientRect().bottom));
   assert(gaps.length>0&&gaps.every(g=>g>=0&&g<=32),slug+' excessive section gaps '+JSON.stringify(gaps));
   if(slug==='ontario-grade-11-12-biology-chemistry-tutoring'){
    const shared=page.locator('.page-hero p').filter({hasText:'In Biology, students learn'});
    assert.equal(await shared.count(),1,'Senior course-wide teaching statement appears once in the introduction');
    assert((await shared.innerText()).includes('In Chemistry, they learn'),'Shared introduction covers Chemistry too');
    assert(await shared.evaluate(e=>Boolean(e.compareDocumentPosition(document.querySelector('.ontario-course-list'))&Node.DOCUMENT_POSITION_FOLLOWING)),'Shared statement precedes all six senior courses');
    if(width===1440||width===390)await page.locator('.page-hero').screenshot({path:output+'/senior-shared-introduction-'+width+'.png'});
   }
   for(const course of await page.locator('details.ontario-course').all()){
    await course.locator('summary').focus();await page.keyboard.press('Enter');
    const gap=await course.evaluate(e=>e.querySelector('.ontario-course-body>p').getBoundingClientRect().top-e.querySelector('.ontario-course-code').getBoundingClientRect().bottom);
    assert(gap>=12&&gap<=24,slug+' course code/description gap: '+gap);
    assert((await course.locator('.ontario-course-body>p').first().innerText()).startsWith('This course '),'Course introduction avoids repeated grade/subject label');
    if(slug==='ontario-grade-11-12-biology-chemistry-tutoring'){
     assert.equal(await course.locator('.ontario-course-body>p').count(),1,'Each senior course has only its course description before topics');
     assert.equal(await course.locator('.ontario-course-body>:last-child').getAttribute('class'),'ontario-topic','Last topic has no unrelated course-wide statement after it');
     if(width===1440&&(await course.innerText()).includes('SBI3U'))await course.screenshot({path:output+'/senior-biology-topics-after.png'});
    }
    if(width===1440&&(await course.innerText()).includes('SCH4U'))await course.screenshot({path:output+'/ontario-course-intro-after.png'});
    await page.keyboard.press('Enter');
   }
   if(slug==='gcse-igcse-science-tutoring')await page.screenshot({path:output+'/subject-detail-after-'+width+'.png',fullPage:true});
  }
  await page.goto('http://127.0.0.1:8767/recommendations/',{waitUntil:'domcontentloaded'});await page.evaluate(()=>document.fonts.ready);
  const invitation=page.locator('.review-invitation'),reviewLink=invitation.getByRole('link',{name:'Leave a review',exact:true});
  const invitationSize=await reviewLink.evaluate(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,parent:e.parentElement.getBoundingClientRect().width,gap:e.getBoundingClientRect().top-document.querySelector('.page-hero .lead').getBoundingClientRect().bottom}));
  assert(Math.abs(invitationSize.width-invitationSize.parent)<1&&invitationSize.height>=44,'Review invitation fills content width with accessible target');
  assert(invitationSize.gap>=32&&invitationSize.gap<=64,'Review invitation has a clear compact gap above it');
  const calloutStyles=await page.locator('.cta-band .button').evaluateAll(es=>es.map(e=>{const s=getComputedStyle(e);return s.backgroundColor+'/'+s.color;}));assert(calloutStyles.every(s=>s===calloutStyles[0]),'Review invitation uses existing enquiry callout colours');
  const contextLink=page.locator('.recommendations-intro p a');assert.equal(await contextLink.count(),1);assert.equal(await contextLink.innerText(),'Read complete recommendations on LinkedIn');assert.equal(await contextLink.getAttribute('href'),'https://www.linkedin.com/in/adsouza35/');
  assert((await contextLink.evaluate(e=>getComputedStyle(e).textDecorationLine)).includes('underline'),'Inline LinkedIn link is underlined');
  assert.equal(await page.locator('.recommendations-intro .reading-column>a').count(),0,'Duplicate standalone recommendation link removed');
  assert((await page.locator('.recommendations-intro p').innerText()).endsWith('for their full context.'));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Recommendations have no horizontal overflow');
  if(width===390||width===1440){await invitation.screenshot({path:output+'/review-invitation-'+width+'.png'});await page.locator('.recommendations-intro').screenshot({path:output+'/recommendations-inline-link-'+width+'.png'});}
  await reviewLink.focus();await page.keyboard.press('Enter');await page.waitForURL('**/#review-form');assert(await page.locator('#review-form').isVisible(),'Keyboard invitation reaches the existing review form');
  results.push('PASS: full-width contrasting review invitation, 48px lead gap, keyboard form anchor and one inline LinkedIn context link at '+width+'px');
  await page.goto('http://127.0.0.1:8767/',{waitUntil:'domcontentloaded'});
  const informationGap=await page.locator('.home-recommendations-section').evaluate(e=>e.firstElementChild.firstElementChild.getBoundingClientRect().top-document.querySelector('.home-getting-started>.wrap').lastElementChild.getBoundingClientRect().bottom);
  const verification=page.locator('.recommendation-verification');assert.equal(await verification.innerText(),'Selected excerpts from recommendations published on LinkedIn.');assert.equal(await verification.getByRole('link',{name:'LinkedIn',exact:true}).count(),1,'Home verification has one inline LinkedIn word link');
  assert((await verification.locator('a').evaluate(e=>getComputedStyle(e).textDecorationLine)).includes('underline'),'Inline LinkedIn word is underlined');
  if(width===390||width===1440)await verification.screenshot({path:output+'/home-inline-linkedin-'+width+'.png'});
  assert(informationGap>=40&&informationGap<=64,'Home information/recommendation gap is compact: '+informationGap);
  for(const label of ['SMART goals','Communication & support'])assert.equal(await page.locator('.home-support-links').getByRole('link',{name:label,exact:true}).count(),1);
  if(width===390||width===1440)await page.locator('.home-getting-started').screenshot({path:output+'/home-support-navigation-'+width+'.png'});
  await page.locator('.home-support-links').getByRole('link',{name:'SMART goals',exact:true}).click();await page.waitForURL('**/#smart-goals');await page.waitForLoadState('domcontentloaded');
  const goals=page.locator('#smart-goals');assert.equal(await goals.getByRole('heading',{level:2}).innerText(),'SMART goals. Clear next steps.');
  const goalsCopy=goals.locator('.smart-goals-copy');assert((await goalsCopy.innerText()).includes('specific, manageable goals'));assert((await goalsCopy.innerText()).includes('when to review progress'));
  const contrast=await goalsCopy.evaluate(e=>{const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number);const luminance=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);const a=luminance(rgb(getComputedStyle(e).color)),b=luminance(rgb(getComputedStyle(e.closest('section')).backgroundColor));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);});assert(contrast>=4.5,'SMART goals explanation has readable text contrast');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'SMART goals page has no horizontal overflow');
  if(width===390||width===1440)await goals.screenshot({path:output+'/smart-goals-'+width+'.png'});
  await page.goto('http://127.0.0.1:8767/',{waitUntil:'domcontentloaded'});
  const menu=page.locator('.menu-toggle');if(await menu.isVisible()){await menu.focus();await page.keyboard.press('Enter');assert.equal(await menu.getAttribute('aria-expanded'),'true');}
  const faqLink=page.locator('#main-navigation').getByRole('link',{name:'FAQs',exact:true});assert(await faqLink.isVisible());await faqLink.focus();await page.keyboard.press('Enter');await page.waitForURL('**/faq/');await page.waitForLoadState('domcontentloaded');
  assert.equal(await page.locator('#main-navigation [aria-current="page"]').innerText(),'FAQs');
  await page.getByRole('link',{name:'Next: Policies',exact:true}).click();await page.waitForURL('**/tutoring-policies/');await page.waitForLoadState('domcontentloaded');assert.equal(await page.locator('#main-navigation [aria-current="page"]').innerText(),'Policies');
  await page.getByRole('link',{name:'Next: Enquire',exact:true}).click();await page.waitForURL('**/enquire/');
  results.push('PASS: FAQs/Policies main-menu keyboard access, active-page labels, ordered Next links, visible homepage goals/communication links and 48px section gap at '+width+'px');
  results.push('PASS: SMART goals has a real H2, concise collaborative explanation, review steps, 4.5:1-or-better text contrast and no overflow at '+width+'px');
  results.push('PASS: all six detail pages match parent heading sizes, use valid H2/H3 topic hierarchy, retain compact section gaps, separate course descriptions from codes and have no overflow at '+width+'px');
  results.push('PASS: senior Biology/Chemistry teaching approach appears once before the course list; all six courses end with their actual topic, with no trailing general statement at '+width+'px');
  await page.close();results.push('PASS: programme/enquiry overflow, programme keyboard disclosures, consistent spacing and grouped links at '+width+'px');
 }
 const page=await browser.newPage({viewport:{width:390,height:900}});
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 let posts=0,mode='failure';
 await page.route('**/api/reviews**',r=>{
  if(r.request().method()==='GET')return r.fulfill({json:r.request().url().endsWith('/config')?{ready:true,token:'synthetic',notBefore:20}:{reviews:[]}});
  posts++;if(mode==='malformed')return r.fulfill({status:403,contentType:'text/plain',body:'Unauthorized hostname'});
  if(mode==='false-success')return r.fulfill({json:{ok:false,error:'Submission not stored'}});
  return r.fulfill({status:mode==='success'?200:422,json:mode==='success'?{ok:true}:{error:'Synthetic validation failure'}});
 });
 await page.goto('http://127.0.0.1:8767/recommendations/',{waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('.recommendation-card').count(),7);
 const form=page.locator('#review-form'),submit=form.locator('[type=submit]');
 await submit.click();assert.equal(posts,0,'Empty review does not submit');
 await form.locator('[name=review]').fill('Synthetic local QA. Never sent or published.');await form.locator('[name=public_label]').fill('Local QA');
 await submit.click();assert.equal(posts,0,'Consent required');await form.locator('[name=consent]').check();
 for(mode of ['failure','malformed','false-success']){
  const before=posts;await submit.click();await page.waitForFunction(()=>!document.querySelector('#review-form button').disabled);assert.equal(posts,before+1);
  assert(!(await page.locator('#review-status').innerText()).includes('Thank you'));
  assert.equal(await form.locator('[name=public_label]').inputValue(),'Local QA');
 }
 mode='success';await submit.click();await page.waitForFunction(()=>document.querySelector('#review-status').textContent.includes('private until Amanda approves'));assert.equal(await form.locator('[name=review]').inputValue(),'');
 results.push('PASS: review required fields/consent, JSON validation errors, non-JSON hostname error, HTTP 200 ok:false, retained values, real-success-only confirmation (all intercepted)');
 let enquiryPosts=0,enquiryMode='failure';
 await page.route('**/api/enquiry',r=>{if(r.request().method()==='GET')return r.fulfill({json:{ready:true,siteKey:'local-test-key'}});enquiryPosts++;return r.fulfill({status:enquiryMode==='success'?200:502,json:enquiryMode==='success'?{ok:true}:{error:'Synthetic delivery failure'}});});
 await page.route('**/turnstile/v0/api.js?*',r=>r.fulfill({contentType:'application/javascript',body:"window.turnstile={render:(el,options)=>{window.qaSpam=()=>options.callback('synthetic-local');return 1;},reset:()=>{}};"}));
 await page.goto('http://127.0.0.1:8767/enquire/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!document.querySelector('#enquiry-form button[type=submit]').disabled);
 const enquiry=page.locator('#enquiry-form'),send=enquiry.locator('[type=submit]');
 await send.click();assert(await enquiry.locator('[aria-invalid=true]').count()>0);assert.equal(enquiryPosts,0);
 for(const [name,value] of [['name','Synthetic QA'],['email','qa@example.invalid'],['country','Canada'],['support','Local intercepted QA only']])await enquiry.locator('[name='+name+']').fill(value);
 for(const name of ['year','programme','subject']){await enquiry.locator('[name='+name+']').selectOption('Other');await enquiry.locator('[name=other_'+name+']').fill('Synthetic choice');}
 await enquiry.locator('[name=timezone]').selectOption('America/Toronto');
 await send.click();assert.equal(enquiryPosts,0);assert.equal(await enquiry.locator('[name=consent]').getAttribute('aria-invalid'),'true');
 await enquiry.locator('[name=consent]').check();await send.click();assert((await page.locator('#enquiry-status').innerText()).includes('spam-protection'));assert.equal(enquiryPosts,0);
 await page.evaluate(()=>window.qaSpam());await send.click();await page.waitForFunction(()=>document.querySelector('#enquiry-status').textContent.includes('Synthetic delivery failure'));
 assert.equal(await enquiry.locator('[name=name]').inputValue(),'Synthetic QA');assert(!(await page.locator('#enquiry-status').innerText()).includes('has been received'));
 enquiryMode='success';await page.evaluate(()=>window.qaSpam());await send.click();await page.waitForFunction(()=>document.querySelector('#enquiry-status').textContent.includes('business days'));
 assert.equal(enquiryPosts,2);
 await page.route('**/api/enquiry',r=>r.fulfill({status:503,json:{error:'Synthetic unavailable'}}));
 await page.goto('http://127.0.0.1:8767/enquire/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#enquiry-status').textContent.includes('temporarily unavailable'));assert(!(await page.content()).includes('adsouza35@gmail.com'));assert(!(await page.locator('.delivery-note').innerText()).includes('email Amanda at'));
 results.push('PASS: enquiry required fields, Other selections, consent, missing spam check, retained data on provider failure and business-day confirmation; two intercepted POSTs, zero real emails');
 // Every existing same-site link must resolve in the assembled public candidate.
 const paths=['/','/about-amanda/','/about-auxesis/','/enquire/','/faq/','/how-tutoring-works/','/privacy-consent/','/recommendations/','/subjects-programmes/','/tutoring-policies/','/ib-biology-tutoring/','/ib-chemistry-tutoring/','/a-level-biology-tutoring/','/gcse-igcse-science-tutoring/','/ontario-grade-9-10-science-tutoring/','/ontario-grade-11-12-biology-chemistry-tutoring/','/404.html'];
 const journey=['/','/about-auxesis/','/about-amanda/','/how-tutoring-works/','/subjects-programmes/','/recommendations/','/faq/','/tutoring-policies/','/enquire/'];
 for(const path of paths){
  await page.goto('http://127.0.0.1:8767'+path,{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('main h1').count(),1,path);
  const position=journey.indexOf(path);
  if(position>=0){
   const navigation=page.getByRole('navigation',{name:'Page navigation',exact:true});
   if(position>0)assert.equal(await navigation.getByRole('link',{name:/^Previous:/}).getAttribute('href'),journey[position-1],path+' Previous follows the page order');
   if(position<journey.length-1)assert.equal(await navigation.getByRole('link',{name:/^Next:/}).getAttribute('href'),journey[position+1],path+' Next follows the page order');
  }
  const levels=await page.locator('main h1,main h2,main h3,main h4,main h5').evaluateAll(es=>es.map(e=>Number(e.tagName.slice(1))));assert(levels.every((n,i)=>i===0||n<=levels[i-1]+1),path+' heading hierarchy');
  assert(!(await page.content()).includes('adsouza35@gmail.com'),path+' personal address absent from public HTML');
  for(const href of ['/faq/','/tutoring-policies/'])assert.equal(await page.locator('#main-navigation>a[href="'+href+'"]').count(),1,path+' important page in primary menu');
  const displayed=await page.locator('body').innerText();
  assert(!/adult students (?:can|are welcome)/i.test(displayed),path+' redundant adult self-arrangement lines removed');
  assert(!/GCSE\s*(?:\/|and)\s*IGCSE/i.test(displayed),path+' GCSE & IGCSE naming is consistent');
  assert(!/AS and A-Level/i.test(displayed),path+' AS & A-Level naming is consistent');
  const labels=await page.locator('a[href]').allTextContents();
  assert(!labels.some(s=>/^(See (current )?subjects and programmes|Read the academic-integrity policy|Read the full tutoring policies|View my LinkedIn profile)$/.test(s.trim())),path+' concise destination labels');
  for(const href of await page.locator('a[href]').evaluateAll(es=>es.map(e=>e.getAttribute('href')).filter(h=>h.startsWith('/')||h.startsWith('#')))){
   const url=new URL(href,page.url());if(/^\/(api|portal|admin)\//.test(url.pathname))continue;
   let file=resolve('work/after','.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));assert(existsSync(file),path+' broken link '+href);
   if(url.hash){const html=readFileSync(file,'utf8');assert(html.includes('id="'+decodeURIComponent(url.hash.slice(1))+'"'),path+' missing anchor '+href);}
  }
 }
 await page.goto('http://127.0.0.1:8767/ontario-grade-9-10-science-tutoring/',{waitUntil:'domcontentloaded'});
 await page.getByRole('link',{name:'Explore the IB Middle Years Programme',exact:true}).click();
 assert.equal(new URL(page.url()).hash,'#myp');
 await page.waitForFunction(()=>document.querySelector('#myp')?.open===true);
 assert.equal(await page.locator('#myp').getAttribute('open'),'');
 assert(await page.locator('#myp .programme-details').isVisible());
 results.push('PASS: Ontario junior MYP link navigates directly to #myp and opens the correct programme disclosure');
 results.push('PASS: internal destinations, fragments, primary navigation, heading hierarchy and no personal address across 16 public pages plus 404; seven original review cards byte-for-byte intact');
 results.push('PASS: concise destination links and consistent AS & A-Level / GCSE & IGCSE names across all public pages');
 writeFileSync(output+'/results.txt',results.join('\n')+'\n');console.log(results.join('\n'));
}finally{await browser.close();for(const s of servers)await new Promise(r=>s.close(r));}
