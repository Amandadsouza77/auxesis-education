// Prepare/verify only the isolated owner-consent preview. No database writes.
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
const account='2ac862d7c1f865935d185df59e7bd719',project='auxesis-production-staging',db='4f12fc1d-3e0d-4a11-bd65-e577ce906114';
const get=async p=>{const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+p,{headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN},redirect:'error'});if(!r.ok)throw Error('Consent preflight provider HTTP '+r.status);const d=await r.json();if(!d.success)throw Error('Consent preflight rejected');return d.result;};
const snapshot=p=>JSON.stringify({config:p.deployment_configs,source:p.source,production:p.canonical_deployment?.id});
try{
 const live=await get('/pages/projects/auxesis-education'),stage=await get('/pages/projects/'+project),c=stage.deployment_configs.preview,v=c.env_vars;
 if(stage.source||stage.canonical_deployment||c.d1_databases.PORTAL_DB.id!==db||v.PRODUCTION_SYNC_ENABLED.value!=='false'||v.PRODUCTION_AUTOMATION_ENABLED.value!=='false'||!v.GOOGLE_CLIENT_ID||!v.GOOGLE_CLIENT_SECRET||!v.ADMIN_EMAIL)throw Error('Consent staging isolation/configuration mismatch');
 if(Object.values(live.deployment_configs).some(c=>Object.values(c.d1_databases||{}).some(x=>x.id===db)))throw Error('Shared production database rejected');
 if(process.argv[2]==='prepare'){
  mkdirSync('work/inquiry-consent/site',{recursive:true});writeFileSync('work/inquiry-consent/before.json',JSON.stringify({live:snapshot(live),stage:JSON.stringify(stage.deployment_configs)}),{mode:0o600});
  writeFileSync('work/inquiry-consent/site/index.html','<!doctype html><title>Auxesis package authorization</title>Owner Google authorization.');
  console.log('::notice::Isolated consent preview preflight passed; no settings, database records or production deployment changed.');
 }else if(process.argv[2]==='verify'){
  const before=JSON.parse(readFileSync('work/inquiry-consent/before.json'));
  if(before.live!==snapshot(live)||before.stage!==JSON.stringify(stage.deployment_configs))throw Error('Unexpected settings or production change');
  const origin='https://migration-auth.auxesis-production-staging.pages.dev';
  const r=await fetch(origin,{redirect:'error'}),html=await r.text();if(!r.ok||!html.includes('Continue with Google')||!html.includes('inquiry-form repair'))throw Error('Owner consent page not yet visible');
  console.log('::notice::Owner sign-in ready at '+origin+'; production and all account settings unchanged.');
 }else throw Error('Unknown action');
}catch(e){console.error('::error::'+e.message);process.exitCode=1;}
