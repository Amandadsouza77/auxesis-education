// Remove public portal links only. Retain the native Worker, private assets and data.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
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
  const portalBaseline={};
  for(const host of ['https://auxesis-education.pages.dev','https://auxedu.com']){const r=await fetch(host+'/portal/',{redirect:'manual',headers:{'Cache-Control':'no-cache'}});portalBaseline[host]={status:r.status,hash:sha(Buffer.from(await r.arrayBuffer()))};}
  const saved={worker,removed,portalBaseline,changes:changes.map(({content,...rest})=>rest)};
  writeFileSync(checkpoint,JSON.stringify(saved),{mode:0o600});
  for(const change of changes){writeFileSync(resolve(root,change.path),change.content);state.publicFiles[change.url]=change.after;}
  writeFileSync(baseline,JSON.stringify(state),{mode:0o600});
  require(sha(readFileSync(resolve(root,'_worker.js')))===worker,'Native Worker changed during link removal');
  console.log('::notice::'+JSON.stringify({publicPagesChanged:changes.length,portalLinksRemoved:removed,workerUnchanged:true,privateFilesChanged:0,recordWrites:0}));
 }else if(process.argv[2]==='verify'){
  const saved=JSON.parse(readFileSync(checkpoint));
  require(sha(readFileSync(resolve(root,'_worker.js')))===saved.worker,'Native Worker differs from pre-patch build');
  let transformedCustomPages=0;
  for(const host of ['https://auxesis-education.pages.dev','https://auxedu.com']){
   for(const route of routes){
    let current,valid=false;
    const change=saved.changes.find(c=>c.path===route.path);
    for(let attempt=0;attempt<12;attempt++){
     current=await body(host,route.route);
     // The custom domain can apply zone-level HTML transformations; byte-exact
     // source checks belong on the deployment hostname. Both must omit the links.
     valid=!anchors.test(current.toString())&&current.toString().includes('<main')&&
       (host!=='https://auxesis-education.pages.dev'||!change||sha(current)===change.after);
     if(valid)break;
     await new Promise(resolve=>setTimeout(resolve,3000));
    }
    require(valid,'Public navigation/content verification failed: '+host+route.route);
    if(host==='https://auxedu.com'&&change&&sha(current)!==change.after){transformedCustomPages++;console.log('::notice::'+JSON.stringify({customDomainHtmlDiffers:true,path:route.route,emailObfuscation:current.toString().includes('__cf_email__'),portalLinksAbsent:true}));}
   }
   const portal=await fetch(host+'/portal/',{redirect:'manual',headers:{'Cache-Control':'no-cache'}}),bytes=Buffer.from(await portal.arrayBuffer());
   require(portal.status===saved.portalBaseline[host].status,'Retained portal response status changed');
   if(host==='https://auxesis-education.pages.dev')require(sha(bytes)===saved.portalBaseline[host].hash,'Retained portal HTML changed');
  }
  console.log('::notice::'+JSON.stringify({customDomainTransformedPages:transformedCustomPages,portalResponseStatusesPreserved:true}));
  console.log('::notice::Public portal links removed on every public page at both domains; exact edited HTML verified; portal entry retained. Inquiry readiness, unrelated assets, private access boundaries, settings and data are checked separately by the native release verifier.');
 }else if(process.argv[2]==='verify-native'){
  let last;
  for(let attempt=0;attempt<12;attempt++){
   last=spawnSync(process.execPath,['scripts/inquiry-release.mjs','verify'],{encoding:'utf8',maxBuffer:1024*1024});
   if(last.status===0){process.stdout.write(last.stdout);break;}
   // Allow the deployment alias/static edge cache to converge. Settings, access
   // or record-fingerprint failures are not retried or hidden.
   if(!last.stdout.includes('Unrelated public asset changed:')){process.stdout.write(last.stdout);process.stderr.write(last.stderr);throw Error('Native preservation verification failed');}
   if(attempt===11){process.stdout.write(last.stdout);throw Error('Static deployment propagation did not converge');}
   await new Promise(resolve=>setTimeout(resolve,3000));
  }
 }else throw Error('Unknown portal navigation action');
}catch(e){console.error('::error::'+e.message);process.exitCode=1;}
