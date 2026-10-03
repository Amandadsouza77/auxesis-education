import test from 'node:test';
import assert from 'node:assert/strict';
import {submit} from '../lib/server.js';
import {onRequestGet as auth} from '../functions/api/auth.js';
import {onRequestGet as callback} from '../functions/api/callback.js';
import {onRequestGet as enquiryConfig} from '../functions/api/enquiry.js';
const env={SITE_URL:'https://example.com',RESEND_API_KEY:'test-only',EMAIL_FROM:'Auxesis <forms@example.com>',ENQUIRY_TO:'owner@example.com',TURNSTILE_SECRET_KEY:'test-only',GITHUB_CLIENT_ID:'client',GITHUB_CLIENT_SECRET:'test-only',GITHUB_REPOSITORY:'owner/site'};
const valid={name:'Parent',email:'parent@example.net',country:'Canada',timezone:'GMT -4',year:'Grade 11',programme:'IB Diploma',subject:'Biology',support:'Help with data analysis.',contact:'Email',consent:true,turnstile_token:'test-token'};
function request(data,origin='https://example.com'){return new Request('https://example.com/api/enquiry',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(data)});}
test('reports delivery availability without exposing credentials',async()=>{
  assert.deepEqual(await enquiryConfig({env:{}}).json(),{ready:false});
  assert.deepEqual(await enquiryConfig({env}).json(),{ready:true});
});
test('requires details for each Other choice and validates GMT offsets and calling codes',async()=>{
  for(const key of ['year','programme','subject'])assert.equal((await submit(request({...valid,[key]:'Other'}),env,'enquiry')).status,400);
  for(const timezone of ['Eastern Time','GMT +15','GMT -13','GMT +5.1'])assert.equal((await submit(request({...valid,timezone}),env,'enquiry')).status,400);
  assert.equal((await submit(request({...valid,contact:'Phone',phone:'5550100'}),env,'enquiry')).status,400);
  assert.equal((await submit(request({...valid,contact:'Phone',phone_country_code:'+44'}),env,'enquiry')).status,400);
});
test('delivers free-text countries, fractional GMT offsets, Other details and full phone numbers',async t=>{
  let sent;
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    if(url.includes('siteverify'))return Response.json({success:true,hostname:'example.com',action:'enquiry'});
    sent=JSON.parse(options.body);return Response.json({id:'mock'});
  });
  const data={...valid,country:'India',timezone:'GMT +5.5',year:'Other',other_year:'Year 13',programme:'Other',other_programme:'International science',subject:'Other',other_subject:'Combined science',contact:'Phone',phone_country_code:'+91',phone:'5550100'};
  assert.equal((await submit(request(data),env,'enquiry')).status,200);
  for(const value of ['India','GMT +5.5','Year 13','International science','Combined science','+91 5550100'])assert.ok(sent.text.includes(value));
});
test('rejects cross-origin submissions, missing consent and invalid emails',async()=>{
  assert.equal((await submit(request(valid,'https://attacker.example'),env,'enquiry')).status,403);
  assert.equal((await submit(request({...valid,consent:false}),env,'enquiry')).status,400);
  assert.equal((await submit(request({...valid,email:'invalid'}),env,'enquiry')).status,400);
});
test('does not falsely report delivery without configured credentials',async()=>{
  assert.equal((await submit(request(valid),{SITE_URL:env.SITE_URL},'enquiry')).status,503);
});
test('delivers validated enquiries with reply-to and keeps reviews unpublished',async t=>{
  const sent=[];t.mock.method(globalThis,'fetch',async(url,options)=>{if(url.includes('siteverify'))return Response.json({success:true,hostname:'example.com',action:sent.length?'review':'enquiry'});sent.push(JSON.parse(options.body));return Response.json({id:'mock'});});
  assert.equal((await submit(request(valid),env,'enquiry')).status,200);assert.equal(sent[0].reply_to,valid.email);
  assert.equal((await submit(request({review:'Great support.',relationship:'Parent',public_name:'A parent',consent:true,turnstile_token:'test-token'}),env,'review')).status,200);assert.match(sent[1].text,/Nothing has been published/);
});
test('rejects invalid spam checks and mail-delivery failures',async t=>{
  t.mock.method(globalThis,'fetch',async()=>Response.json({success:false}));assert.equal((await submit(request(valid),env,'enquiry')).status,400);
  t.mock.restoreAll();t.mock.method(globalThis,'fetch',async url=>url.includes('siteverify')?Response.json({success:true,hostname:'example.com',action:'enquiry'}):new Response('failure',{status:500}));assert.equal((await submit(request(valid),env,'enquiry')).status,502);
});
test('honeypot submissions never contact external services',async t=>{
  t.mock.method(globalThis,'fetch',()=>{throw new Error('No network allowed')});assert.equal((await submit(request({...valid,website:'bot'}),env,'enquiry')).status,200);
});
test('OAuth uses a secure nonce cookie and validates callback state',async()=>{
  const response=await auth({request:new Request('https://example.com/api/auth'),env});assert.equal(response.status,302);assert.match(response.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
  const location=new URL(response.headers.get('location'));assert.ok(location.searchParams.get('state'));assert.equal(location.searchParams.get('redirect_uri'),'https://example.com/api/callback');
  assert.equal((await callback({request:new Request('https://example.com/api/callback?state=wrong&code=x'),env})).status,400);
});
test('OAuth only issues credentials to a user with repository write access',async t=>{
  const req=()=>new Request('https://example.com/api/callback?state=nonce&code=x',{headers:{cookie:'__Host-auxesis-oauth=nonce'}});
  t.mock.method(globalThis,'fetch',async url=>url.includes('access_token')?Response.json({access_token:'mock-token'}):Response.json({permissions:{push:false}}));assert.equal((await callback({request:req(),env})).status,403);
  t.mock.restoreAll();t.mock.method(globalThis,'fetch',async url=>url.includes('access_token')?Response.json({access_token:'mock-token'}):Response.json({permissions:{push:true}}));const response=await callback({request:req(),env});assert.equal(response.status,200);assert.match(await response.text(),/event.origin!==allowed/);assert.match(response.headers.get('content-security-policy'),/nonce-/);
});
