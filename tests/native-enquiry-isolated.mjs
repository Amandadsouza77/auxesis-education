// Exercise the complete assembled candidate. External providers are local mocks.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as runtime from 'miniflare';
const root=resolve(process.env.QA_NATIVE_ROOT||'work/staging-deployment/runtime');
const origin='https://auxedu.com';let providerMode='success';const calls=[],messages=[];
const options={workers:[{name:'assembled-enquiry-qa',modules:true,script:readFileSync(root+'/dist/_worker.js','utf8'),compatibilityDate:'2026-07-30',bindings:{SITE_URL:'https://auxesis-education.pages.dev',PRODUCTION_ORIGIN:'https://auxesis-education.pages.dev',PORTAL_RUNTIME_MODE:'production',PORTAL_STAGING_ONLY:'false',PRODUCTION_SYNC_ENABLED:'false',PRODUCTION_AUTOMATION_ENABLED:'false',EMAIL_FROM:'Auxesis <inquiries@auxedu.com>',ENQUIRY_TO:'untrusted-override@example.invalid',RESEND_API_KEY:'synthetic-resend-key',TURNSTILE_SECRET_KEY:'synthetic-turnstile-key',TURNSTILE_SITE_KEY:'synthetic-public-key'},outboundService:async request=>{
 const url=new URL(request.url);calls.push(url.hostname);
 if(url.hostname==='challenges.cloudflare.com'&&url.pathname==='/turnstile/v0/siteverify')return Response.json({success:true,hostname:'auxedu.com',action:'enquiry'});
 if(url.href==='https://api.resend.com/emails'){messages.push(await request.json());return Response.json(providerMode==='success'?{id:'synthetic-only'}:{error:'Synthetic provider failure'},{status:providerMode==='success'?200:502});}
 throw Error('Unexpected external request blocked');
 }}],cf:false};
const mf=new runtime.Miniflare(runtime.convertV4MiniflareOptions?runtime.convertV4MiniflareOptions(options):options);
try{
 const ready=await mf.dispatchFetch(origin+'/api/enquiry');assert.equal(ready.status,200);assert.equal((await ready.json()).ready,true);
 const data={name:'Synthetic actual candidate QA',email:'qa@example.invalid',country:'Canada',timezone:'America/Toronto',year:'Grade 11',programme:'IB Diploma',subject:'Biology',support:'Ephemeral mocked-provider verification only.',contact:'Email',consent:true,turnstile_token:'synthetic-token',to:'untrusted@example.invalid'};
 const post=body=>mf.dispatchFetch(origin+'/api/enquiry',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.100'},body:JSON.stringify(body)});
 const invalid=await post({...data,consent:false});assert(invalid.status>=400);assert((await invalid.json()).error);assert.equal(calls.length,0);
 const sent=await post(data);assert.equal(sent.status,200);assert.equal((await sent.json()).ok,true);assert.equal(messages.length,1);assert.deepEqual(messages[0].to,['adsouza35@gmail.com']);assert.equal(messages[0].reply_to,data.email);
 providerMode='failure';const failed=await post(data);assert(failed.status>=400);const failure=await failed.json();assert.notEqual(failure.ok,true);assert(failure.error);assert.equal(messages.length,2);
 assert.deepEqual(calls,['challenges.cloudflare.com','api.resend.com','challenges.cloudflare.com','api.resend.com']);
 const evidence={assembledCandidate:true,readiness:true,consentRejectedBeforeProviders:true,mockedSuccess:true,recipientPreserved:true,visitorReplyToPreserved:true,providerFailureNotSuccess:true,mockedProviderCalls:calls.length,realEmailsSent:0,productionD1Used:false};
 mkdirSync('work/native-review-qa',{recursive:true});writeFileSync('work/native-review-qa/enquiry.json',JSON.stringify(evidence,null,2));console.log('PASS assembled candidate enquiry: readiness, required consent, mocked delivery/private recipient and truthful provider error; zero real emails.');
}finally{await mf.dispose();}
