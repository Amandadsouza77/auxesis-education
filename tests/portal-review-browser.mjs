// Use an external private import payload; never commit real student fixtures.
// Run against npm run preview with PORTAL_REVIEW_FIXTURE_PATH set.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const fixturePath=process.env.PORTAL_REVIEW_FIXTURE_PATH;
assert.ok(fixturePath,'Set PORTAL_REVIEW_FIXTURE_PATH to the private import payload.');
const payload=JSON.parse(await fs.readFile(fixturePath,'utf8'));
const admin={id:'review-owner',name:'Amanda',email:'',role:'admin',studentId:null,parentId:null};
function state(headers){
 const role=headers['x-auxesis-preview-role'],sid=headers['x-auxesis-preview-student'];
 const all=structuredClone(payload.records),s=all.find(r=>r.kind==='students'&&r.data.id===sid)?.data,p=all.find(r=>r.kind==='parents'&&r.data.id===s?.parentId)?.data;
 const preview=role?{role,studentId:sid,studentName:s.name,ownerName:'Amanda',readOnly:true}:null;
 const me=preview?{id:'preview-'+role+'-'+sid,role,name:role==='student'?s.name:p.name||'Parent / guardian',email:'',parentId:role==='parent'?p.id:null,studentId:role==='student'?sid:null}:admin;
 const out={me,preview,entitled:true,policyVersion:'2026-10-03',settings:role==='student'?{}:{transfer:'',paypal:'',...(!role?{reviewMode:true,importSummary:payload.summary}:{})}};
 for(const kind of ['students','parents','lessons','threads','reports','invoices','payments','categories','resources','notifications','onboardings','billingHistory','billingArchive','importReviews'])out[kind]=[];
 for(const {kind,data:r} of all){
  if(!out[kind])continue;
  let visible=!role;
  if(role){
   if(kind==='students')visible=r.id===sid;
   if(kind==='parents')visible=role==='parent'&&r.id===p.id;
   if(['lessons','onboardings'].includes(kind))visible=r.studentId===sid;
   if(kind==='threads')visible=r.kind==='student'?r.studentId===sid:role==='parent'&&r.parentId===p.id;
   if(kind==='invoices')visible=role==='parent'&&r.studentId===sid&&r.issued;
   if(kind==='payments')visible=role==='parent'&&r.studentId===sid;
  }
  if(!visible)continue;
  if(role)for(const k of ['privateNotes','sourceData','sourceMeta','reviewFlags','migration','parentSource'])delete r[k];
  if(role==='student'&&kind==='students')for(const k of ['rate','currency','discount','purchased','used'])delete r[k];
  if(role==='student'&&kind==='onboardings'){r.parent={};r.agreements=[];delete r.arrangements;}
  out[kind].push(r);
 }
 return out;
}
const browser=await chromium.launch({headless:true});
const errors=[];let mutations=0,checks=0;
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/portal/**',async route=>{
  if(route.request().url().endsWith('/state'))return route.fulfill({contentType:'application/json',body:JSON.stringify(state(route.request().headers()))});
  if(route.request().url().endsWith('/realtime'))return route.fulfill({status:503,contentType:'application/json',body:'{}'});
  mutations++;return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:'Read-only preview'})});
 });
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});
  await page.goto('http://127.0.0.1:8080/portal/students/');await page.getByRole('heading',{name:'Students',exact:true}).waitFor();
  assert.equal(await page.locator('.student-card').count(),14);checks++;
  for(const s of payload.records.filter(r=>r.kind==='students').map(r=>r.data)){
   await page.goto('http://127.0.0.1:8080/portal/student/?id='+s.id);
   await page.getByRole('button',{name:'View as student',exact:true}).waitFor();
   assert.equal(await page.getByRole('button',{name:'View as parent',exact:true}).count(),1);checks++;
  }
  const s=payload.records.find(r=>r.kind==='students').data;
  for(const role of ['student','parent']){
   await page.goto('http://127.0.0.1:8080/portal/student/?id='+s.id);
   await page.getByRole('button',{name:'View as '+role,exact:true}).click();
   await page.getByText((role==='student'?'Student preview':'Parent preview')+' · '+s.name,{exact:true}).waitFor();
   for(const path of ['/portal/dashboard/','/portal/lessons/','/portal/messages/','/portal/account/','/portal/onboarding/',...(role==='parent'?['/portal/reports/','/portal/billing/']:[])]){
    await page.goto('http://127.0.0.1:8080'+path+'?view='+role+'&previewStudent='+s.id);
    await page.locator('.review-banner').waitFor();await page.evaluate(()=>document.fonts.ready);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),path+' '+role+' overflows at '+width);checks++;
   }
   await page.goto('http://127.0.0.1:8080/portal/dashboard/?view='+role+'&previewStudent='+s.id);
   await page.locator('.review-banner').waitFor();
   if(width===390&&process.env.PORTAL_REVIEW_SCREENSHOT_DIR)await page.screenshot({path:process.env.PORTAL_REVIEW_SCREENSHOT_DIR+'/'+role+'-preview-mobile.png',fullPage:true});
   await page.getByRole('button',{name:'Return to Amanda’s workspace',exact:true}).click();
   await page.getByRole('button',{name:'View as student',exact:true}).waitFor();checks++;
  }
  await page.goto('http://127.0.0.1:8080/portal/billing/');await page.getByRole('heading',{name:'Billing & invoicing',exact:true}).waitFor();
  assert.equal(await page.locator('h2').filter({hasText:'Original billing records'}).count(),1);checks++;
  await page.getByText('Historical invoice register · 33 source entries',{exact:true}).click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Billing overflows at '+width);checks++;
 }
 assert.equal(mutations,0,'Preview navigation must not send mutations');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passedChecks:checks,students:14,widths:[390,1440],mutations,pageErrors:errors}));
}finally{await browser.close();}
