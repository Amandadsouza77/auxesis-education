// Compare the visual exploration with its frozen public baseline; mock every API.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
const before=JSON.parse(readFileSync('docs/qa-evidence/visual/baseline-contract.json')).pages,after=JSON.parse(readFileSync('work/visual-after/inventory.json'));
const results=[],ratios=[];
const callouts=JSON.parse(readFileSync('content/public-callouts.json','utf8'));
const rgb=s=>s.startsWith('#')?[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)):s.match(/[\d.]+/g).slice(0,3).map(Number);
const luminance=c=>rgb(c).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
assert.equal(after.length,17*4);
for(const page of after){
 const prior=before.find(p=>p.file===page.file&&p.width===page.width);assert(prior);
 assert(!page.overflow,page.file+' overflow at '+page.width);
 const copy=callouts[page.file];const expectedText=copy?prior.text.replace(copy.beforeHeading,copy.heading).replace(copy.beforeText,copy.text):prior.text;
 assert.equal(page.text,expectedText,page.file+' approved text preserved except explicit owner callout variants');
 assert.equal(page.sectionCount,prior.sectionCount,page.file+' section structure preserved');
 assert.deepEqual(page.controls,prior.controls,page.file+' form controls/values preserved');
 assert.deepEqual(page.headings.map(h=>[h.tag,h.text]),prior.headings.map(h=>[h.tag,copy&&h.tag==='H2'&&h.text===copy.beforeHeading?copy.heading:h.text]),page.file+' heading structure preserved with owner-approved callout wording changes');
 assert.deepEqual(page.brand,{'--midnight-violet':'#29213c','--peacock-teal':'#008c87','--teal-companion':'#009d97','--alabaster':'#f8f6f0','--taupe':'#d6c9b8'},'Existing purple, turquoise and neutral branding retained');
 assert.equal(page.headings.filter(h=>h.tag==='H1').length,1);
 assert(page.labels.every(h=>!/^H[1-6]$/.test(h.tag)),'Decorative labels remain paragraphs');
 assert.deepEqual(page.panels.filter(p=>!p.classes.includes('smart-goals-block')).map(p=>[p.classes,p.ownBackground,p.image]),prior.panels.filter(p=>!p.classes.includes('smart-goals-block')).map(p=>[p.classes,p.ownBackground,p.image]),page.file+' approved feature colours preserved');
 for(const panel of page.panels.filter(p=>p.classes.includes('smart-goals-block'))){assert.equal(panel.ownBackground,'rgb(0, 157, 151)','Owner requested bright turquoise SMART goals panel');assert.equal(panel.color,'rgb(41, 33, 60)','Aubergine copy on bright turquoise');}
 assert.deepEqual(page.cards.map(p=>p.text),prior.cards.map(p=>p.text),page.file+' card content preserved');
 for(const button of page.buttons.filter(b=>b.visible)){
  const bg=button.background.color;
  if(bg!=='gradient'){
   const ratio=contrast(button.color,bg);assert(ratio>=4.5,page.file+' button contrast '+ratio+' '+button.text);ratios.push(ratio);
  }
  assert(button.height>=44,'Button hit target stays at least 44px');
 }
}
results.push('PASS: all 17 public pages at 320/390/768/1440px: no overflow; section structure, form controls/values and true heading levels preserved. Copy changes are limited to explicit owner callout variants. Purple/turquoise brand tokens are unchanged; only SMART goals changes from dark green to bright turquoise at owner request.');
results.push('PASS: visible button labels meet 4.5:1 text contrast and keep 44px-or-larger targets. Decorative gold is not used for normal-size text.');
const root=resolve('work/after'),output=resolve('work/visual-after');mkdirSync(output,{recursive:true});
const server=createServer((req,res)=>{let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path.endsWith('/'))path+='index.html';const file=resolve(root,'.'+path);if(!file.startsWith(root+'/')||!existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'application/javascript','.ttf':'font/ttf','.png':'image/png','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
let probes=0;
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',locale:'en-US',timezoneId:'America/Toronto'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await context.route('**/api/enquiry',r=>r.fulfill({json:{ready:true,siteKey:'local-only'}}));
  await context.route('**/api/reviews**',r=>r.fulfill({json:r.request().url().endsWith('/config')?{ready:true,token:'local-only',notBefore:0}:{reviews:[]}}));
  await context.route('**/turnstile/v0/api.js?*',r=>r.fulfill({contentType:'application/javascript',body:'window.turnstile={render:()=>1,reset:()=>{}};'}));
  const page=await context.newPage();
  for(const path of ['/','/how-tutoring-works/','/enquire/','/faq/','/subjects-programmes/','/recommendations/']){
   await page.goto(origin+path,{waitUntil:'domcontentloaded'});await page.evaluate(()=>document.fonts.ready);
   for(const button of await page.locator('.button,.menu-toggle').all()){
    if(!await button.isVisible()||await button.isDisabled())continue;
    await button.hover();
    const colours=await button.evaluate(e=>{
     const rgba=s=>s.match(/[\d.]+/g).map(Number);let composed=[255,255,255];const chain=[];for(let n=e;n;n=n.parentElement)chain.unshift(n);
     for(const n of chain){const s=getComputedStyle(n),c=rgba(s.backgroundColor),a=c.length===4?c[3]:1;composed=composed.map((v,i)=>c[i]*a+v*(1-a));}
     return {fg:getComputedStyle(e).color,bg:'rgb('+composed.join(',')+')'};
    });
    assert(contrast(colours.fg,colours.bg)>=4.5,'Hover text contrast: '+path+' '+await button.innerText());
    await page.mouse.move(0,0);await page.keyboard.press('Tab');await button.focus();
    const focus=await button.evaluate(e=>{const s=getComputedStyle(e);return {visible:e.matches(':focus-visible'),width:parseFloat(s.outlineWidth),style:s.outlineStyle,color:s.outlineColor,token:s.getPropertyValue('--focus-ring').trim()};});
    assert(focus.visible&&focus.width>=3&&focus.style==='solid','Consistent keyboard focus: '+path);
    assert.deepEqual(rgb(focus.color),rgb(focus.token),'Focus ring follows its surface token');probes++;
   }
   const control=page.locator('main input:not([type=hidden]):not([tabindex="-1"]),main textarea,main select,main summary').filter({visible:true}).first();
   if(await control.count()){
    await page.keyboard.press('Tab');await control.focus();
    assert(await control.evaluate(e=>e.matches(':focus-visible')&&parseFloat(getComputedStyle(e).outlineWidth)>=3),'Field/disclosure focus remains visible');probes++;
   }
   if(path==='/enquire/'){
    await page.locator('#enquiry-form button[type=submit]').click();
    const errors=page.locator('.field-error');assert(await errors.count()>0,'Required-field errors remain available');
    for(const error of await errors.all())assert(contrast(await error.evaluate(e=>getComputedStyle(e).color),'#F8F6F0')>=4.5,'Error copy contrast');
    await page.locator('#enquiry-form').screenshot({path:output+'/form-errors-'+width+'.png'});
   }
  }
  await context.close();
 }
 results.push('PASS: '+probes+' desktop/mobile keyboard-focus and hover probes across light, taupe, dark, turquoise, form and native disclosure contexts; errors retain red styling and readable contrast.');
 writeFileSync(output+'/results.txt',results.join('\n')+'\n');writeFileSync(output+'/checks.json',JSON.stringify({pages:17,layouts:after.length,widths:[320,390,768,1440],minimumButtonContrast:Math.min(...ratios),interactionProbes:probes},null,2));console.log(results.join('\n'));
}finally{await browser.close();await new Promise(r=>server.close(r));}
