import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addInternationalRoutes} from '../scripts/international-public-wrapper.mjs';
const pages=JSON.parse(readFileSync('content/international-pages.json','utf8'));
const source=readFileSync('cloudflare/public-site-worker.js','utf8');
test('new programme routes redirect while private and API paths remain untouched',async()=>{
 const updated=addInternationalRoutes(source,pages);
 const {withPublicSite}=await import('data:text/javascript;base64,'+Buffer.from(updated).toString('base64'));
 const worker=withPublicSite({fetch:async()=>new Response('native',{status:200})});
 for(const p of pages){
  const r=await worker.fetch(new Request('https://auxesis-education.pages.dev/'+p.slug+'/?sample=1'));
  assert.equal(r.status,301);assert.equal(r.headers.get('location'),'https://auxedu.com/'+p.slug+'/?sample=1');
 }
 for(const path of ['/api/enquiry','/portal/','/admin/']){
  const r=await worker.fetch(new Request('https://auxesis-education.pages.dev'+path));assert.equal(r.status,200);assert.equal(await r.text(),'native');
 }
});
test('route assembly rejects missing markers and unsafe slugs',()=>{
 assert.throws(()=>addInternationalRoutes('unexpected',pages));
 assert.throws(()=>addInternationalRoutes(source,[...pages.slice(0,3),{slug:'../private'}]));
});
