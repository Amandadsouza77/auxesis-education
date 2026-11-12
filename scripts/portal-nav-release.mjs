// Remove public portal links only. Retain the native Worker, private assets and data.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve('work/staging-deployment/runtime/dist');
const baseline='work/inquiry-release.json',checkpoint='work/portal-nav-change.json';
const sha=b=>createHash('sha256').update(b).digest('hex');
const routes=JSON.parse(readFileSync('templates/routes.json','utf8'));
const publicFiles=new Set(['404.html','index.html','about-amanda/index.html','about-auxesis/index.html','enquire/index.html','faq/index.html','how-tutoring-works/index.html','privacy-consent/index.html','recommendations/index.html','subjects-programmes/index.html','tutoring-policies/index.html']);
const anchors=/<a\b[^>]*\bhref\s*=\s*(["'])(?:(?:https:\/\/(?:auxedu\.com|auxesis-education\.pages\.dev))?\/portal(?:[/?#][^"']*)?)\1[^>]*>[\s\S]*?<\/a\s*>/gi;
const require=(v,m)=>{if(!v)throw Error(m);};
async function body(host,path){let url=host+path,r;for(let i=0;i<4;i++){r=await fetch(url,{redirect:'manual',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(30000)});if(![301,302,303,307,308].includes(r.status))break;const next=new URL(r.headers.get('Location'),url);require(next.origin===host,'Unexpected public-page redirect');url=next.href;}require(r.ok||path==='/404.html'&&r.status===404,'Public-page verification HTTP '+r.status);return Buffer.from(await r.arrayBuffer());}
try{
 if(process.argv[2]==='prepare'){
  const state=JSON.parse(readFileSync(baseline)),worker=sha(readFileSync(resolve(root,'_worker.js'))),changes=[];let removed=0;
  require(routes.length===publicFiles.size&&routes.every(r=>publicFiles.has(r.path)),'Public-page allowlist differs; stop before patching');
  // Stage all edits only after every public page has passed the baseline guards.
  for(const route of routes){
   const path=resolve(root,route.path),before=readFileSync(path,'utf8');let count=0;
   const after=before.replace(anchors,()=>{count++;return '';});
   require(!anchors.test(after),'A public portal link remains');
   if(count){changes.push({path:route.path,url:route.route,before:sha(before),after:sha(after),count,content:after});removed+=count;}
  }
  require(removed>0,'No portal navigation links found; stop rather than redeploy unnecessarily');
  const saved={worker,removed,changes:changes.map(({content,...rest})=>rest)};
  writeFileSync(checkpoint,JSON.stringify(saved),{mode:0o600});
  for(const change of changes){writeFileSync(resolve(root,change.path),change.content);state.publicFiles[change.url]=change.after;}
  writeFileSync(baseline,JSON.stringify(state),{mode:0o600});
  require(sha(readFileSync(resolve(root,'_worker.js')))===worker,'Native Worker changed during link removal');
  console.log('::notice::'+JSON.stringify({publicPagesChanged:changes.length,portalLinksRemoved:removed,workerUnchanged:true,privateFilesChanged:0,recordWrites:0}));
 }else if(process.argv[2]==='verify'){
  const saved=JSON.parse(readFileSync(checkpoint));
  require(sha(readFileSync(resolve(root,'_worker.js')))===saved.worker,'Native Worker differs from pre-patch build');
  for(const host of ['https://auxesis-education.pages.dev','https://auxedu.com']){
   for(const route of routes){const current=await body(host,route.route);require(!anchors.test(current.toString()),'Portal link remains on '+host+route.route);const change=saved.changes.find(c=>c.path===route.path);if(change)require(sha(current)===change.after,'Public-page content differs from the exact approved link removal');}
   const portal=await body(host,'/portal/');require(portal.length>0,'Retained portal entry is unavailable');
  }
  console.log('::notice::Public portal links removed on every public page at both domains; exact edited HTML verified; portal entry retained. Inquiry readiness, unrelated assets, private access boundaries, settings and data are checked separately by the native release verifier.');
 }else throw Error('Unknown portal navigation action');
}catch(e){console.error('::error::'+e.message);process.exitCode=1;}
