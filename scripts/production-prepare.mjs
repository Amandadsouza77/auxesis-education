// Protected runner only. Prepare independent resources; never deploy an app or
// change the live project. Credentials, OAuth tokens and records are not logged.
import {randomBytes,webcrypto} from 'node:crypto';
import {appendFileSync} from 'node:fs';
import {releaseKey} from './production-envelope.mjs';

const account='2ac862d7c1f865935d185df59e7bd719',pilotDb='34a9449d-85ee-4f06-a55d-3485905ca64e',staging='auxesis-production-staging',databaseName='auxesis-production';
const origin='https://auxesis-education.pages.dev',callback=origin+'/api/portal/auth/callback';
const require=(ok,message)=>{if(!ok)throw new Error(message);};
const base='https://api.cloudflare.com/client/v4/accounts/'+account;
async function cf(path,method='GET',body){
 const writes=method==='POST'&&path==='/d1/database'&&body?.name===databaseName||method==='POST'&&path==='/pages/projects'&&body?.name===staging;
 const read=method==='POST'&&path==='/d1/database/'+pilotDb+'/query'&&body?.sql==="SELECT account_id,email,refresh_token_ciphertext,scopes FROM google_connections WHERE lower(email)='adsouza35@gmail.com'";
 require(method==='GET'||writes||read,'Preparation rejected a write outside isolated resources.');
 const response=await fetch(base+path,{method,redirect:'error',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 if(response.status===404&&method==='GET')return null;
 require(response.ok,'Cloudflare preparation failed: HTTP '+response.status+'. Provider response omitted.');
 const data=await response.json();require(data.success===true,'Cloudflare preparation was rejected. Provider response omitted.');return data.result;
}
async function open(secret,ciphertext){
 const hash=await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)),key=await webcrypto.subtle.importKey('raw',hash,'AES-GCM',false,['decrypt']);
 const parts=ciphertext.split('.');require(parts.length===2,'Stored Google connection cannot be decoded.');
 return new TextDecoder().decode(await webcrypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(parts[0],'base64url')},key,Buffer.from(parts[1],'base64url')));
}
function liveFingerprint(project){return JSON.stringify({configs:project.deployment_configs,source:project.source,productionBranch:project.production_branch,deployment:project.canonical_deployment?.id});}
function plain(value){return {type:'plain_text',value};}
function secret(value){return {type:'secret_text',value};}
export async function prepare(){
 require(process.env.GITHUB_REPOSITORY==='Amandadsouza77/auxesis-education'&&process.env.GITHUB_REF==='refs/heads/codex/auxesis-production-preparation','Unexpected preparation branch or repository.');
 require(process.env.CLOUDFLARE_API_TOKEN,'Protected Cloudflare credential is missing.');
 const live=await cf('/pages/projects/auxesis-education'),before=liveFingerprint(live);require(live?.production_branch==='main','Unexpected production branch.');
 const pilot=await cf('/pages/projects/auxesis-migration-preview'),preview=pilot?.deployment_configs?.preview;
 require(preview?.d1_databases?.PORTAL_DB?.id===pilotDb,'Pilot identity changed.');
 const old=preview.env_vars||{};
 const requiredKeys=['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_API_KEY','GOOGLE_APP_ID','PORTAL_TOKEN_KEY'];
 for(const k of requiredKeys)require(old[k]?.value||process.env[k],'Google configuration is opaque or missing: '+k+'.');
 let project=await cf('/pages/projects/'+staging),db;
 if(project){
  require(!project.source&&!project.canonical_deployment,'Staging unexpectedly has an active app.');
  const id=project.deployment_configs?.preview?.d1_databases?.PORTAL_DB?.id;
  require(id&&id!==pilotDb,'Production staging has an unsafe database binding.');db=await cf('/d1/database/'+id);require(db?.name===databaseName,'Production database identity mismatch.');
 }else{
  const databases=await cf('/d1/database');db=databases.find(d=>d.name===databaseName)||await cf('/d1/database','POST',{name:databaseName});
  const id=db.uuid;require(id&&id!==pilotDb,'Production database must differ from the pilot.');
  require(!Object.values(live.deployment_configs||{}).some(c=>Object.values(c.d1_databases||{}).some(b=>b.id===id)),'Production database is already live; preparation stopped.');
  const variables={PORTAL_RUNTIME_MODE:plain('production'),PRODUCTION_ORIGIN:plain(origin),PORTAL_DB_ID:plain(id),ADMIN_EMAIL:plain('adsouza35@gmail.com'),GOOGLE_SPREADSHEET_ID:plain('1UrdpPD4AWU1H1Ok7Txb-sL1hIXoIEVN8u--8fZqXwUQ'),GOOGLE_CALENDAR_ID:plain('classroom107924035776692772286@group.calendar.google.com'),PRODUCTION_SYNC_ENABLED:plain('false'),PRODUCTION_AUTOMATION_ENABLED:plain('false'),PORTAL_TOKEN_KEY:secret(randomBytes(48).toString('base64url'))};
  for(const k of requiredKeys.filter(k=>k!=='PORTAL_TOKEN_KEY'))variables[k]=secret(process.env[k]||old[k].value);
  project=await cf('/pages/projects','POST',{name:staging,production_branch:'main',deployment_configs:{preview:{compatibility_date:'2026-10-08',d1_databases:{PORTAL_DB:{id}},env_vars:variables},production:{env_vars:{},d1_databases:{}}}});
  project=await cf('/pages/projects/'+staging);
 }
 const vars=project.deployment_configs?.preview?.env_vars||{},newKey=vars.PORTAL_TOKEN_KEY?.value;
 require(newKey&&newKey.length>=40,'Production encryption key is opaque; do not replace it.');
 require(vars.PRODUCTION_SYNC_ENABLED?.value==='false'&&vars.PRODUCTION_AUTOMATION_ENABLED?.value==='false','Staging synchronization must stay disabled.');
 const rows=await cf('/d1/database/'+pilotDb+'/query','POST',{sql:"SELECT account_id,email,refresh_token_ciphertext,scopes FROM google_connections WHERE lower(email)='adsouza35@gmail.com'"});
 const connections=rows.flatMap(r=>r.results||[]);require(connections.length===1,'The existing administrator connection is not unique.');
 const scopes=new Set(connections[0].scopes.split(/\s+/));require(scopes.has('https://www.googleapis.com/auth/calendar.readonly')&&scopes.has('https://www.googleapis.com/auth/drive.file'),'Existing Google grant lacks approved read scopes.');
 const refreshToken=await open(old.PORTAL_TOKEN_KEY.value,connections[0].refresh_token_ciphertext);
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:vars.GOOGLE_CLIENT_ID.value,client_secret:vars.GOOGLE_CLIENT_SECRET.value,grant_type:'refresh_token',refresh_token:refreshToken})});
 require(response.ok,'Existing Google grant cannot be refreshed. Owner Google authorization is required.');
 const access=(await response.json()).access_token;require(access,'Google refresh did not return usable access.');
 const sourceUrls=[['tracker','https://sheets.googleapis.com/v4/spreadsheets/'+vars.GOOGLE_SPREADSHEET_ID.value+'/values/'+encodeURIComponent('Students!A1:AD1000')],['calendar','https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(vars.GOOGLE_CALENDAR_ID.value)+'/events?maxResults=1&timeMin=2026-10-01T00%3A00%3A00-04%3A00&singleEvents=true']];
 for(const [kind,url] of sourceUrls){const r=await fetch(url,{redirect:'error',headers:{Authorization:'Bearer '+access}});require(r.ok,'Existing grant cannot read the production '+kind+'. Owner source access is required.');const data=await r.json();require(kind==='tracker'?Array.isArray(data.values):Array.isArray(data.items),'Production '+kind+' source returned an incomplete read.');}
 require(liveFingerprint(await cf('/pages/projects/auxesis-education'))===before,'Live project changed during preparation.');
 const result={databaseId:db.uuid,stagingProject:staging,releasePublicKey:releaseKey(newKey).publicKey,googleGrantReadAccess:true,productionCallback:callback,googleClientId:vars.GOOGLE_CLIENT_ID.value,appDeployed:false,synchronizationActivated:false,liveProjectUnchanged:true};
 console.log('::notice title=Auxesis production preparation::'+JSON.stringify(result));
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,'Production database prepared separately. Existing Google grant reads Tracker and Calendar. No application deployed; automation and Apply remain disabled.\n');
 return result;
}
if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1])prepare().catch(error=>{console.error('::error title=Auxesis production preparation::'+error.message);process.exitCode=1;});
