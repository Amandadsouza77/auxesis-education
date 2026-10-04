import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {publicForm} from '../lib/public-forms.js';
globalThis.crypto??=webcrypto;
const site='https://auxesis-education.pages.dev';
test('public submission boundary blocks other origins and oversized requests before contacting mail service',async()=>{
 const old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Unexpected call');};
 try{let r=await publicForm(new Request(site+'/api/enquiry',{method:'POST',headers:{Origin:'https://other.invalid','Content-Type':'application/json'},body:'{}'}),'enquiry');assert.equal(r.status,403);
 r=await publicForm(new Request(site+'/api/enquiry',{method:'POST',headers:{Origin:site,'Content-Type':'application/json'},body:'x'.repeat(24001)}),'enquiry');assert.equal(r.status,413);assert.equal(calls,0);}finally{globalThis.fetch=old;}
});
test('one-use form checks and submissions go only to the selected service, carrying a hashed client address',async()=>{
 const old=globalThis.fetch;const calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,options});return Response.json(options.method==='GET'?{ready:true,token:'check'}:{ok:true});};
 try{for(const kind of ['enquiry','review']){const cfg=await publicForm(new Request(site+'/api/enquiry',{headers:{'CF-Connecting-IP':'192.0.2.7'}}),kind);assert.equal((await cfg.json()).token,'check');
 const sent=await publicForm(new Request(site+'/api/'+kind,{method:'POST',headers:{Origin:site,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.7'},body:'{"consent":true,"form_token":"check"}'}),kind);assert.equal((await sent.json()).ok,true);}
 assert.equal(calls.length,4);assert.ok(calls.every(c=>c.url.startsWith('https://auxesis-portal-service.floot.app/_api/public/forms?kind=')));assert.ok(calls.every(c=>/^[a-f0-9]{64}$/.test(c.options.headers['x-auxesis-client'])));assert.ok(!JSON.stringify(calls).includes('192.0.2.7'));
 }finally{globalThis.fetch=old;}
});
test('unavailable or malformed backend responses cannot be reported as successful delivery',async()=>{
 const old=globalThis.fetch;try{for(const fetcher of [async()=>{throw Error('Offline');},async()=>new Response('Unavailable',{status:503})]){globalThis.fetch=fetcher;const r=await publicForm(new Request(site+'/api/enquiry'),'enquiry');assert.equal(r.status,503);assert.equal((await r.json()).ready,false);}}finally{globalThis.fetch=old;}
});
