// Native inquiry-only release. Provider writes are limited to deployment rollback.
import {readFileSync,writeFileSync,readdirSync,statSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative} from 'node:path';
import {prepareNativeInquiry} from './prepare-native-inquiry.mjs';
const account='2ac862d7c1f865935d185df59e7bd719',project='auxesis-education';
const root=resolve('work/staging-deployment/runtime'),state='work/inquiry-release.json';
const origin='https://auxesis-education.pages.dev';
const sha=s=>createHash('sha256').update(s).digest('hex');
const require=(v,m)=>{if(!v)throw Error(m);};
async function cf(path,method='GET',body){
 require(method==='GET'||method==='POST'&&path.endsWith('/query')&&body?.sql?.startsWith('SELECT ')||method==='POST'&&new RegExp('^/pages/projects/'+project+'/deployments/[^/]+/rollback$').test(path),'Provider write outside inquiry release rejected');
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method,redirect:'error',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 require(r.ok,'Inquiry release provider HTTP '+r.status);const d=await r.json();require(d.success,'Inquiry release provider rejected');return d.result;
}
async function businessDigest(id){const result={};for(const table of ['portal_records','portal_accounts','portal_audit','website_reviews']){
 const d=await cf('/d1/database/'+id+'/query','POST',{sql:'SELECT * FROM '+table+' ORDER BY id'});const rows=d.flatMap(x=>x.results||[]);result[table]={count:rows.length,hash:sha(JSON.stringify(rows))};
 }return result;}
function files(dir){return readdirSync(dir).flatMap(n=>{const p=resolve(dir,n);return statSync(p).isDirectory()?files(p):[p];});}
async function liveBody(path){let r;try{r=await fetch(origin+path,{redirect:'error',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(30000)});}catch(e){throw Error('Live baseline fetch failed: '+path+' ('+(e.cause?.code||e.name)+')');}require(r.ok,'Live baseline fetch failed: '+path+' HTTP '+r.status);return Buffer.from(await r.arrayBuffer());}
async function prepare(){
 require(process.env.GITHUB_REPOSITORY==='Amandadsouza77/auxesis-education'&&process.env.GITHUB_REF==='refs/heads/codex/cloudflare-backend-migration','Unexpected inquiry release branch');
 const live=await cf('/pages/projects/'+project),config=live.deployment_configs.production,v=config.env_vars;
 require(live.canonical_deployment?.id,'Rollback deployment unavailable');
 require(v.PRODUCTION_SYNC_ENABLED?.value==='false'&&v.PRODUCTION_AUTOMATION_ENABLED?.value==='false','Disabled automation guards required');
 require(v.SITE_URL?.value===origin,'Preserve verified initial inquiry origin');
 require(v.ENQUIRY_TO?.value==='adsouza35@gmail.com','Unexpected inquiry recipient');
 require(/<[^<>\s@]+@auxedu\.com>$/.test(v.EMAIL_FROM?.value||''),'Verified auxedu.com sender required');
 require(['RESEND_API_KEY','TURNSTILE_SECRET_KEY','TURNSTILE_SITE_KEY'].every(k=>!!v[k]),'Inquiry credentials missing');
 const db=config.d1_databases.PORTAL_DB.id;
 require(db!=='4f12fc1d-3e0d-4a11-bd65-e577ce906114','Production/staging isolation required');
 const before={deployment:live.canonical_deployment.id,config:JSON.stringify(live.deployment_configs),source:JSON.stringify(live.source),db,business:await businessDigest(db),publicFiles:{}};
 // Refuse to overwrite newer live assets or any private route from an old package.
 for(const file of files(resolve(root,'dist'))){
  const path=relative(resolve(root,'dist'),file).replaceAll('\\','/');
  if(path==='_worker.js'||path==='_headers'||path==='_redirects'||path==='_routes.json'||path.startsWith('.'))continue;
  const url='/'+path.replace(/index\.html$/,'');const current=await liveBody(url),packageBytes=readFileSync(file);
  require(sha(current)===sha(packageBytes),'Private package differs from live asset: '+path+'; reconcile before release');
  before.publicFiles[url]=sha(current);
 }
 mkdirSync('work',{recursive:true});writeFileSync(state,JSON.stringify(before),{mode:0o600});
 prepareNativeInquiry(root);
 const privacy=resolve(root,'dist/privacy-consent/index.html'),old=readFileSync(privacy,'utf8');
 const expected='The online enquiry service is currently unavailable. Please send enquiries to the contact email shown on this website. Messages sent to that Gmail address are handled by Google’s email service. The former description of website enquiries being stored and emailed through Floot does not describe the current live website.';
 const replacement='Tutoring enquiries submitted through this website are checked using Cloudflare Turnstile and sent through Resend to Amanda’s Gmail inbox, which is handled by Google. The enquiry includes the contact and learning-support details you provide and your consent to be contacted. Resend processes the message and delivery information to provide this service. You can also email the contact address shown on this website directly.';
 require(old.split(expected).length===2,'Inquiry privacy paragraph differs; reconcile before release');writeFileSync(privacy,old.replace(expected,replacement));
 const now=await cf('/pages/projects/'+project);require(now.canonical_deployment.id===before.deployment&&JSON.stringify(now.deployment_configs)===before.config,'Production changed during preparation');
 console.log('::notice::Native inquiry package prepared; all baseline public assets match, retained business records hashed, original rollback deployment captured.');
}
async function check(){
 const b=JSON.parse(readFileSync(state)),live=await cf('/pages/projects/'+project);
 require(live.canonical_deployment?.id===b.deployment&&JSON.stringify(live.deployment_configs)===b.config,'Production changed before deployment');
 console.log('::notice::Original production deployment and settings still match preflight.');
}
async function verify(){
 const b=JSON.parse(readFileSync(state));
 let ready=false;for(let i=0;i<12;i++){
  const r=await fetch(origin+'/api/enquiry?release='+process.env.GITHUB_SHA,{headers:{'Cache-Control':'no-cache'}});
  if(r.ok){const d=await r.json().catch(()=>({}));if(d.ready&&d.siteKey){ready=true;break;}}
  await new Promise(r=>setTimeout(r,3000));
 }require(ready,'Deployed inquiry readiness did not become available');
 for(const host of [origin,'https://auxedu.com']){
  const r=await fetch(host+'/api/enquiry',{headers:{'Cache-Control':'no-cache'},redirect:'error'});const d=await r.json();require(r.ok&&d.ready&&d.siteKey,'Inquiry readiness unavailable on '+host);
 }
 for(const [path,digest] of Object.entries(b.publicFiles)){
  if(path==='/app.js'||path==='/privacy-consent/')continue;
  require(sha(await liveBody(path))===digest,'Unrelated public asset changed: '+path);
 }
 for(const path of ['/api/portal/state','/api/reviews/manage']){
  const r=await fetch(origin+path,{redirect:'manual'});require(r.status===401,'Anonymous access protection changed: '+path);
 }
 const reviews=await fetch(origin+'/api/reviews');require(reviews.ok&&Array.isArray((await reviews.json()).reviews),'Native reviews unavailable');
 const live=await cf('/pages/projects/'+project);
 require(live.canonical_deployment?.deployment_trigger?.metadata?.commit_hash===process.env.GITHUB_SHA,'Unexpected production commit');
 require(JSON.stringify(live.deployment_configs)===b.config&&JSON.stringify(live.source)===b.source,'Production configuration changed');
 require(JSON.stringify(await businessDigest(b.db))===JSON.stringify(b.business),'Retained business records changed');
 console.log('::notice::Inquiry readiness verified on both domains; unrelated assets, native access boundaries, records and settings preserved. Actual inbox receipt still requires a browser submission.');
}
async function rollback(){
 let b;try{b=JSON.parse(readFileSync(state));}catch{console.log('::notice::No prepared release; production untouched.');return;}
 const live=await cf('/pages/projects/'+project);
 if(live.canonical_deployment?.id===b.deployment){console.log('::notice::Original production remains active.');return;}
 require(live.canonical_deployment?.deployment_trigger?.metadata?.commit_hash===process.env.GITHUB_SHA,'A different release is active; automatic rollback stopped');
 await cf('/pages/projects/'+project+'/deployments/'+b.deployment+'/rollback','POST');
 require((await cf('/pages/projects/'+project)).canonical_deployment?.id===b.deployment,'Rollback verification failed');
 console.log('::notice::Previous production deployment restored.');
}
try{const action=process.argv[2];if(action==='prepare')await prepare();else if(action==='check')await check();else if(action==='verify')await verify();else if(action==='rollback')await rollback();else throw Error('Unknown release action');}catch(e){console.error('::error::'+e.message);process.exitCode=1;}
