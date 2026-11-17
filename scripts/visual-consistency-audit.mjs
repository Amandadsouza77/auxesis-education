// Read-only public-fixture inventory. No provider or production requests.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,extname} from 'node:path';
const root=resolve(process.argv[2]||'work/after'),output=resolve(process.argv[3]||'work/visual-audit');mkdirSync(output,{recursive:true});
const files=[...Object.keys(JSON.parse(readFileSync('content/approved-public-corrections.json'))).map(f=>f==='home.html'?'index.html':f==='404.html'?f:f.replace('.html','/index.html')),...JSON.parse(readFileSync('content/international-pages.json')).map(p=>p.slug+'/index.html'),...JSON.parse(readFileSync('content/ontario-pages.json')).map(p=>p.slug+'/index.html')];
const server=createServer((req,res)=>{let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path.endsWith('/'))path+='index.html';const file=resolve(root,'.'+path);if(!file.startsWith(root+'/')||!existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'application/javascript','.ttf':'font/ttf','.svg':'image/svg+xml','.png':'image/png'})[extname(file)]||'application/octet-stream');res.end(readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const pages=[];
try{
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',locale:'en-US',timezoneId:'America/Toronto'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await context.route('**/api/enquiry',r=>r.fulfill({json:{ready:true,siteKey:'local-test-only'}}));
  await context.route('**/api/reviews**',r=>r.fulfill({json:r.request().url().endsWith('/config')?{ready:true,token:'local-only',notBefore:0}:{reviews:[]}}));
  await context.route('**/turnstile/v0/api.js?*',r=>r.fulfill({contentType:'application/javascript',body:'window.turnstile={render:()=>1,reset:()=>{}};'}));
  const page=await context.newPage();
  for(const file of files){
   const path='/'+file.replace(/index\.html$/,'');await page.goto(origin+path,{waitUntil:'domcontentloaded'});await page.evaluate(()=>document.fonts.ready);
   if(file==='enquire/index.html'||file==='recommendations/index.html')await page.waitForLoadState('networkidle');
   await page.locator('main details').evaluateAll(es=>es.forEach(e=>e.open=true));
   const metrics=await page.evaluate(()=>{
    const background=e=>{let n=e;while(n){const s=getComputedStyle(n);if(s.backgroundColor!=='rgba(0, 0, 0, 0)')return {color:s.backgroundColor,image:s.backgroundImage,element:n.tagName+'.'+n.className};if(s.backgroundImage!=='none')return {color:'gradient',image:s.backgroundImage,element:n.tagName+'.'+n.className};n=n.parentElement;}return {color:'rgb(255, 255, 255)'};};
    const record=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {tag:e.tagName,classes:e.className,text:e.textContent.trim().replace(/\s+/g,' ').slice(0,170),font:s.fontFamily,size:s.fontSize,line:s.lineHeight,weight:s.fontWeight,color:s.color,background:background(e),ownBackground:s.backgroundColor,image:s.backgroundImage,border:s.borderColor,borderWidth:s.borderWidth,decoration:s.textDecorationColor,padding:s.padding,margin:s.margin,width:r.width,height:r.height,visible:r.width>0&&r.height>0};};
    return {heroes:[...document.querySelectorAll(".page-hero")].map(record),enquirySection:document.querySelector(".enquiry-section")?record(document.querySelector(".enquiry-section")):null,brand:Object.fromEntries(['--midnight-violet','--peacock-teal','--teal-companion','--alabaster','--taupe'].map(k=>[k,getComputedStyle(document.body).getPropertyValue(k).trim().toLowerCase()])),text:document.querySelector('main').textContent.replace(/\s+/g,' ').trim(),sectionCount:document.querySelectorAll('main section').length,controls:[...document.querySelectorAll('main input,main select,main textarea')].map(e=>({tag:e.tagName,name:e.name,type:e.type,required:e.required,options:e.tagName==='SELECT'?[...e.options].map(o=>o.value):undefined})),overflow:document.documentElement.scrollWidth>innerWidth,headings:[...document.querySelectorAll('h1,h2,h3,h4,h5')].map(record),buttons:[...document.querySelectorAll('.button,.menu-toggle')].map(record),links:[...document.querySelectorAll('main .text-link,main .programme-nav a')].map(record),labels:[...document.querySelectorAll('.eyebrow')].map(record),panels:[...document.querySelectorAll('.statement-band,.cta-band,.smart-goals-block,.enquiry-aside')].map(record),cards:[...document.querySelectorAll('.recommendation-card,.ontario-skill-grid article')].map(record)};
   });
   pages.push({file,width,...metrics});
   if(width===390||width===1440)await page.screenshot({path:output+'/'+file.replaceAll('/','-').replace('.html','')+'-'+width+'.png',fullPage:true});
  }
  await context.close();console.log('Inventoried '+files.length+' public pages at '+width+'px');
 }
 writeFileSync(output+'/inventory.json',JSON.stringify(pages,null,2));
 const distinct=(key,fields)=>[...new Map(pages.filter(p=>p.width===1440).flatMap(p=>p[key].filter(e=>e.visible).map(e=>{const v=Object.fromEntries(fields.map(f=>[f,e[f]]));return [JSON.stringify(v),v];}))).values()];
 writeFileSync(output+'/summary.json',JSON.stringify({pageCount:files.length,overflows:pages.filter(p=>p.overflow).map(p=>[p.file,p.width]),headings:distinct('headings',['tag','classes','size','line','weight']),buttons:distinct('buttons',['classes','color','ownBackground','border']),panels:distinct('panels',['classes','ownBackground','color'])},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
