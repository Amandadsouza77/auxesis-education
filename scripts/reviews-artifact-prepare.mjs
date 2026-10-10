// Generic protected deployment controller. Runtime source stays in private Drive.
import {writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {open} from '../cloudflare/crypto.js';
const account='2ac862d7c1f865935d185df59e7bd719',db='4f12fc1d-3e0d-4a11-bd65-e577ce906114',project='auxesis-production-staging',origin='https://migration-auth.auxesis-production-staging.pages.dev';
const expected='bccdaba4e8d4af564feddf7e72cb0648092c8ccef86c742db7fd658a89bc371e';
const require=(ok,s)=>{if(!ok)throw new Error(s);};
async function cf(path,sql,params,patch){const method=patch?'PATCH':sql?'POST':'GET';require(method==='GET'||sql&&path==='/d1/database/'+db+'/query'||patch&&path==='/pages/projects/'+project,'Deployment write outside isolated staging rejected.');const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method,redirect:'error',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},...(patch||sql?{body:JSON.stringify(patch||{sql,...(params?{params}:{})})}:{})});require(r.ok,'Staging deployment provider failed: '+r.status);const j=await r.json();require(j.success,'Staging deployment request rejected.');return j.result;}
async function prepare(){
 require(process.env.GITHUB_REPOSITORY==='Amandadsouza77/auxesis-education'&&process.env.GITHUB_REF==='refs/heads/codex/cloudflare-backend-migration','Unexpected staging deployment branch.');
 const live=await cf('/pages/projects/auxesis-education'),stage=await cf('/pages/projects/'+project),vars=stage.deployment_configs.preview.env_vars;
 require(!stage.source&&!stage.canonical_deployment&&stage.deployment_configs.preview.d1_databases.PORTAL_DB.id===db&&vars.PRODUCTION_SYNC_ENABLED.value==='false'&&vars.PRODUCTION_AUTOMATION_ENABLED.value==='false','Unsafe staging deployment target.');
 require(!Object.values(live.deployment_configs||{}).some(c=>Object.values(c.d1_databases||{}).some(b=>b.id===db)),'Staging database is bound to production.');
 const query=async(sql,p)=>(await cf('/d1/database/'+db+'/query',sql,p)).flatMap(x=>x.results||[]);
 const records=await query('SELECT * FROM portal_records ORDER BY id'),accounts=await query('SELECT * FROM portal_accounts ORDER BY id'),audits=await query('SELECT * FROM portal_audit ORDER BY id');
 require(records.length===371&&records.filter(r=>r.kind==='students').length===15&&accounts.length===1&&audits.length===5,'Preserved staging inventory differs from verified import.');
 require(JSON.parse(records.find(r=>r.id==='settings').data).productionRelease?.dataMigrationVerified,'Staging durable import not verified.');
 const artifact=(await query("SELECT file_id FROM migration_artifacts WHERE id='staging-runtime'"))[0],grant=(await query("SELECT email,client_id,refresh_token_ciphertext FROM migration_google_authorization WHERE id='owner'"))[0],key=(await query("SELECT secret FROM portal_release_keys WHERE id='migration-transport'"))[0]?.secret;
 require(artifact&&grant&&key&&grant.email===vars.ADMIN_EMAIL.value&&grant.client_id===vars.GOOGLE_CLIENT_ID.value,'Private artifact or owner consent unavailable.');
 const refresh=await fetch('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:grant.client_id,client_secret:process.env.GOOGLE_CLIENT_SECRET,refresh_token:await open(key,grant.refresh_token_ciphertext)})});require(refresh.ok,'Staging artifact authorization refresh failed.');const access=(await refresh.json()).access_token;
 const url='https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(artifact.file_id),headers={Authorization:'Bearer '+access};const metadata=await fetch(url+'?fields=ownedByMe,shared,permissions,size',{headers,redirect:'error'});require(metadata.ok,'Private runtime package metadata unavailable.');const m=await metadata.json();require(m.ownedByMe===true&&m.shared!==true&&(m.permissions||[]).every(p=>p.type==='user'&&p.role==='owner')&&Number(m.size)>0&&Number(m.size)<8*1024*1024,'Private runtime package privacy or bounded size failed.');
 const raw=await fetch(url+'?alt=media',{headers,redirect:'error'});require(raw.ok,'Private runtime package read failed.');const bytes=Buffer.from(await raw.arrayBuffer());require(createHash('sha256').update(bytes).digest('hex')===expected,'Private runtime package checksum mismatch.');
 mkdirSync('work/staging-deployment',{recursive:true});writeFileSync('work/staging-deployment/package.tar.gz',bytes,{mode:0o600});writeFileSync('work/staging-deployment/before.json',JSON.stringify({production:{configs:live.deployment_configs,deployment:live.canonical_deployment?.id},records,accounts,audits}),{mode:0o600});
 const extract=spawnSync('python3',['-c',`import tarfile,pathlib,json,hashlib
root=pathlib.Path('work/staging-deployment/runtime').resolve();root.mkdir(parents=True,exist_ok=True)
with tarfile.open('work/staging-deployment/package.tar.gz','r:gz') as archive:
 members=archive.getmembers()
 if len(members)>200 or sum(m.size for m in members)>32*1024*1024: raise ValueError('Package extraction exceeds bounds')
 for m in members:
  target=(root/m.name).resolve()
  if not m.isfile() or not target.is_relative_to(root) or not (m.name.startswith(('dist/','cloudflare/','tests/')) or m.name in ['staging-entry.js','deployment-manifest.json']):raise ValueError('Unsafe package entry')
  target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(archive.extractfile(m).read())
 manifest=json.loads((root/'deployment-manifest.json').read_text())
 if manifest['origin']!='${origin}' or manifest['databaseId']!='${db}' or manifest['apply'] or manifest['automation'] or manifest['cutover']:raise ValueError('Package release target mismatch')
 for path,digest in manifest['files'].items():
  if hashlib.sha256((root/path).read_bytes()).hexdigest()!=digest:raise ValueError('Extracted file checksum mismatch')
`],{encoding:'utf8'});require(extract.status===0,'Private runtime package extraction failed; details omitted.');
 await cf('/pages/projects/'+project,null,null,{deployment_configs:{preview:{env_vars:{PORTAL_STAGING_ONLY:{type:'plain_text',value:'true'},PORTAL_STAGING_ORIGIN:{type:'plain_text',value:origin},PRODUCTION_SYNC_ENABLED:{type:'plain_text',value:'false'},PRODUCTION_AUTOMATION_ENABLED:{type:'plain_text',value:'false'}},wrangler_config_hash:stage.deployment_configs.preview.wrangler_config_hash}}});
 const current=await cf('/pages/projects/auxesis-education');require(JSON.stringify({configs:current.deployment_configs,deployment:current.canonical_deployment?.id})===JSON.stringify({configs:live.deployment_configs,deployment:live.canonical_deployment?.id}),'Production changed during staging preparation.');
 console.log('::notice title=Private staging runtime prepared::'+JSON.stringify({packageChecksumVerified:true,privateTransport:true,preservedRecords:371,completeRoster:15,productionUnchanged:true,applyEnabled:false,automationEnabled:false}));
}
prepare().catch(e=>{console.error('::error::'+e.message);process.exitCode=1;});
