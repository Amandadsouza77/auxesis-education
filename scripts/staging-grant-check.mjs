// Protected runner: verify the new consent independently of recovery variables.
import {open} from '../cloudflare/crypto.js';
const account='2ac862d7c1f865935d185df59e7bd719',db='4f12fc1d-3e0d-4a11-bd65-e577ce906114';
const require=(ok,message)=>{if(!ok)throw new Error(message);};
async function cf(path,sql){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method:sql?'POST':'GET',redirect:'error',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},...(sql?{body:JSON.stringify({sql})}:{})});require(r.ok,'Staging verification provider request failed: '+r.status);const j=await r.json();require(j.success,'Staging verification provider rejected request.');return j.result;}
async function check(){
 require(process.env.GITHUB_REPOSITORY==='Amandadsouza77/auxesis-education'&&process.env.GITHUB_REF==='refs/heads/codex/cloudflare-backend-migration','Unexpected verification branch.');
 require(process.env.CLOUDFLARE_API_TOKEN&&process.env.GOOGLE_CLIENT_SECRET,'Protected credentials unavailable.');
 const live=await cf('/pages/projects/auxesis-education');const before=JSON.stringify({deployment:live.canonical_deployment?.id,configs:live.deployment_configs});
 const stage=await cf('/pages/projects/auxesis-production-staging');const vars=stage.deployment_configs.preview.env_vars;
 require(stage.deployment_configs.preview.d1_databases.PORTAL_DB.id===db&&vars.PRODUCTION_SYNC_ENABLED.value==='false'&&vars.PRODUCTION_AUTOMATION_ENABLED.value==='false','Unsafe staging verification target.');
 const query=async sql=>(await cf('/d1/database/'+db+'/query',sql)).flatMap(x=>x.results||[]);
 const grant=(await query("SELECT email,refresh_token_ciphertext,scopes,client_id FROM migration_google_authorization WHERE id='owner'"))[0];
 require(grant&&grant.email===vars.ADMIN_EMAIL.value&&grant.client_id===vars.GOOGLE_CLIENT_ID.value,'Owner staging authorization is missing or has a different identity.');
 const key=(await query("SELECT secret FROM portal_release_keys WHERE id='migration-transport'"))[0]?.secret;require(key,'Private migration key unavailable.');
 const refresh=await fetch('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:grant.client_id,client_secret:process.env.GOOGLE_CLIENT_SECRET,refresh_token:await open(key,grant.refresh_token_ciphertext)})});
 require(refresh.ok,'Saved staging Google consent cannot refresh: HTTP '+refresh.status);const token=(await refresh.json()).access_token;require(token,'Google access token unavailable.');
 const urls=[['Tracker','https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(vars.GOOGLE_SPREADSHEET_ID.value)+'/values/'+encodeURIComponent('Students!A1:AD1000')],['Calendar','https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(vars.GOOGLE_CALENDAR_ID.value)+'/events?maxResults=1&singleEvents=true&timeMin=2026-10-01T00%3A00%3A00-04%3A00']];
 for(const [kind,url] of urls){const r=await fetch(url,{redirect:'error',headers:{Authorization:'Bearer '+token}});require(r.ok,'Saved staging consent cannot read '+kind+': HTTP '+r.status);const j=await r.json();require(kind==='Tracker'?Array.isArray(j.values):Array.isArray(j.items),'Incomplete source response.');}
 const latest=await cf('/pages/projects/auxesis-education');require(JSON.stringify({deployment:latest.canonical_deployment?.id,configs:latest.deployment_configs})===before,'Production changed during verification.');
 console.log('::notice title=Staging Google consent verified::'+JSON.stringify({ownerConsentSaved:true,tokenRefreshVerified:true,trackerReadVerified:true,calendarReadVerified:true,sourceRequestsReadOnly:true,originalPortalKeyUntouched:true,productionUnchanged:true,synchronizationEnabled:false}));
}
check().catch(e=>{console.error('::error title=Staging authorization verification::'+e.message);process.exitCode=1;});
