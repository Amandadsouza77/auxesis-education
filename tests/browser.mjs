/* Run after installing Playwright and Chromium: npm install --no-save playwright; npx playwright install chromium.
   Start npm run preview, then node tests/browser.mjs. Requests to form APIs are mocked; no email is sent. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const routes=JSON.parse(await fs.readFile(new URL('../templates/routes.json',import.meta.url)));
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
      const logo=await page.locator('header .brand img').evaluate(img=>({w:img.clientWidth,h:img.clientHeight,nw:img.naturalWidth,nh:img.naturalHeight}));
      assert.ok(Math.abs(logo.w/logo.h-logo.nw/logo.nh)<.04,'Logo aspect ratio');
    }
    if(width<900){await page.goto('http://localhost:8080/');await page.getByRole('button',{name:'Menu',exact:true}).click();await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'About Amanda',exact:true}).click();assert.ok(page.url().endsWith('/about-amanda/'));}
  }
  await page.goto('http://localhost:8080/enquire/?programme=AS%20%26%20A-Level&subject=Biology');assert.equal(await page.locator('[name=programme]').inputValue(),'AS / A-Level');assert.equal(await page.locator('.phone-field').isVisible(),false);await page.locator('input[name=contact][value=Phone]').check();assert.equal(await page.locator('.phone-field').isVisible(),true);
  await page.route('**/api/enquiry',route=>route.request().method()==='GET'?route.fulfill({status:404,body:''}):route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true})}));
  for(const [name,value] of Object.entries({name:'Test parent',email:'parent@example.com',support:'Exam preparation'}))await page.locator('[name='+name+']').fill(value);
  await page.locator('[name=country]').fill('Canada');
  for(const [name,value] of Object.entries({timezone:'GMT -4',year:'Grade 11'}))await page.locator('[name='+name+']').selectOption(value);
  await page.locator('[name=consent]').check();await page.getByRole('button',{name:'Send enquiry'}).click();await page.waitForFunction(()=>document.querySelector('#enquiry-status').textContent.includes('has been received'));
  assert.deepEqual(errors,[]);console.log('PASS: responsive routes, logo, menu, conditional fields, aliases and mocked submission.');
}finally{await browser.close()}
