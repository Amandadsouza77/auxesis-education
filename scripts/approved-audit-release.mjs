// Approved public correction release. Provider writes are limited to deployment rollback.
import {readFileSync,writeFileSync,readdirSync,statSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {applyPublicCopy} from './approved-public-copy.mjs';
import {build} from 'esbuild';
import {prepareNativeInquiry} from './prepare-native-inquiry.mjs';
const account='2ac862d7c1f865935d185df59e7bd719',project='auxesis-education';
const root=resolve('work/staging-deployment/runtime'),state='work/approved-audit-release.json';
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
async function liveBody(path){
 let r,url=origin+path;
 for(let hop=0;hop<4;hop++){
  try{r=await fetch(url,{redirect:'manual',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(30000)});}catch(e){throw Error('Live baseline fetch failed: '+path+' ('+(e.cause?.code||e.name)+')');}
  if(![301,302,303,307,308].includes(r.status))break;
  const next=new URL(r.headers.get('Location'),url);require(next.origin===origin,'Unexpected external asset redirect: '+path);url=next.href;
 }
 require(r.ok||r.status===404&&path==='/404.html','Live baseline fetch failed: '+path+' HTTP '+r.status);return Buffer.from(await r.arrayBuffer());
}
async function prepare(){
 require(process.env.GITHUB_REPOSITORY==='Amandadsouza77/auxesis-education'&&process.env.GITHUB_REF==='refs/heads/codex/cloudflare-backend-migration','Unexpected inquiry release branch');
 const live=await cf('/pages/projects/'+project),config=live.deployment_configs.production,v=config.env_vars;
 require(live.canonical_deployment?.deployment_trigger?.metadata?.commit_hash==='0b4935c3e47654003dd5ffebea6f783a7e441ab3','Live source changed; reconcile approved corrections before deploying');
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
  const captured=JSON.parse(readFileSync('content/approved-baseline-hashes.json'));
  require(captured[path]?sha(current)===captured[path]:sha(current)===sha(packageBytes),'Live baseline changed: '+path+'; reconcile before release');
  before.publicFiles[url]=sha(current);
 }
 mkdirSync('work',{recursive:true});writeFileSync(state,JSON.stringify(before),{mode:0o600});
 prepareNativeInquiry(root);
 // Preserve the native enquiry-only bootstrap, while updating its approved response wording.
 const app=resolve(root,'dist/app.js');writeFileSync(app,readFileSync(app,'utf8').replace('Amanda will be in touch to discuss the student’s needs and tutoring arrangements, usually within 24–48 hours.','Amanda normally replies within 24 hours on business days, excluding Canadian statutory holidays.'));
 writeFileSync(resolve(root,'inquiry/lib/time-zones.js'),readFileSync('lib/time-zones.js'));
 writeFileSync(resolve(root,'inquiry/cloudflare/public-site-worker.js'),readFileSync('cloudflare/public-site-worker.js'));
 writeFileSync(resolve(root,'inquiry-entry.js'),"import nativeWorker from './staging-entry.js';\nimport {withInquiry} from './inquiry/cloudflare/inquiry-worker.js';\nimport {withPublicSite} from './inquiry/cloudflare/public-site-worker.js';\nexport default withPublicSite(withInquiry(nativeWorker));\n");
 applyPublicCopy(resolve(root,'dist'));
 const css=resolve(root,'dist/styles.css');writeFileSync(css,readFileSync(css,'utf8')+'\n.field select{min-width:0;max-width:100%}.field-hint{font-weight:400;font-size:.85rem}\n');
 await build({entryPoints:['lib/time-zones.js'],bundle:true,format:'iife',globalName:'AuxesisTimeZones',outfile:resolve(root,'dist/time-zones.js')});
 for(const name of ['robots.txt','sitemap.xml']){
  let text=readFileSync(resolve(root,'dist',name),'utf8').replaceAll(origin,'https://auxedu.com');
  if(name==='robots.txt')text=text.replace('Disallow: /api/','Disallow: /api/\nDisallow: /portal/\nDisallow: /resources/');
  writeFileSync(resolve(root,'dist',name),text);
 }
 // Verify retained records and backup metadata without logging any personal information.
 for(const [label,id] of [['production',db],['staging','4f12fc1d-3e0d-4a11-bd65-e577ce906114']]){
  const tables=(await cf('/d1/database/'+id+'/query','POST',{sql:"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"})).flatMap(x=>x.results||[]).map(x=>x.name);
  const counts={};for(const table of tables.filter(x=>/portal|backup|recovery/.test(x)&&/^[a-z_]+$/.test(x))){const rows=await cf('/d1/database/'+id+'/query','POST',{sql:'SELECT COUNT(*) AS count FROM '+table});counts[table]=rows[0]?.results?.[0]?.count;}
  require(label!=='production'||counts.portal_records>0,'Expected retained testing records missing');
  console.log('::notice::Retained restricted record inventory '+JSON.stringify({system:label,counts,recordWrites:0}));
 }
 for(const file of files(resolve(root,'dist'))){const path=relative(resolve(root,'dist'),file);if(!['_worker.js','_headers','_redirects','_routes.json'].includes(path)&&!path.startsWith('.'))before.publicFiles['/'+path.replace(/index\.html$/,'')]=sha(readFileSync(file));}
 writeFileSync(state,JSON.stringify(before),{mode:0o600});
 const now=await cf('/pages/projects/'+project);require(now.canonical_deployment.id===before.deployment&&JSON.stringify(now.deployment_configs)===before.config,'Production changed during preparation');
 console.log('::notice::Approved corrections prepared from current public source; native runtime retained, records inventoried and hashed, original rollback captured.');
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
 const deployed=await cf('/pages/projects/'+project);
 const deploymentOrigin=new URL(deployed.canonical_deployment.url).origin;
 for(const [path,digest] of Object.entries(b.publicFiles)){
  let valid=false;for(let i=0;i<12;i++){let url=deploymentOrigin+path,r;for(let hop=0;hop<4;hop++){r=await fetch(url,{redirect:'manual'});if(![301,302,303,307,308].includes(r.status))break;const next=new URL(r.headers.get('location'),url);require(next.origin===deploymentOrigin,'Unexpected deployment asset redirect');url=next.href;}if(sha(Buffer.from(await r.arrayBuffer()))===digest){valid=true;break;}await new Promise(r=>setTimeout(r,3000));}
  require(valid,'Released asset differs: '+path);
 }
 for(const route of JSON.parse(readFileSync('templates/routes.json'))){
  let url=origin+route.route,r;for(let hop=0;hop<4;hop++){r=await fetch(url,{redirect:'manual'});const next=r.headers.get('location')&&new URL(r.headers.get('location'),url);if(next?.origin==='https://auxedu.com')break;require([301,302,307,308].includes(r.status)&&next?.origin===origin,'Canonical normalization failed: '+route.route);url=next.href;}require(r.status===301&&new URL(r.headers.get('location'),url).origin==='https://auxedu.com','Canonical redirect failed: '+route.route);
  const page=await fetch('https://auxedu.com'+route.route),html=await page.text();require(page.ok||route.route==='/404.html'&&page.status===404,'Live public page failed');
  require(!/href=["']\/portal/.test(html),'Public portal navigation returned');
  require(!html.includes('https://auxesis-education.pages.dev'),'Old public canonical reference');
 }
 for(const path of ['/api/portal/state','/api/reviews/manage']){
  const r=await fetch(origin+path,{redirect:'manual'});require(r.status===401,'Anonymous access protection changed: '+path);
 }
 const reviews=await fetch(origin+'/api/reviews');require(reviews.ok&&Array.isArray((await reviews.json()).reviews),'Native reviews unavailable');
 const live=await cf('/pages/projects/'+project);
 require(live.canonical_deployment?.deployment_trigger?.metadata?.commit_hash===process.env.GITHUB_SHA,'Unexpected production commit');
 require(JSON.stringify(live.deployment_configs)===b.config&&JSON.stringify(live.source)===b.source,'Production configuration changed');
 require(JSON.stringify(await businessDigest(b.db))===JSON.stringify(b.business),'Retained business records changed');
 console.log('::notice::Inquiry readiness verified on both domains; unrelated assets, native access boundaries, records and settings preserved. Prior end-to-end inbox receipt is retained; current provider integration is tested with mocked providers and live readiness without sending a duplicate enquiry.');
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
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))try{const action=process.argv[2];if(action==='prepare')await prepare();else if(action==='check')await check();else if(action==='verify')await verify();else if(action==='rollback')await rollback();else throw Error('Unknown release action');}catch(e){console.error('::error::'+e.message);process.exitCode=1;}
