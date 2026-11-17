// Actual candidate worker, ephemeral D1, synthetic identities. No provider credentials.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import * as runtime from 'miniflare';
import {spawnSync} from 'node:child_process';
const root=resolve(process.env.QA_NATIVE_ROOT||'work/staging-deployment/runtime');
const legacy='https://auxesis-education.pages.dev',custom='https://auxedu.com';
const digest=s=>createHash('sha256').update(s).digest('hex');
const outcomes=[],negativeEvidence=[];let outbound=0;
const options={workers:[{name:'native-candidate-review-qa',modules:true,script:readFileSync(root+'/dist/_worker.js','utf8'),compatibilityDate:'2026-07-30',d1Databases:{PORTAL_DB:'ephemeral-review-qa'},bindings:{SITE_URL:legacy,PORTAL_RUNTIME_MODE:'production',PRODUCTION_ORIGIN:legacy,PORTAL_DB_ID:'ephemeral-review-qa',ADMIN_EMAIL:'owner@example.invalid',PRODUCTION_SYNC_ENABLED:'false',PRODUCTION_AUTOMATION_ENABLED:'false',PORTAL_STAGING_ONLY:'false',SESSION_SECRET:'synthetic-local-secret-not-a-real-credential',PORTAL_TOKEN_KEY:'0000000000000000000000000000000000000000000000000000000000000000'},outboundService:()=>{outbound++;return new Response('External network disabled by QA',{status:599});}}],cf:false,d1Persist:false};
const mf=new runtime.Miniflare(runtime.convertV4MiniflareOptions?runtime.convertV4MiniflareOptions(options):options);
try{
 const db=await mf.getD1Database('PORTAL_DB','native-candidate-review-qa');
 const migrations=root+'/cloudflare/migrations';
 for(const file of readdirSync(migrations).filter(f=>f.endsWith('.sql')).sort()){
  const parsed=spawnSync('python3',['-c',`import sys,sqlite3,json
text=sys.stdin.read();statements=[];buffer=''
for char in text:
 buffer+=char
 if char==';' and sqlite3.complete_statement(buffer):
  statements.append(buffer);buffer=''
if buffer.strip() and not all(not line.strip() or line.lstrip().startswith('--') for line in buffer.splitlines()):raise ValueError('Incomplete migration SQL')
print(json.dumps(statements))`],{input:readFileSync(migrations+'/'+file,'utf8'),encoding:'utf8'});
  assert.equal(parsed.status,0,'Migration statement parser');
  for(const statement of JSON.parse(parsed.stdout))await db.prepare(statement).run();
 }
 const initial=await db.prepare('SELECT COUNT(*) AS n FROM website_reviews').first();assert.equal(initial.n,0,'Only a new empty local review database is allowed');
 const session=randomBytes(32).toString('base64url');
 await db.prepare('INSERT INTO portal_accounts(id,email,name,role,enabled) VALUES(?1,?2,?3,?4,1)').bind('qa-owner','owner@example.invalid','Synthetic QA owner','admin').run();
 await db.prepare("INSERT INTO portal_sessions(token_hash,account_id,expires_at) VALUES(?1,?2,datetime('now','+10 minutes'))").bind(createHash('sha256').update(session).digest('base64url'),'qa-owner').run();
 const privateBefore=digest(JSON.stringify((await db.prepare('SELECT * FROM portal_accounts ORDER BY id').all()).results));
 let ipIndex=1;
 const send=(path,{origin=custom,method='GET',body,ip='192.0.2.1',cookie,source=origin}={})=>mf.dispatchFetch(origin+'/api/reviews'+path,{method,headers:{Origin:source,'CF-Connecting-IP':ip,...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const json=async r=>{const text=await r.text();try{return JSON.parse(text)}catch{throw Error('Native response HTTP '+r.status+' was not JSON: '+text.slice(0,80))}};
 const config=async ip=>{const r=await send('/config',{ip});const c=await json(r);assert.equal(r.status,200,'Custom-domain native config: '+JSON.stringify(c));assert.equal(c.ready,true);assert.equal(typeof c.token,'string');assert(Number.isFinite(c.notBefore)&&c.notBefore>=0&&c.notBefore<30000,'Bounded native delay expected');return c};
 const wait=c=>new Promise(r=>setTimeout(r,c.notBefore+50));
 const valid={review:'Synthetic isolated runtime review. Never production.',public_label:'Ephemeral QA',rating:5,consent:true};
 const ip='192.0.2.'+(++ipIndex),cfg=await config(ip);console.log('Native minimum delay milliseconds: '+cfg.notBefore);
 console.log('Isolated form/review tables: '+JSON.stringify((await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%form%' OR name LIKE '%review%') ORDER BY name").all()).results));
 for(const part of cfg.token.split('.')){try{const data=JSON.parse(Buffer.from(part,'base64url').toString());console.log('Synthetic token claim interface: '+JSON.stringify({keys:Object.keys(data),numeric:Object.fromEntries(Object.entries(data).filter(([,v])=>typeof v==='number'))}));}catch{}}
 try{const {open}=await import(root+'/cloudflare/crypto.js');const data=JSON.parse(await open('0000000000000000000000000000000000000000000000000000000000000000',cfg.token));console.log('Synthetic decrypted token claim interface: '+JSON.stringify({keys:Object.keys(data),numeric:Object.fromEntries(Object.entries(data).filter(([,v])=>typeof v==='number'))}));}catch{console.log('Synthetic token uses a different envelope; no contents logged.');}

 await wait(cfg);
 const response=await send('',{method:'POST',ip,body:{...valid,form_token:cfg.token}});const body=await json(response);assert.equal(response.status,200,JSON.stringify(body));assert.equal(body.ok,true);
 const stored=(await db.prepare('SELECT id,status,comment FROM website_reviews').all()).results;assert.equal(stored.length,1);assert.equal(stored[0].status,'pending');assert.equal(stored[0].comment,valid.review);
 const id=stored[0].id;assert.equal((await json(await send(''))).reviews.length,0);outcomes.push('PASS valid custom-domain review: explicit success, stored pending, absent publicly');
 const count=async()=>Number((await db.prepare('SELECT COUNT(*) AS n FROM website_reviews').first()).n);
 const replay=await send('',{method:'POST',ip,body:{...valid,form_token:cfg.token}});assert(replay.status>=400,'Replayed token rejected');assert.equal(await count(),1);outcomes.push('PASS replay rejected without new record');
 for(const scenario of ['invalid','missing-consent','missing-token','honeypot','too-fast','cross-origin','unapproved-host']){
  const ip='192.0.2.'+(++ipIndex),c=await config(ip);if(scenario!=='too-fast')await wait(c);
  const payload={...valid,review:'Synthetic isolated '+scenario+' case. Never production.',form_token:c.token};let origin=custom,source=custom;
  if(scenario==='invalid')payload.review='';if(scenario==='missing-consent')payload.consent=false;if(scenario==='missing-token')delete payload.form_token;if(scenario==='honeypot')payload.website='synthetic-bot.invalid';if(scenario==='cross-origin')source='https://unapproved.example';if(scenario==='unapproved-host'){origin='https://unapproved.example';source=origin;}
  const r=await send('',{origin,source,method:'POST',ip,body:payload});
  if(['honeypot','too-fast'].includes(scenario))assert(r.status===200||r.status>=400,'Native spam decoy or rejection');
  else assert(r.status>=400,scenario+' must reject (HTTP '+r.status+')');
  assert.equal(await count(),1,scenario+' created no record');
  negativeEvidence.push({scenario,httpStatus:r.status,storedRecordsAdded:0});
  outcomes.push(['honeypot','too-fast'].includes(scenario)&&r.status===200?'PASS '+scenario+' silently discarded; native HTTP 200 decoy preserved':'PASS '+scenario+' rejected');
 }
 for(const origin of [legacy,custom]){
  const manage=await send('/manage',{origin});assert(manage.status===401||manage.status===403);const moderate=await send('/moderate',{origin,method:'POST',body:{id,decision:'approve'}});assert(moderate.status===401||moderate.status===403);
 }
 const nonOwner=randomBytes(32).toString('base64url');
 await db.prepare('INSERT INTO portal_accounts(id,email,name,role,enabled) VALUES(?1,?2,?3,?4,1)').bind('qa-parent','parent@example.invalid','Synthetic QA parent','parent').run();
 await db.prepare("INSERT INTO portal_sessions(token_hash,account_id,expires_at) VALUES(?1,?2,datetime('now','+10 minutes'))").bind(createHash('sha256').update(nonOwner).digest('base64url'),'qa-parent').run();
 for(const path of ['/manage','/moderate']){const r=await send(path,{origin:legacy,cookie:'__Host-auxesis_session='+nonOwner,...(path==='/moderate'?{method:'POST',body:{id,decision:'approve'}}:{})});assert.equal(r.status,403,'Non-owner management denied');}
 await db.prepare('DELETE FROM portal_sessions WHERE account_id=?1').bind('qa-parent').run();await db.prepare('DELETE FROM portal_accounts WHERE id=?1').bind('qa-parent').run();
 const cookie='__Host-auxesis_session='+session;
 const queue=await send('/manage?status=pending',{origin:legacy,cookie});assert.equal(queue.status,200);assert((await json(queue)).reviews.some(r=>r.id===id));
 for(const decision of ['approve','reject']){
  const r=await send('/moderate',{origin:legacy,cookie,method:'POST',body:{id,decision}});assert.equal(r.status,200,decision+' permission');
  const list=await json(await send(''));assert.equal(list.reviews.some(r=>r.id===id),decision==='approve');
 }
 outcomes.push('PASS anonymous and non-owner management denied; local owner approves/rejects; publication follows moderation');
 assert.equal(digest(JSON.stringify((await db.prepare('SELECT * FROM portal_accounts ORDER BY id').all()).results)),privateBefore);
 assert.equal(outbound,0,'Native review tests never call external providers');
 const finalRows=(await db.prepare('SELECT id,status FROM website_reviews ORDER BY id').all()).results;
 const evidence={outcomes,negativeEvidence,isolatedDatabase:true,initialReviews:0,finalReviews:finalRows.length,finalStatuses:finalRows.map(r=>r.status),isolatedDataHash:digest(JSON.stringify(finalRows)),privateAccountsUnchanged:true,outboundRequests:outbound,productionD1Used:false};
 mkdirSync('work/native-review-qa',{recursive:true});writeFileSync('work/native-review-qa/results.json',JSON.stringify(evidence,null,2));console.log(outcomes.join('\n'));console.log(JSON.stringify(evidence));
}finally{await mf.dispose();}
