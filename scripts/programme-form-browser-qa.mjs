// Local static fixtures and intercepted APIs only; all network to providers is blocked.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const output=resolve('work/qa-evidence');mkdirSync(output,{recursive:true});
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
   const text=await page.locator('main').innerText();if(state==='before')programmeText=text.replace(/\s+/g,' ');else assert.equal(text.replace(/\s+/g,' '),programmeText,'Programme wording preserved');
   if(state==='after'){
    assert.equal(await page.locator('.programme-links').count(),5);
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
   await page.screenshot({path:output+'/enquire-'+state+'-'+width+'.png',fullPage:true});
  }
  for(const slug of ['ib-biology-tutoring','ib-chemistry-tutoring','a-level-biology-tutoring','gcse-igcse-science-tutoring','ontario-grade-9-10-science-tutoring','ontario-grade-11-12-biology-chemistry-tutoring']){
   await page.goto('http://127.0.0.1:8767/'+slug+'/',{waitUntil:'domcontentloaded'});await page.evaluate(()=>document.fonts.ready);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),slug+' overflow '+width);
   const gaps=await page.locator('.subject-detail-page>.section+.section').evaluateAll(es=>es.map(e=>e.firstElementChild.firstElementChild.getBoundingClientRect().top-e.previousElementSibling.firstElementChild.lastElementChild.getBoundingClientRect().bottom));
   assert(gaps.length>0&&gaps.every(g=>g>=0&&g<=32),slug+' excessive section gaps '+JSON.stringify(gaps));
   if(slug==='gcse-igcse-science-tutoring')await page.screenshot({path:output+'/subject-detail-after-'+width+'.png',fullPage:true});
  }
  results.push('PASS: all six subject/Ontario detail pages have compact section gaps (maximum 32px) and no overflow at '+width+'px');
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
 const paths=['/','/about-amanda/','/about-auxesis/','/enquire/','/faq/','/how-tutoring-works/','/privacy-consent/','/recommendations/','/subjects-programmes/','/tutoring-policies/','/ib-biology-tutoring/','/ib-chemistry-tutoring/','/a-level-biology-tutoring/','/gcse-igcse-science-tutoring/','/ontario-grade-9-10-science-tutoring/','/ontario-grade-11-12-biology-chemistry-tutoring/'];
 for(const path of paths){
  await page.goto('http://127.0.0.1:8767'+path,{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('main h1').count(),1,path);
  for(const href of await page.locator('a[href]').evaluateAll(es=>es.map(e=>e.getAttribute('href')).filter(h=>h.startsWith('/')||h.startsWith('#')))){
   const url=new URL(href,page.url());if(/^\/(api|portal|admin)\//.test(url.pathname))continue;
   let file=resolve('work/after','.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));assert(existsSync(file),path+' broken link '+href);
   if(url.hash){const html=readFileSync(file,'utf8');assert(html.includes('id="'+decodeURIComponent(url.hash.slice(1))+'"'),path+' missing anchor '+href);}
  }
 }
 results.push('PASS: internal destinations and fragments across 16 public pages; seven existing recommendation cards intact');
 writeFileSync(output+'/results.txt',results.join('\n')+'\n');console.log(results.join('\n'));
}finally{await browser.close();for(const s of servers)await new Promise(r=>s.close(r));}
