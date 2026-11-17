import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withPublicSite} from '../cloudflare/public-site-worker.js';
const legacy='https://auxesis-education.pages.dev',site='https://auxedu.com';
test('public review domain adapter changes only SITE_URL for exact allowed routes',async()=>{
 const env={SITE_URL:legacy,PORTAL_DB:{},SECRET:'synthetic'},ctx={};let calls=[];
 const worker=withPublicSite({fetch:async(request,bindings,context)=>{calls.push({request,bindings,context});return Response.json({ok:true});}});
 for(const [path,method] of [['/api/reviews','GET'],['/api/reviews','POST'],['/api/reviews/config','GET']]){
  const request=new Request(site+path,{method,headers:{Origin:site},...(method==='POST'?{body:'{"review":"synthetic"}'}:{})});
  await worker.fetch(request,env,ctx);const call=calls.at(-1);
  assert.equal(call.request,request);assert.equal(call.context,ctx);assert.deepEqual(call.bindings,{...env,SITE_URL:site});assert.equal(env.SITE_URL,legacy);
 }
 for(const [origin,path,method] of [[site,'/api/reviews/manage','GET'],[site,'/api/reviews/moderate','POST'],[site,'/api/reviews/config','POST'],[site,'/api/reviews/','GET'],[site,'/api/enquiry','POST'],[site,'/api/portal/state','GET'],['https://evil.example','/api/reviews','POST'],[legacy,'/api/reviews','POST']]){
  await worker.fetch(new Request(origin+path,{method}),env,ctx);assert.equal(calls.at(-1).bindings,env);
 }
 for(const SITE_URL of ['', 'https://evil.example']){
  const bindings={...env,SITE_URL};await worker.fetch(new Request(site+'/api/reviews'),bindings,ctx);assert.equal(calls.at(-1).bindings,bindings);
 }
});
