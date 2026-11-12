// Authorized, clearly labelled QA inquiry to the owner's inbox only.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try{
 const page=await browser.newPage();
 for(const host of ['https://auxesis-education.pages.dev','https://auxedu.com']){
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:900});
   const r=await page.goto(host+'/enquire/',{waitUntil:'networkidle',timeout:60000});assert(r.ok());
   await page.locator('#enquiry-form').waitFor();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile overflow');
   await page.waitForFunction(()=>document.querySelector('#enquiry-form button[type=submit]')?.disabled===false,null,{timeout:45000});
   assert(!await page.locator('.delivery-note').isVisible(),'Unavailable fallback remains visible');
   console.log('::notice::Inquiry form renders and enables at '+width+'px on '+host);
  }
 }
 await page.goto('https://auxedu.com/enquire/',{waitUntil:'networkidle',timeout:60000});
 await page.locator('[name=name]').fill('QA inquiry — authorized website test');
 await page.locator('[name=email]').fill('adsouza35@gmail.com');
 await page.locator('[name=country]').fill('Canada');
 await page.locator('[name=timezone]').selectOption('UTC−05:00');
 await page.locator('[name=year]').selectOption('Grade 11');
 await page.locator('[name=programme]').selectOption('IB Diploma');
 await page.locator('[name=subject]').selectOption('Biology');
 await page.locator('[name=support]').fill('QA ONLY — authorized inquiry delivery verification '+process.env.GITHUB_RUN_ID+'. Synthetic data; no student or family is involved. Please confirm receipt in the Codex conversation.');
 await page.locator('[name=contact][value=Email]').check();
 await page.locator('[name=consent]').check();
 const tokenReady=await page.waitForFunction(()=>{try{return !!window.turnstile?.getResponse();}catch{return false;}},null,{timeout:45000}).then(()=>true,()=>false);
 if(!tokenReady){console.log('::notice::TURNSTILE_REQUIRES_OWNER_INTERACTION: no QA inquiry sent. Owner must complete one browser submission; no spam check was bypassed.');}
 else{
  const result=page.waitForResponse(r=>r.url().includes('/api/enquiry')&&r.request().method()==='POST',{timeout:60000});
  await page.locator('#enquiry-form button[type=submit]').click();
  const response=await result,body=await response.json();assert(response.ok()&&body.ok,'QA inquiry API did not accept delivery');
  await page.waitForFunction(()=>document.querySelector('#enquiry-status')?.textContent.includes('has been received'));
  console.log('::notice::QA_INQUIRY_ACCEPTED: real browser submission passed Turnstile and the email API accepted it. Owner inbox receipt and Reply-To remain to be confirmed.');
 }
}finally{await browser.close();}
