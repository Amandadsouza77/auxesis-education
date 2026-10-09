import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const account='2ac862d7c1f865935d185df59e7bd719',project='auxesis-production-staging',db='4f12fc1d-3e0d-4a11-bd65-e577ce906114';
const require=(ok,s)=>{if(!ok)throw new Error(s);};
const expected='https://migration-auth.auxesis-production-staging.pages.dev';
async function cf(path,method='GET',body){
 require(method==='GET'||method==='PATCH'&&path==='/pages/projects/'+project||method==='POST'&&path==='/d1/database/'+db+'/query','Write outside isolated staging rejected.');
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method,redirect:'error',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});require(r.ok,'Staging authorization provider request failed: '+r.status);const j=await r.json();require(j.success,'Staging authorization provider rejected request.');return j.result;
}
async function run(){
 require(process.env.GITHUB_REPOSITORY==='Amandadsouza77/auxesis-education'&&process.env.GITHUB_REF==='refs/heads/codex/cloudflare-backend-migration','Unexpected authorization preparation branch.');
 require(process.env.CLOUDFLARE_API_TOKEN&&process.env.GOOGLE_CLIENT_SECRET,'Protected existing credentials unavailable.');
 const live=await cf('/pages/projects/auxesis-education');const before=JSON.stringify({deployment:live.canonical_deployment?.id,configs:live.deployment_configs});
 const stage=await cf('/pages/projects/'+project),vars=stage.deployment_configs?.preview?.env_vars;
 require(!stage.source&&!stage.canonical_deployment&&stage.deployment_configs.preview.d1_databases.PORTAL_DB.id===db&&vars.PORTAL_DB_ID.value===db&&vars.PRODUCTION_SYNC_ENABLED.value==='false'&&vars.PRODUCTION_AUTOMATION_ENABLED.value==='false','Unsafe authorization target.');
 const clientId=process.env.GOOGLE_CLIENT_ID||vars.GOOGLE_CLIENT_ID?.value||(await cf('/pages/projects/auxesis-migration-preview')).deployment_configs?.preview?.env_vars?.GOOGLE_CLIENT_ID?.value;
 require(clientId==='170955000028-cojekae97i6rnl4v8u1tefdehhtmeife.apps.googleusercontent.com'&&vars.PORTAL_TOKEN_KEY&&vars.ADMIN_EMAIL?.value,'Existing staging identity or key binding unavailable.');
 require(!Object.values(live.deployment_configs||{}).some(c=>Object.values(c.d1_databases||{}).some(b=>b.id===db)),'Staging database is already bound to production.');
 for(const sql of readFileSync('scripts/staging-authorization/schema.sql','utf8').split(';').filter(s=>s.trim()))await cf('/d1/database/'+db+'/query','POST',{sql});
 // Same additive operation used by official Wrangler Pages secret put.
 if(!vars.GOOGLE_CLIENT_SECRET||vars.GOOGLE_CLIENT_ID?.value!==clientId)await cf('/pages/projects/'+project,'PATCH',{deployment_configs:{preview:{env_vars:{GOOGLE_CLIENT_ID:{type:'plain_text',value:clientId},GOOGLE_CLIENT_SECRET:{type:'secret_text',value:process.env.GOOGLE_CLIENT_SECRET}},wrangler_config_hash:stage.deployment_configs.preview.wrangler_config_hash}}});
 const after=await cf('/pages/projects/'+project);require(after.deployment_configs.preview.env_vars.PORTAL_TOKEN_KEY&&after.deployment_configs.preview.env_vars.GOOGLE_CLIENT_SECRET&&after.deployment_configs.preview.d1_databases.PORTAL_DB.id===db,'Staging binding verification failed.');
 const current=await cf('/pages/projects/auxesis-education');require(JSON.stringify({deployment:current.canonical_deployment?.id,configs:current.deployment_configs})===before,'Production changed during preparation.');
 mkdirSync('work/staging-auth/site',{recursive:true});writeFileSync('work/staging-auth/site/index.html','<!doctype html><title>Auxesis staging authorization</title><p>Staging authorization service.</p>');writeFileSync('work/staging-auth/production-before.json',before,{mode:0o600});
 console.log('::notice title=Staging consent prepared::'+JSON.stringify({separateConsent:true,originalPortalKeyUntouched:true,synchronizationEnabled:false,expectedOrigin:expected,callback:expected+'/api/portal/auth/callback'}));
}
run().catch(e=>{console.error('::error::'+e.message);process.exitCode=1;});
