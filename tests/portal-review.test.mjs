import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {onRequest} from '../functions/api/portal/[[path]].js';
const source=fs.readFileSync(new URL('../public/portal.js',import.meta.url),'utf8');
const fixture=process.env.PORTAL_REVIEW_FIXTURE_PATH?JSON.parse(fs.readFileSync(process.env.PORTAL_REVIEW_FIXTURE_PATH,'utf8')):null;
function screen(data){
 const root={innerHTML:'',addEventListener(){}};
 const location={origin:'https://auxesis-education.pages.dev',pathname:'/portal/students/',search:'',hash:''};
 const move=url=>{const p=new URL(url,location.origin);location.pathname=p.pathname;location.search=p.search;};
 const document={getElementById:id=>id==='portal-app'?root:null,querySelector:q=>q==='h1'?{textContent:'Portal'}:null,querySelectorAll:()=>[]};
 const ctx=vm.createContext({document,location,history:{replaceState:(_a,_b,u)=>move(u),pushState:(_a,_b,u)=>move(u)},window:{scrollTo(){},addEventListener(){},print(){}},crypto:webcrypto,URL,URLSearchParams,Intl,Date,Math,JSON,setInterval(){},setTimeout(){},console,Blob,fetch:async()=>new Response('{}',{status:401}),fixture:data});
 vm.runInContext(source.replace('initialise();\n})();',"db={...empty(),...fixture};me=db.me;activeChild=db.students[0]?.id||'';selectOnboarding();globalThis.show=go;render();\n})();"),ctx);
 return {root,ctx};
}
test('first-party boundary forwards preview scope alongside its HttpOnly session',async()=>{
 const previous=globalThis.fetch;globalThis.crypto??=webcrypto;let headers;
 globalThis.fetch=async(_url,options)=>{headers=options.headers;return Response.json({preview:{readOnly:true}});};
 try{
  const r=await onRequest({request:new Request('https://auxesis-education.pages.dev/api/portal/state',{headers:{Cookie:'__Host-auxesis_session='+'a'.repeat(43),'x-auxesis-preview-role':'student','x-auxesis-preview-student':'scope-123'}}),params:{path:['state']}});
  assert.equal(r.status,200);assert.equal(headers['x-auxesis-preview-role'],'student');assert.equal(headers['x-auxesis-preview-student'],'scope-123');assert.equal(headers['x-auxesis-session'],'a'.repeat(43));
 }finally{globalThis.fetch=previous;}
});
test('imported source rows, missing dates and restricted preview screens render',{skip:!fixture},()=>{
 const data={me:{id:'owner',name:'Amanda',role:'admin'},settings:{reviewMode:true},preview:null};
 for(const {kind,data:r} of fixture.records){(data[kind]??=[]).push(r);}
 const {root,ctx}=screen(data);assert.ok(root.innerHTML.includes('Family access is disabled'));
 for(const s of data.students){
  for(const tab of ['overview','arrangements','lessons','billing','reports']){ctx.show('/portal/student/?id='+s.id+'&tab='+tab);assert.ok(root.innerHTML.includes('View as student'));assert.ok(root.innerHTML.includes('View as parent'));assert.ok(!root.innerHTML.includes('NaN'));}
 }
 for(const i of data.invoices){ctx.show('/portal/invoice/?id='+i.id);assert.ok(root.innerHTML.includes('Imported invoice'));assert.ok(!root.innerHTML.includes('data-action="issue-invoice"'));assert.ok(!root.innerHTML.includes('NaN'));}
 for(const l of data.lessons){ctx.show('/portal/lesson/?id='+l.id);assert.ok(root.innerHTML.includes('Lesson record'));assert.ok(!root.innerHTML.includes('Invalid Date'));}
 ctx.show('/portal/billing/');assert.ok(root.innerHTML.includes('Original billing records'));assert.ok(root.innerHTML.includes('Historical invoice register · 33 source entries'));
 const s=data.students[0];
 const preview={role:'student',studentId:s.id,studentName:s.name,readOnly:true};
 const studentState={me:{id:'preview',role:'student',name:s.name,studentId:s.id},preview,students:[s],parents:[],lessons:data.lessons.filter(l=>l.studentId===s.id),onboardings:[],entitled:true};
 const p=screen(studentState);p.ctx.show('/portal/dashboard/?view=student&previewStudent='+s.id);assert.ok(p.root.innerHTML.includes('Student preview'));assert.ok(p.root.innerHTML.includes('Return to Amanda’s workspace'));assert.ok(!p.root.innerHTML.includes('View as parent'));
});
