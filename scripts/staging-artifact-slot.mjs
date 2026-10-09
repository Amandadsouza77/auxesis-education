// Private runtime-artifact slot. Public repository receives no runtime policy/data.
import {open} from '../cloudflare/crypto.js';
const account='2ac862d7c1f865935d185df59e7bd719',db='4f12fc1d-3e0d-4a11-bd65-e577ce906114';
const require=(ok,s)=>{if(!ok)throw new Error(s);};
async function cf(path,sql,params){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method:sql?'POST':'GET',redirect:'error',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},...(sql?{body:JSON.stringify({sql,...(params?{params}:{})})}:{})});require(r.ok,'Private artifact provider request failed: '+r.status);const j=await r.json();require(j.success,'Private artifact provider request rejected.');return j.result;}
async function prepare(){
 require(process.env.GITHUB_REPOSITORY==='Amandadsouza77/auxesis-education'&&process.env.GITHUB_REF==='refs/heads/codex/cloudflare-backend-migration','Unexpected artifact branch.');
 const live=await cf('/pages/projects/auxesis-education'),before=JSON.stringify({configs:live.deployment_configs,deployment:live.canonical_deployment?.id});
 const stage=await cf('/pages/projects/auxesis-production-staging'),vars=stage.deployment_configs.preview.env_vars;
 require(stage.deployment_configs.preview.d1_databases.PORTAL_DB.id===db&&vars.PRODUCTION_SYNC_ENABLED.value==='false'&&vars.PRODUCTION_AUTOMATION_ENABLED.value==='false','Unsafe private artifact target.');
 const query=async(sql,params)=>(await cf('/d1/database/'+db+'/query',sql,params)).flatMap(x=>x.results||[]);
 const settings=(await query("SELECT data FROM portal_records WHERE id='settings'"))[0];require(settings&&JSON.parse(settings.data).productionRelease?.dataMigrationVerified,'Durable import is not verified.');
 await query('CREATE TABLE IF NOT EXISTS migration_artifacts(id TEXT PRIMARY KEY,file_id TEXT NOT NULL,created_at TEXT NOT NULL)');
 if((await query("SELECT file_id FROM migration_artifacts WHERE id='staging-runtime'"))[0]){console.log('::notice::Private staging artifact slot already exists; no new file created.');return;}
 const grant=(await query("SELECT email,client_id,refresh_token_ciphertext FROM migration_google_authorization WHERE id='owner'"))[0],key=(await query("SELECT secret FROM portal_release_keys WHERE id='migration-transport'"))[0]?.secret;
 require(grant&&key&&grant.email===vars.ADMIN_EMAIL.value,'Verified owner grant unavailable.');
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:grant.client_id,client_secret:process.env.GOOGLE_CLIENT_SECRET,refresh_token:await open(key,grant.refresh_token_ciphertext)})});require(response.ok,'Private artifact authorization refresh failed.');const token=(await response.json()).access_token;
 const headers={Authorization:'Bearer '+token};const q="trashed=false and appProperties has {key='auxesisPurpose' and value='staging-runtime'}";
 const found=await fetch('https://www.googleapis.com/drive/v3/files?fields=files(id)&q='+encodeURIComponent(q),{headers,redirect:'error'});require(found.ok,'Private artifact lookup failed.');const files=(await found.json()).files||[];require(files.length<=1,'Several staging artifact slots found; no file selected.');let id=files[0]?.id;
 if(!id){const created=await fetch('https://www.googleapis.com/drive/v3/files?fields=id',{method:'POST',redirect:'error',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({name:'Auxesis private staging runtime package.tar.gz',mimeType:'application/gzip',appProperties:{auxesisPurpose:'staging-runtime'}})});require(created.ok,'Private artifact slot could not be created.');id=(await created.json()).id;}
 require(id,'Private artifact slot ID unavailable.');
 const metadata=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?fields=ownedByMe,shared,permissions',{headers,redirect:'error'});require(metadata.ok,'Private slot metadata unreadable.');const m=await metadata.json();require(m.ownedByMe===true&&m.shared!==true&&(m.permissions||[]).every(p=>p.type==='user'&&p.role==='owner'),'Artifact slot is not owner-only.');
 await query("INSERT INTO migration_artifacts(id,file_id,created_at) VALUES('staging-runtime',?1,CURRENT_TIMESTAMP) ON CONFLICT(id) DO NOTHING",[id]);
 const current=await cf('/pages/projects/auxesis-education');require(JSON.stringify({configs:current.deployment_configs,deployment:current.canonical_deployment?.id})===before,'Production changed.');
 console.log('::notice title=Private staging artifact slot prepared::'+JSON.stringify({privateOwnerOnly:true,slotPrepared:true,productionUnchanged:true,originalPortalKeyUntouched:true,synchronizationEnabled:false}));
}
prepare().catch(e=>{console.error('::error::'+e.message);process.exitCode=1;});
