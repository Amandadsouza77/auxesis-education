// Actual workerd regression: external providers are mocked, no email is sent.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import * as runtime from 'miniflare';
const bundle=await build({stdin:{resolveDir:process.cwd(),sourcefile:'inquiry-runtime-fixture.js',contents:`
import {withInquiry} from './cloudflare/inquiry-worker.js';
export default {async fetch(){
 const prior=globalThis.fetch;let providerRequests=0,redirect;
 globalThis.fetch=async(url,options)=>{
  // Construct with Cloudflare's real Request class before returning fixture data.
  new Request(url,options);
  if(url.includes('siteverify'))return Response.json({success:true,hostname:'auxedu.com',action:'enquiry'});
  if(url!=='https://api.resend.com/emails')throw Error('Unexpected provider');
  providerRequests++;redirect=options.redirect;return Response.json({id:'mock-only'});
 };
 try{
  const env={SITE_URL:'https://auxesis-education.pages.dev',EMAIL_FROM:'Auxesis <inquiries@auxedu.com>',RESEND_API_KEY:'test-only',TURNSTILE_SECRET_KEY:'test-only',TURNSTILE_SITE_KEY:'test-only'};
  const data={name:'Synthetic runtime QA',email:'qa@example.invalid',country:'Canada',timezone:'UTC−05:00',year:'Grade 11',programme:'IB Diploma',subject:'Biology',support:'Mock runtime test only',contact:'Email',consent:true,turnstile_token:'mock-token'};
  const response=await withInquiry({fetch(){throw Error('Unexpected native fallback')}}).fetch(new Request('https://auxedu.com/api/enquiry',{method:'POST',headers:{Origin:'https://auxedu.com','Content-Type':'application/json'},body:JSON.stringify(data)}),env);
  const body=await response.json();return Response.json({status:response.status,ok:body.ok===true,providerRequests,redirect});
 }finally{globalThis.fetch=prior;}
}};
`},bundle:true,format:'esm',write:false});
const options={workers:[{name:'inquiry-runtime-regression',modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-07-30'}],cf:false};
const mf=new runtime.Miniflare(runtime.convertV4MiniflareOptions?runtime.convertV4MiniflareOptions(options):options);
try{
 const result=await(await mf.dispatchFetch('https://test.invalid/')).json();
 assert.deepEqual(result,{status:200,ok:true,providerRequests:1,redirect:'manual'});
 console.log('PASS: Cloudflare workerd accepts the inquiry request, verifies the mocked spam check, and makes exactly one mocked Resend request using manual redirects. No email sent.');
}finally{await mf.dispose();}
