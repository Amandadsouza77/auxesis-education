// Read-only runtime recovery and validation. No provider writes or deployments.
import {writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {open} from '../cloudflare/crypto.js';
const account='2ac862d7c1f865935d185df59e7bd719',db='4f12fc1d-3e0d-4a11-bd65-e577ce906114',project='auxesis-production-staging',origin='https://migration-auth.auxesis-production-staging.pages.dev';
const expected='bccdaba4e8d4af564feddf7e72cb0648092c8ccef86c742db7fd658a89bc371e';
const require=(ok,s)=>{if(!ok)throw new Error(s);};
async function cf(path,sql){
 const allowed = ["SELECT file_id FROM migration_artifacts WHERE id='staging-runtime'", "SELECT email,client_id,refresh_token_ciphertext FROM migration_google_authorization WHERE id='owner'", "SELECT secret FROM portal_release_keys WHERE id='migration-transport'"];
 require(!sql && ['/pages/projects/auxesis-education','/pages/projects/'+project].includes(path) || allowed.includes(sql) && path==='/d1/database/'+db+'/query','Read-only recovery request rejected.');
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method:sql?'POST':'GET',redirect:'error',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},...(sql?{body:JSON.stringify({sql})}:{})});
 require(r.ok,'Runtime recovery provider HTTP '+r.status);const j=await r.json();require(j.success,'Runtime recovery request rejected.');return j.result;
}
async function prepare(){
 require(process.env.GITHUB_REPOSITORY==='Amandadsouza77/auxesis-education'&&process.env.GITHUB_REF==='refs/heads/codex/prelaunch-portal-copy-2026-10-27','Unexpected staging deployment branch.');
 const live=await cf('/pages/projects/auxesis-education'),stage=await cf('/pages/projects/'+project),vars=stage.deployment_configs.preview.env_vars;
 require(!stage.source&&!stage.canonical_deployment&&stage.deployment_configs.preview.d1_databases.PORTAL_DB.id===db&&vars.PRODUCTION_SYNC_ENABLED.value==='false'&&vars.PRODUCTION_AUTOMATION_ENABLED.value==='false','Unsafe staging deployment target.');
 require(!Object.values(live.deployment_configs||{}).some(c=>Object.values(c.d1_databases||{}).some(b=>b.id===db)),'Staging database is bound to production.');
 const query=async(sql,p)=>(await cf('/d1/database/'+db+'/query',sql,p)).flatMap(x=>x.results||[]);
 const artifact=(await query("SELECT file_id FROM migration_artifacts WHERE id='staging-runtime'"))[0],grant=(await query("SELECT email,client_id,refresh_token_ciphertext FROM migration_google_authorization WHERE id='owner'"))[0],key=(await query("SELECT secret FROM portal_release_keys WHERE id='migration-transport'"))[0]?.secret;
 require(artifact&&grant&&key&&grant.email===vars.ADMIN_EMAIL.value&&grant.client_id===vars.GOOGLE_CLIENT_ID.value,'Private artifact or owner consent unavailable.');
 const refresh=await fetch('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:grant.client_id,client_secret:process.env.GOOGLE_CLIENT_SECRET,refresh_token:await open(key,grant.refresh_token_ciphertext)})});require(refresh.ok,'Staging artifact authorization refresh failed.');const access=(await refresh.json()).access_token;
 const url='https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(artifact.file_id),headers={Authorization:'Bearer '+access};const metadata=await fetch(url+'?fields=ownedByMe,shared,permissions,size',{headers,redirect:'error'});require(metadata.ok,'Private runtime package metadata unavailable.');const m=await metadata.json();require(m.ownedByMe===true&&m.shared!==true&&(m.permissions||[]).every(p=>p.type==='user'&&p.role==='owner')&&Number(m.size)>0&&Number(m.size)<8*1024*1024,'Private runtime package privacy or bounded size failed.');
 const raw=await fetch(url+'?alt=media',{headers,redirect:'error'});require(raw.ok,'Private runtime package read failed.');const bytes=Buffer.from(await raw.arrayBuffer());require(createHash('sha256').update(bytes).digest('hex')===expected,'Private runtime package checksum mismatch.');
 mkdirSync('work/staging-deployment',{recursive:true});writeFileSync('work/staging-deployment/package.tar.gz',bytes,{mode:0o600});
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
 const current=await cf('/pages/projects/auxesis-education');require(JSON.stringify({configs:current.deployment_configs,deployment:current.canonical_deployment?.id})===JSON.stringify({configs:live.deployment_configs,deployment:live.canonical_deployment?.id}),'Production changed during staging preparation.');
 console.log('::notice title=Private runtime recovered without deployment::'+JSON.stringify({packageChecksumVerified:true,privateTransport:true,productionUnchanged:true,providerWrites:0}));
}
prepare().catch(e=>{console.error('::error::'+e.message);process.exitCode=1;});
