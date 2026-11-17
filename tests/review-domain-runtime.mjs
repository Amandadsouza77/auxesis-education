// Synthetic isolated D1 only. Never connects to production, publishes reviews or sends mail.
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import assert from 'node:assert/strict';
const root=resolve('work/staging-deployment/runtime');
const {withPublicSite}=await import('../cloudflare/public-site-worker.js');
await build({entryPoints:[root+'/staging-entry.js'],bundle:true,format:'esm',outfile:root+'/qa-worker.js'});
const mf=new Miniflare({modules:true,scriptPath:root+'/qa-worker.js',compatibilityDate:'2026-10-01',d1Databases:{PORTAL_DB:'isolated-review-qa'},bindings:{SITE_URL:'https://auxesis-education.pages.dev',PRODUCTION_SYNC_ENABLED:'false',PRODUCTION_AUTOMATION_ENABLED:'false',PORTAL_STAGING_ONLY:'false'}});
try{
 const db=await mf.getD1Database('PORTAL_DB');
 const migrations=root+'/cloudflare/migrations';
 for(const file of readdirSync(migrations).filter(f=>f.includes('website_reviews')&&f.endsWith('.sql'))){
  // D1 exec accepts a SQL statement on each line.
  const sql=readFileSync(migrations+'/'+file,'utf8').replace(/--[^\n]*/g,'');
  for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(statement).run();
 }
 const native=await mf.getWorker();
 // Native fetch via Miniflare fixes its bindings, so test the candidate env
 // by starting an independent instance with the scoped SITE_URL below.
 const before=await native.fetch('https://auxedu.com/api/reviews/config');
 assert.equal(before.status,403);assert.match(await before.text(),/Unauthorized hostname/);
 const candidate=new Miniflare({modules:true,scriptPath:root+'/qa-worker.js',compatibilityDate:'2026-10-01',d1Databases:{PORTAL_DB:'isolated-review-qa'},bindings:{SITE_URL:'https://auxedu.com',PRODUCTION_SYNC_ENABLED:'false',PRODUCTION_AUTOMATION_ENABLED:'false',PORTAL_STAGING_ONLY:'false'}});
 try{
  const candidateDb=await candidate.getD1Database('PORTAL_DB');
  for(const file of readdirSync(migrations).filter(f=>f.includes('website_reviews')&&f.endsWith('.sql'))){for(const s of readFileSync(migrations+'/'+file,'utf8').replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean))await candidateDb.prepare(s).run();}
  const worker=await candidate.getWorker();
  const config=await worker.fetch('https://auxedu.com/api/reviews/config');
  console.log('Candidate config HTTP '+config.status);
  const cfg=await config.json();assert.equal(config.status,200);assert.ok(cfg.token);
  const post=data=>worker.fetch('https://auxedu.com/api/reviews',{method:'POST',headers:{Origin:'https://auxedu.com','Content-Type':'application/json'},body:JSON.stringify(data)});
  const invalid=await post({review:'',public_label:'',consent:false,form_token:cfg.token});assert.ok(invalid.status>=400);assert.ok((await invalid.json()).error);
  const fresh=await (await worker.fetch('https://auxedu.com/api/reviews/config')).json();
  const valid=await post({review:'Synthetic isolated test; never publish.',public_label:'Isolated QA',consent:true,rating:5,form_token:fresh.token});
  const result=await valid.json();console.log('Candidate valid review HTTP '+valid.status+'; result keys '+Object.keys(result));assert.equal(valid.status,200);assert.equal(result.ok,true);
  const stored=await candidateDb.prepare('SELECT status FROM website_reviews').all();assert.equal(stored.results.length,1);assert.equal(stored.results[0].status,'pending');
  const published=await (await worker.fetch('https://auxedu.com/api/reviews')).json();assert.deepEqual(published.reviews,[]);
  const repeated=await post({review:'Synthetic isolated test; never publish.',public_label:'Isolated QA',consent:true,form_token:fresh.token});assert.ok(repeated.status>=400,'One-use token must reject replay');
  console.log('PASS: native hostname failure reproduced; valid review stored pending; invalid input, replay and public exclusion checked in ephemeral D1.');
 }finally{await candidate.dispose();}
}finally{await mf.dispose();}
