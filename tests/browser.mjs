/* Run after installing Playwright and Chromium: npm install --no-save playwright; npx playwright install chromium.
   Start npm run preview, then node tests/browser.mjs. Requests to form APIs are mocked; no email is sent. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const routes=JSON.parse(await fs.readFile(new URL('../templates/routes.json',import.meta.url)));
const expectedMenu=[['Home','/'],['About Auxesis','/about-auxesis/'],['About Amanda','/about-amanda/'],['How Tutoring Works','/how-tutoring-works/'],['Subjects & Programmes','/subjects-programmes/'],['Recommendations & Reviews','/recommendations/'],['Enquire','/enquire/']];
const adjacent={home:['/about-auxesis/'],'about-auxesis':['/','/about-amanda/'],'about-amanda':['/about-auxesis/','/how-tutoring-works/'],'how-tutoring-works':['/about-amanda/','/subjects-programmes/'],'subjects-programmes':['/how-tutoring-works/','/recommendations/'],recommendations:['/subjects-programmes/','/enquire/'],enquire:['/recommendations/']};
const browser=await chromium.launch();
try{
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [320,375,390,414,768,1024,1440]){
    await page.setViewportSize({width,height:900});
    for(const route of routes){
      await page.goto('http://localhost:8080'+route.route);await page.evaluate(()=>document.fonts.ready);
      assert.equal(await page.locator('main').count(),1);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route.route+' overflows at '+width);
      const menuLinks=await page.locator('.main-navigation>a').evaluateAll(links=>links.map(a=>[a.textContent.trim(),new URL(a.href).pathname]));assert.deepEqual(menuLinks,expectedMenu);
      const footerLinks=await page.locator('.footer nav a').evaluateAll(links=>links.slice(0,7).map(a=>[a.textContent.trim(),new URL(a.href).pathname]));assert.deepEqual(footerLinks,expectedMenu);
      const expectedAdjacent=adjacent[route.name]||[];const actualAdjacent=await page.locator('.page-navigation a').evaluateAll(links=>links.map(a=>new URL(a.href).pathname));assert.deepEqual(actualAdjacent,expectedAdjacent,route.name+' previous/next navigation');
      assert.equal(await page.locator('header').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(248, 246, 240)');
      const logo=await page.locator('header .brand img').evaluate(img=>({w:img.clientWidth,h:img.clientHeight,nw:img.naturalWidth,nh:img.naturalHeight}));
      assert.ok(Math.abs(logo.w/logo.h-logo.nw/logo.nh)<.04,'Logo aspect ratio');
    }
    if(width<=1320){await page.goto('http://localhost:8080/');await page.getByRole('button',{name:'Menu',exact:true}).click();await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'About Amanda',exact:true}).click();assert.ok(page.url().endsWith('/about-amanda/'));}
  }
  await page.goto('http://localhost:8080/enquire/?programme=AS%20%26%20A-Level&subject=Biology');assert.equal(await page.locator('[name=programme]').inputValue(),'AS / A-Level');assert.equal(await page.locator('.phone-field').isVisible(),false);await page.locator('input[name=contact][value=Phone]').check();assert.equal(await page.locator('.phone-field').isVisible(),true);
  assert.equal(await page.locator('[name=country]').getAttribute('type'),'text');assert.equal(await page.locator('[name=timezone]').getAttribute('type'),'text');assert.equal(await page.locator('.required-note').innerText(),'* Required fields');assert.ok(!(await page.locator('#enquiry-form').innerText()).includes('— required'));
  const countryCode=page.locator('[name=phone_country_code]'),phone=page.locator('[name=phone]');assert.equal(await countryCode.evaluate(el=>el.tagName),'SELECT');assert.ok((await countryCode.locator('option').allTextContents()).includes('United Kingdom (+44)'));await countryCode.selectOption('+44');assert.equal(await phone.evaluate(el=>el.required),true);await phone.fill('123456789');assert.equal(await countryCode.evaluate(el=>el.required),true);await phone.fill('');await countryCode.selectOption('');await page.locator('input[name=contact][value=Email]').check();
  await page.route('**/api/enquiry',route=>route.request().method()==='GET'?route.fulfill({status:404,body:''}):route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true})}));
  for(const [name,value] of Object.entries({name:'Test parent',email:'parent@example.com',support:'Exam preparation'}))await page.locator('[name='+name+']').fill(value);
  await page.locator('[name=country]').fill('Canada');
  await page.locator('[name=timezone]').fill('GMT -4');await page.locator('[name=year]').selectOption('Grade 11');
  await page.locator('[name=consent]').check();await page.getByRole('button',{name:'Send enquiry'}).click();await page.waitForFunction(()=>document.querySelector('#enquiry-status').textContent.includes('has been received'));
  await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:8080/recommendations/');const trap=page.locator('.bot-field');assert.equal(await trap.count(),1);assert.equal(await trap.isVisible(),false);assert.equal(await trap.getAttribute('aria-hidden'),'true');assert.equal(await page.locator('.required-note').innerText(),'* Required fields');assert.equal(await page.locator('#review-form').evaluate(form=>form.checkValidity()),false);
  await page.route('**/api/review',route=>route.request().method()==='GET'?route.fulfill({status:404,body:''}):route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true})}));await page.locator('[aria-label="Review text"]').fill('A clear and helpful review.');await page.locator('[aria-label="Relationship to Auxesis"]').fill('Parent');await page.locator('#review-form input[type=checkbox]').check();await page.getByRole('button',{name:'Submit a review'}).click();await page.waitForFunction(()=>document.querySelector('#review-status').textContent.includes('has been received'));
  assert.deepEqual(errors,[]);console.log('PASS: responsive routes, shared navigation, logo, opaque header, form controls and mocked submissions.');
}finally{await browser.close()}
