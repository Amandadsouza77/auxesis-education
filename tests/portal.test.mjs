import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {webcrypto} from 'node:crypto';
import {onRequest} from '../functions/api/portal/[[path]].js';
const source=fs.readFileSync(new URL('../public/portal.js',import.meta.url),'utf8');
function screen(role='admin',hasFamily=true){const root={innerHTML:'',querySelectorAll(){return [];},addEventListener(){}};const location={origin:'https://auxesis-education.pages.dev',pathname:'/portal/dashboard/',search:'',hash:''};const move=u=>{const p=new URL(u,location.origin);location.pathname=p.pathname;location.search=p.search;};const document={getElementById:id=>id==='portal-app'?root:null,querySelector:q=>q==='h1'?{textContent:'Portal'}:null,querySelectorAll:()=>[]};const ctx=vm.createContext({document,location,history:{replaceState:(_a,_b,u)=>move(u),pushState:(_a,_b,u)=>move(u)},window:{scrollTo(){},addEventListener(){},print(){}},crypto:webcrypto,URL,URLSearchParams,Intl,Date,Math,JSON,setInterval(){},setTimeout(){},console,Blob,fetch:async()=>new Response('{}',{status:401})});const fixture={me:{id:'actor',name:'Test person',role,parentId:'p',studentId:'s'},students:hasFamily?[{id:'s',parentId:'p',name:'Test student',preferred:'Student',zone:'America/Toronto',email:'student@example.invalid',programme:'IB',subject:'Biology',level:'HL',year:'DP2',exam:'May 2027',currency:'USD',rate:100,discount:0,purchased:4,used:1,length:60,day:'Monday',time:'4 PM',frequency:'Weekly',startDate:'2026-09-01T00:00:00Z',goals:'Understand',challenge:'Practice'}]:[],parents:hasFamily?[{id:'p',name:'Parent',billingName:'Parent',email:'parent@example.invalid',zone:'America/Toronto'}]:[],lessons:hasFamily?[{id:'l',studentId:'s',start:'2026-11-01T20:00:00Z',subject:'Biology',hours:1,status:'Scheduled',planning:[],notes:{covered:'',outcome:'',next:''},resources:[],privateNotes:'Private'}]:[],threads:[],reports:[],invoices:[],payments:[],categories:[],resources:[],onboardings:hasFamily?[{id:'onboarding-s',studentId:'s',step:0,parent:{name:'Parent',email:'parent@example.invalid'},student:{name:'Student',email:'student@example.invalid'},learning:{},agreements:[],complete:false}]:[],notifications:[],settings:{},entitled:true,calendarView:'Week',calendarOffset:0};ctx.fixture=fixture;vm.runInContext(source.replace('initialise();\n})();',"db=fixture;me=db.me;activeChild=db.students[0]?.id||'';selectOnboarding();globalThis.renderTest=render;globalThis.moveTest=go;globalThis.submitTest=onSubmit;render();\n})();"),ctx);return {ctx,root,location};}
test('all main portal and library screens render with live-style records',()=>{for(const role of ['admin','parent','student']){const {ctx,root}=screen(role);for(const route of ['/portal/dashboard/','/portal/lessons/','/portal/lesson/?id=l','/portal/messages/','/portal/account/','/portal/reports/','/portal/billing/','/portal/calendar/','/portal/students/','/portal/student/?id=s','/portal/student/?id=s&tab=arrangements','/portal/student/?id=s&tab=reports','/portal/onboarding/','/resources/','/resources/manage/']){ctx.moveTest(route);assert.ok(root.innerHTML.includes('Auxesis'));assert.ok(!root.innerHTML.includes('Prototype preview'));assert.ok(!root.innerHTML.includes('example.test'));}}});
test('new administrator can open overview, calendar and empty lists',()=>{const {ctx,root}=screen('admin',false);for(const route of ['/portal/dashboard/','/portal/calendar/','/portal/students/','/portal/billing/','/resources/manage/','/portal/account/']){assert.doesNotThrow(()=>ctx.moveTest(route));assert.ok(root.innerHTML.includes('Auxesis'));}});
test('roster controls are absent without preview capability and escape saved review details without an apply button',()=>{
 const {ctx,root}=screen('admin');ctx.moveTest('/portal/students/');assert.ok(!root.innerHTML.includes('Preview active roster'));
 ctx.fixture.settings.rosterDryRunEnabled=true;
 ctx.fixture.settings.rosterDryRun={state:'review',summary:{activeStudentCount:1,studentsNeedingReview:1,issues:[],comparisonScope:'Preview only',students:[{name:'<script>private</script>',trackerRow:2,confirmedCalendarOccurrences:0,candidateCalendarOccurrences:3,projectedChangedRecords:4,issues:[{detail:'Mapping <needs> review'}]}]}};
 ctx.moveTest('/portal/students/');
 assert.ok(root.innerHTML.includes('Preview active roster (read-only)'));assert.ok(root.innerHTML.includes('&lt;script&gt;private&lt;/script&gt;'));assert.ok(root.innerHTML.includes('Mapping &lt;needs&gt; review'));assert.ok(!root.innerHTML.includes('data-action="source-sync-apply"'));
 assert.ok(!root.innerHTML.includes('<script>private</script>'));
});
test('resource forms start blank and save specified Other subjects and curricula',async()=>{
  const {ctx,root}=screen('admin',false);ctx.moveTest('/resources/manage/');
  const form=root.innerHTML.match(/<form id="resource-form">(.*?)<\/form>/s)[1];
  assert.ok(!/value="[^\"]+"/.test(form.replace(/<select\b[^>]*>.*?<\/select>/gs,'')));
  for(const label of ['Subject','Curriculum'])assert.ok(form.includes('Select a '+label.toLowerCase()));
  assert.ok(form.includes('Practical skills'));assert.ok(form.includes('Research skills'));
  ctx.FormData=class{constructor(f){this.values=f.values;}entries(){return Object.entries(this.values);}};
  let saved;
  ctx.fetch=async(url,options)=>{if(url.endsWith('/command')){saved=JSON.parse(options.body);return Response.json({ok:true});}return Response.json(ctx.fixture);};
  for(const id of ['resource-form','category-form']){
    const target={id,values:{title:'Test resource',subject:'Other',other_subject:'  Physics  ',programme:'Other',other_programme:'  International science  '},matches:()=>true,reportValidity:()=>true,querySelector:()=>({disabled:false}),elements:{files:{files:[]}}};
    await ctx.submitTest({target,preventDefault(){}});
    assert.equal(saved.action,id==='resource-form'?'resource':'category');
    assert.equal(saved.subject,'Physics');assert.equal(saved.programme,'International science');
    assert.ok(!('other_subject' in saved));assert.ok(!('other_programme' in saved));
  }
});
test('parent lesson view excludes planning editor and private note',()=>{const {ctx,root}=screen('parent');ctx.moveTest('/portal/lesson/?id=l');assert.ok(!root.innerHTML.includes('id="planning-form"'));assert.ok(!root.innerHTML.includes('Private notes'));assert.ok(root.innerHTML.includes('View-only'));});
test('student has no billing or report navigation',()=>{const {root}=screen('student');assert.ok(!root.innerHTML.includes('Billing &amp; invoices'));assert.ok(!root.innerHTML.includes('Monthly reports'));});
test('portal boundary rejects anonymous downloads and cross-origin changes',async()=>{const preview='https://cloudflare-backend-migration.auxesis-education.pages.dev';let r=await onRequest({request:new Request(preview+'/api/portal/file?id=old'),params:{path:['file']}});assert.equal(r.status,401);r=await onRequest({request:new Request(preview+'/api/portal/command',{method:'POST',headers:{Origin:'https://attacker.invalid','Content-Type':'application/json'},body:'{}'}),params:{path:['command']}});assert.equal(r.status,403);});

test('migration backend refuses the production Pages hostname',async()=>{const r=await onRequest({request:new Request('https://auxesis-education.pages.dev/api/portal/state'),params:{path:['state']},env:{}});assert.equal(r.status,503);});
test('portal runtime issues only secure HttpOnly same-site session cookies',()=>{const runtime=fs.readFileSync(new URL('../cloudflare/runtime.js',import.meta.url),'utf8');assert.match(runtime,/Secure; HttpOnly; SameSite=Lax/);assert.doesNotMatch(runtime,/document\.cookie|localStorage/);});


test('intake captures Tracker identity fields and offers location time zones with UTC labels',()=>{
 const {ctx,root}=screen('parent');ctx.moveTest('/portal/onboarding/');
 assert.ok(root.innerHTML.includes('name="pronouns"'));assert.ok(root.innerHTML.includes('Choose your city or region'));assert.ok(root.innerHTML.includes('UTC'));assert.ok(!root.innerHTML.includes('Time zone</label>'));
 ctx.fixture.onboardings[0].step=1;ctx.moveTest('/portal/onboarding/');
 assert.ok(root.innerHTML.includes('name="nationality"'));assert.ok(root.innerHTML.includes('Country of residence'));assert.match(root.innerHTML,/<select name="zone" required>/);
 const admin=screen('admin');admin.ctx.moveTest('/portal/student/?id=s&tab=arrangements');assert.ok(admin.root.innerHTML.includes('name="package"'));assert.ok(admin.root.innerHTML.includes('name="status"'));
});
