import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withPublicSite} from '../cloudflare/public-site-worker.js';
const legacy='https://auxesis-education.pages.dev',site='https://auxedu.com';
test('public review adapter checks original origin and retains native bindings and request data',async()=>{
 const env={SITE_URL:legacy,PRODUCTION_ORIGIN:legacy,PORTAL_DB:{},SECRET:'synthetic'},ctx={};const calls=[];
 const worker=withPublicSite({fetch:async(request,bindings,context)=>{calls.push({request,bindings,context});return Response.json({ok:true});}});
 for(const [path,method] of [['/api/reviews','GET'],['/api/reviews','POST'],['/api/reviews/config','GET']]){
  const request=new Request(site+path+'?sample=1',{method,headers:{Origin:site,Referer:site+'/recommendations/','CF-Connecting-IP':'192.0.2.4'},...(method==='POST'?{body:'{"review":"synthetic","form_token":"fixture","website":""}'}:{})});
  await worker.fetch(request,env,ctx);const call=calls.at(-1);
  assert.equal(call.context,ctx);assert.equal(call.bindings,env);assert.equal(call.request.url,legacy+path+'?sample=1');assert.equal(call.request.headers.get('Origin'),legacy);assert.equal(call.request.headers.get('Referer'),legacy+'/recommendations/');assert.equal(call.request.headers.get('CF-Connecting-IP'),'192.0.2.4');
  if(method==='POST')assert.deepEqual(await call.request.json(),{review:'synthetic',form_token:'fixture',website:''});
 }
 for(const source of [null,'https://evil.example']){
  const before=calls.length;const r=await worker.fetch(new Request(site+'/api/reviews',{method:'POST',headers:source?{Origin:source}:{},body:'{}'}),env,ctx);assert.equal(r.status,403);assert.equal(calls.length,before,'Unapproved origin never reaches native code');
 }
 const before=calls.length;await worker.fetch(new Request(site+'/api/reviews/config'),env,ctx);assert.equal(calls.length,before+1,'Same-origin GET can omit Origin');
 for(const [origin,path,method] of [[site,'/api/reviews/manage','GET'],[site,'/api/reviews/moderate','POST'],[site,'/api/reviews/config','POST'],[site,'/api/reviews/','GET'],[site,'/api/enquiry','POST'],[site,'/api/portal/state','GET'],['https://evil.example','/api/reviews','POST']]){
  const request=new Request(origin+path,{method});await worker.fetch(request,env,ctx);assert.equal(calls.at(-1).request,request);assert.equal(calls.at(-1).bindings,env);
 }
 for(const bindings of [{...env,SITE_URL:''},{...env,SITE_URL:'https://evil.example'},{...env,PRODUCTION_ORIGIN:'https://evil.example'}]){const request=new Request(site+'/api/reviews');await worker.fetch(request,bindings,ctx);assert.equal(calls.at(-1).request,request);assert.equal(calls.at(-1).bindings,bindings);}
});
test('authenticated native token age is enforced without consuming it or changing native validation',async()=>{
 const {seal}=await import('../cloudflare/crypto.js');
 const key='synthetic-test-only-key',env={SITE_URL:legacy,PRODUCTION_ORIGIN:legacy,PORTAL_TOKEN_KEY:key};let calls=0;
 const worker=withPublicSite({fetch:()=>{calls++;return Response.json({ok:true});}});
 const post=token=>new Request(site+'/api/reviews',{method:'POST',headers:{Origin:site,'Content-Type':'application/json'},body:JSON.stringify({review:'Synthetic test only',form_token:token})});
 const fresh=await seal(key,JSON.stringify({nonce:'test-nonce',origin:legacy,expires:Date.now()+1800000}));
 const early=await worker.fetch(post(fresh),env);assert.equal(early.status,429);assert.match((await early.json()).error,/wait a moment/);assert.equal(calls,0);
 const legacyEarly=await worker.fetch(new Request(legacy+'/api/reviews',{method:'POST',headers:{Origin:legacy},body:JSON.stringify({form_token:fresh})}),env);assert.equal(legacyEarly.status,429);assert.equal(calls,0,'Legacy endpoint cannot bypass minimum age');
 const mature=await seal(key,JSON.stringify({nonce:'test-nonce',origin:legacy,expires:Date.now()+1800000-2000}));
 assert.equal((await worker.fetch(post(mature),env)).status,200);assert.equal(calls,1);
 await worker.fetch(post('tampered-token'),env);assert.equal(calls,2,'Native handler still rejects invalid tokens');
 const huge=await worker.fetch(new Request(site+'/api/reviews',{method:'POST',headers:{Origin:site},body:'x'.repeat(65537)}),env);assert.equal(huge.status,413);assert.equal(calls,2);
});
