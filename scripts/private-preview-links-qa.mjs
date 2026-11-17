// Run against the separate static preview. External destinations are intercepted;
// no profile login, production form submission or production record access occurs.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
if(!process.argv[2])throw Error('Provide the private preview static directory');
const root=resolve(process.argv[2]);
const server=createServer((req,res)=>{
 let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(path.endsWith('/'))path+='index.html';
 const file=resolve(root,'.'+path);
 if(!file.startsWith(root+'/')||!existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');
 res.end(readFileSync(file));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const expected=[['Ontario College of Teachers public register (OCT #496538)','https://apps.oct.ca/FindATeacher/memberdetail?id=496538'],['View my LinkedIn profile','https://www.linkedin.com/in/adsouza35/']];
const output=resolve('work/qa-evidence');mkdirSync(output,{recursive:true});
try{
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900}});
  const requests=[];
  await context.route('**/*',r=>{
   if(new URL(r.request().url()).origin===origin)return r.continue();
   requests.push(r.request().url());
   return r.fulfill({contentType:'text/html',body:'<!doctype html><title>Intercepted public link target</title>'});
  });
  const page=await context.newPage();
  await page.goto(origin+'/about-amanda/');await page.evaluate(()=>document.fonts.ready);
  for(const [name,url] of expected){
   const link=page.getByRole('link',{name,exact:true});
   assert.equal(await link.getAttribute('href'),url);
   assert.equal(await link.getAttribute('aria-disabled'),null);
   assert.equal(await link.getAttribute('target'),'_blank');
   assert.equal(await link.getAttribute('rel'),'noopener noreferrer');
   for(const keyboard of [false,true]){
    const popupPromise=context.waitForEvent('page');
    if(keyboard){await link.focus();await page.keyboard.press('Enter');}else await link.click();
    const popup=await popupPromise;await popup.waitForLoadState();
    assert.equal(popup.url(),url);assert.equal(await popup.evaluate(()=>window.opener),null);
    await popup.close();
   }
  }
  assert(requests.length===4&&requests.every(url=>expected.some(e=>e[1]===url)),'Only clicked public destinations requested');
  assert(await page.locator('.footer [aria-disabled="true"]').count()>0,'Mail links stay disabled');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
  assert.equal(await page.evaluate(()=>fetch('https://example.invalid/').then(()=>false,()=>true)),true,'External API requests stay blocked');
  assert((await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')).includes("connect-src 'none'; form-action 'none'"));
  await page.goto(origin+'/enquire/');
  assert.equal(await page.locator('#enquiry-form').count(),1);
  assert.deepEqual(await page.evaluate(()=>fetch('/api/enquiry',{method:'POST'}).then(r=>r.json())),{ok:true},'Enquiry success remains simulated locally');
  await page.goto(origin+'/ontario-grade-11-12-biology-chemistry-tutoring/');
  assert.equal(await page.locator('main .page-hero .lead').innerText(),'Grades 11 and 12');
  assert((await page.locator('main h1').innerText()).includes('Biology and Chemistry'),'Main H1 retains subjects');
  if(width===390||width===1440){
   await page.screenshot({path:output+'/senior-subtitle-'+width+'.png'});
   await page.goto(origin+'/about-amanda/');await page.locator('.credentials-panel').screenshot({path:output+'/credential-links-'+width+'.png'});
  }
  console.log('PASS '+width+'px: LinkedIn/OCT mouse and keyboard new-tab destinations; noopener; isolated network/forms; compact subtitle and retained H1');
  await context.close();
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
