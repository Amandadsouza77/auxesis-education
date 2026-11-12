// Browser tests use synthetic data and intercepted delivery: no production mail.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const origin=process.env.QA_ORIGIN||'https://auxedu.com';
const routes=JSON.parse(readFileSync('templates/routes.json'));
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try{
 const page=await browser.newPage(),errors=[];
 if(process.env.QA_ORIGIN)await page.route('**/api/enquiry',route=>route.request().method()==='GET'?route.fulfill({contentType:'application/json',body:'{"ready":true,"siteKey":"1x00000000000000000000AA"}'}):route.abort());
 page.on('pageerror',e=>errors.push(e.message));
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});
  for(const route of routes){
   const response=await page.goto(origin+route.route,{waitUntil:'domcontentloaded',timeout:60000});assert(response.ok()||route.route==='/404.html'&&response.status()===404);
   await page.evaluate(()=>document.fonts.ready);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow at '+width+route.route);
   assert.equal(await page.locator('a[href^="/portal"]').count(),0);
   assert.equal(await page.locator('main h1').count(),1);
   const broken=await page.evaluate(()=>[...document.querySelectorAll('a[href^="#"]')].map(a=>a.getAttribute('href')).filter(h=>h.length>1&&!document.getElementById(decodeURIComponent(h.slice(1)))));assert.deepEqual(broken,[],route.route+' broken anchors');
   if(route.route!=='/404.html')assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),'https://auxedu.com'+route.route);
  }
  console.log('::notice::All 11 public routes: layout, headings, anchors, canonical metadata and absent portal links pass at '+width+'px');
 }
 await page.setViewportSize({width:390,height:900});await page.goto(origin+'/faq/',{waitUntil:'domcontentloaded'});
 const menu=page.locator('.menu-toggle');await menu.click();assert.equal(await menu.getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await menu.getAttribute('aria-expanded'),'false');
 const summary=page.locator('details summary').first();await summary.focus();await page.keyboard.press('Enter');assert(await summary.evaluate(el=>el.parentElement.open));await page.keyboard.press('Space');assert(!await summary.evaluate(el=>el.parentElement.open));
 await page.goto(origin+'/recommendations/',{waitUntil:'domcontentloaded'});assert.equal(await page.locator('.recommendation-card').count(),7);
 await page.route('**/turnstile/v0/api.js?*',route=>route.fulfill({contentType:'application/javascript',body:"window.turnstile={render:(el,options)=>{window.qaTurnstile=()=>options.callback('synthetic-local-only');return 1;},reset:()=>{}};"}));
 await page.goto(origin+'/enquire/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>[...document.querySelector('[name=timezone]').options].some(o=>o.value==='America/Vancouver'));
 await page.locator('[name=timezone]').selectOption('America/Vancouver');
 const zoneLabel=await page.locator('[name=timezone] option:checked').textContent();const offset=await page.evaluate(()=>new Intl.DateTimeFormat('en',{timeZone:'America/Vancouver',timeZoneName:'longOffset'}).formatToParts(new Date()).find(p=>p.type==='timeZoneName').value.replace('GMT','UTC'));assert(zoneLabel.includes(offset),'Region label must match current timezone rules');
 const button=page.locator('#enquiry-form button[type=submit]');await page.waitForFunction(()=>!document.querySelector('#enquiry-form button[type=submit]').disabled);
 await button.click();assert(await page.locator('[aria-invalid=true]').count()>0,'Required fields expose invalid state');
 await page.locator('[name=name]').fill('Synthetic browser QA');await page.locator('[name=email]').fill('qa@example.invalid');await page.locator('[name=country]').fill('Canada');
 for(const name of ['year','programme','subject']){await page.locator('[name='+name+']').selectOption('Other');assert(await page.locator('[name=other_'+name+']').isVisible());await page.locator('[name=other_'+name+']').fill('Synthetic other');}
 await page.locator('[name=support]').fill('Synthetic browser regression; no delivery.');await page.locator('[name=contact][value=Phone]').check();assert(await page.locator('[name=phone]').isVisible());await page.locator('[name=phone]').fill('5550100');await button.click();assert.equal(await page.locator('[name=phone_country_code]').getAttribute('aria-invalid'),'true');await page.locator('[name=contact][value=Email]').check();await page.locator('[name=consent]').check();
 // Isolated browser-only provider fixtures; a successful POST cannot reach production.
 await page.route('**/api/enquiry',route=>route.request().method()==='POST'?route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({error:'Synthetic provider failure'})}):route.continue());
 await button.click();assert((await page.locator('#enquiry-status').textContent()).includes('spam-protection'));
 await page.evaluate(()=>window.qaTurnstile());
 await button.click();await page.waitForFunction(()=>document.querySelector('#enquiry-status').textContent.includes('Synthetic provider failure'));
 assert.equal(await page.locator('[name=name]').inputValue(),'Synthetic browser QA');assert(!(await page.locator('#enquiry-status').textContent()).includes('has been received'));
 await page.unroute('**/api/enquiry');await page.route('**/api/enquiry',route=>route.request().method()==='POST'?route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}):route.continue());
 await page.evaluate(()=>window.qaTurnstile());await button.click();await page.waitForFunction(()=>document.querySelector('#enquiry-status').textContent.includes('has been received'));assert((await page.locator('#enquiry-status').textContent()).includes('business days'));
 assert.deepEqual(errors,[],'Browser script exceptions');console.log('::notice::Keyboard menu/accordions, recommendations, DST region selector, required/Other/phone validation, retained input on delivery failure and success state pass. Delivery intercepted locally; no production email sent.');
}finally{await browser.close();}
