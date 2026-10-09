// Controlled migration into an UNPUBLISHED, separately provisioned database.
// Recovery transport stays in private Drive. The private key stays in protected D1.
import {readFileSync,appendFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decryptRelease} from './production-envelope.mjs';
import {open} from '../cloudflare/crypto.js';
const account='2ac862d7c1f865935d185df59e7bd719',staging='auxesis-production-staging',pilotDb='34a9449d-85ee-4f06-a55d-3485905ca64e';
const expectedBackup='5cadd30dabe9b69e296d961aec8fe620b0f49bba8e06b7df22d9d03a74c78bb3';
const require=(ok,message)=>{if(!ok)throw new Error(message);};
const canonical=v=>JSON.stringify(v&&typeof v==='object'?Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v);
export function validateSnapshot(snapshot){
 require(snapshot.records.length===371&&new Set(snapshot.records.map(r=>r.id)).size===371,'Expected 371 unique preserved source records.');
 const counts=Object.fromEntries([...new Set(snapshot.records.map(r=>r.kind))].map(k=>[k,snapshot.records.filter(r=>r.kind===k).length]));
 require(counts.students===15&&counts.lessons===200&&counts.invoices===16&&counts.payments===9,'Preserved roster or financial inventory differs from the approved baseline.');
 require(snapshot.tables.portal_accounts.length===1&&snapshot.tables.portal_audit.length===5&&!snapshot.tables.portal_files.length&&!snapshot.tables.portal_operations.length,'Durable auxiliary inventory differs from the approved baseline.');
 for(const r of snapshot.records)require(r.id&&r.data?.id===r.id&&Number.isInteger(r.revision)&&r.revision>=1&&r.updated_at,'Source record identity, revision or timestamp is invalid.');
 return counts;
}
export function validateExisting(snapshot,existing){
 const expected=new Map(snapshot.records.map(r=>[r.id,r]));
 for(const r of existing){const old=expected.get(r.id);require(old,'Target contains an unexpected record; no overwrite permitted.');
  const data=typeof r.data==='string'?JSON.parse(r.data):structuredClone(r.data);
  if(r.id==='settings'){delete data.productionSyncConfig;delete data.productionRelease;}
  require(r.kind===old.kind&&r.student_id===old.student_id&&r.parent_id===old.parent_id&&r.updated_at===old.updated_at&&canonical(data)===canonical(old.data)&&(r.revision===old.revision||r.id==='settings'&&r.revision===old.revision+1),'Target record differs from the backup; no overwrite permitted.');
 }
}
async function api(path,method='GET',body){
 require(method==='GET'||path===`/d1/database/${target}/query`,'Migration write outside the isolated database was rejected.');
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method,redirect:'error',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 require(response.ok,'Production import provider request failed: HTTP '+response.status+'. Details omitted.');const data=await response.json();require(data.success,'Production import was rejected. Details omitted.');return data.result;
}
let target;
const query=async(sql,params)=>{const r=await api(`/d1/database/${target}/query`,'POST',{sql,...(params?{params}:{})});return r.flatMap(x=>x.results||[]);};
export async function importProduction(){
 require(process.env.GITHUB_REPOSITORY==='Amandadsouza77/auxesis-education'&&process.env.GITHUB_REF==='refs/heads/codex/cloudflare-backend-migration','Unexpected migration repository or branch.');
 require(process.env.CLOUDFLARE_API_TOKEN,'Protected Cloudflare credential is missing.');
 const live=await api('/pages/projects/auxesis-education'),before=canonical({configs:live.deployment_configs,deployment:live.canonical_deployment?.id});
 const project=await api('/pages/projects/'+staging),config=project.deployment_configs?.preview;
 require(!project.source&&!project.canonical_deployment&&config?.env_vars?.PRODUCTION_SYNC_ENABLED?.value==='false','Import target must remain unpublished with synchronization disabled.');
 target=config.d1_databases?.PORTAL_DB?.id;require(target&&target!==pilotDb,'Unsafe target database.');
 require(!Object.values(live.deployment_configs||{}).some(c=>Object.values(c.d1_databases||{}).some(b=>b.id===target)),'Migration target is already live; import stopped.');
 const transport=(await query("SELECT secret FROM portal_release_keys WHERE id='migration-transport'"))[0]?.secret;require(transport,'Protected transport key is absent.');
 let encryptedBytes;
 if(process.env.AUXESIS_LOCAL_IMPORT_FIXTURE==='true'){
  // Used exclusively by the intercepted local fixture; the protected workflow
  // never enables this path or reads a recovery package from public GitHub.
  encryptedBytes=readFileSync('releases/production-baseline.enc.json');
 }else{
  require(process.env.PRODUCTION_RECOVERY_DRIVE_FILE_ID,'Private recovery-package Drive file ID is required.');
  require(process.env.GOOGLE_CLIENT_SECRET,'Protected Google client secret is required to read the private recovery package.');
  // Fresh, owner-verified staging consent is encrypted with the independent
  // private migration key. The original Portal key is never read or changed.
  const tables=await query("SELECT name FROM sqlite_master WHERE type='table' AND name='migration_google_authorization'");
  require(tables.length===1,'Open the isolated staging authorization page and complete owner Google consent.');
  const grant=(await query("SELECT email,refresh_token_ciphertext,scopes,client_id FROM migration_google_authorization WHERE id='owner'"))[0];
  require(grant&&grant.email===config.env_vars.ADMIN_EMAIL.value&&grant.client_id===config.env_vars.GOOGLE_CLIENT_ID.value,'Verified owner staging Google consent is required.');
  const scopes=new Set(grant.scopes.split(/\s+/));
  require(scopes.has('https://www.googleapis.com/auth/drive.file')&&scopes.has('https://www.googleapis.com/auth/calendar.readonly'),'Staging consent lacks approved read scopes.');
  const refreshToken=await open(transport,grant.refresh_token_ciphertext);
  const refreshed=await fetch('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:grant.client_id,client_secret:process.env.GOOGLE_CLIENT_SECRET,refresh_token:refreshToken})});
  require(refreshed.ok,'Fresh staging Google authorization could not refresh; owner consent requires diagnosis.');
  const access=(await refreshed.json()).access_token;require(access,'Google returned no usable access token.');
  // Verify existing source access with GET only, before durable import writes.
  const sourceUrls=[['Tracker','https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(config.env_vars.GOOGLE_SPREADSHEET_ID.value)+'/values/'+encodeURIComponent('Students!A1:AD1000')],['Calendar','https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(config.env_vars.GOOGLE_CALENDAR_ID.value)+'/events?maxResults=1&singleEvents=true&timeMin=2026-10-01T00%3A00%3A00-04%3A00']];
  for(const [kind,url] of sourceUrls){const response=await fetch(url,{headers:{Authorization:'Bearer '+access},redirect:'error'});require(response.ok,'Fresh staging consent cannot read '+kind+': HTTP '+response.status+'.');const body=await response.json();require(kind==='Tracker'?Array.isArray(body.values):Array.isArray(body.items),'Source read returned incomplete data.');}
  const driveBase='https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(process.env.PRODUCTION_RECOVERY_DRIVE_FILE_ID),headers={Authorization:'Bearer '+access};
  const metadataResponse=await fetch(driveBase+'?fields=id,size,mimeType,ownedByMe,shared,permissions', {headers,redirect:'error'});
  require(metadataResponse.ok,'Private recovery package is not accessible to the staging Google grant: HTTP '+metadataResponse.status+'. File-specific Google Picker authorization may be required.');
  const metadata=await metadataResponse.json();require(metadata.ownedByMe===true&&metadata.shared!==true&&(metadata.permissions||[]).every(p=>p.type==='user'&&p.role==='owner'),'Private recovery package must be owned by the source administrator with no shared access.');
  require(Number(metadata.size)>0&&Number(metadata.size)<2*1024*1024,'Private recovery package size is outside the bounded import.');
  const raw=await fetch(driveBase+'?alt=media',{headers,redirect:'error'});require(raw.ok,'Private recovery package download failed.');encryptedBytes=Buffer.from(await raw.arrayBuffer());
  require(process.env.PRODUCTION_RECOVERY_SHA256&&createHash('sha256').update(encryptedBytes).digest('hex')===process.env.PRODUCTION_RECOVERY_SHA256,'Private recovery package checksum differs from the verified upload.');
 }
 const payload=JSON.parse(gunzipSync(decryptRelease(transport,JSON.parse(encryptedBytes))));
 require(createHash('sha256').update(payload.snapshotText).digest('hex')===expectedBackup,'Encrypted backup does not match the approved recovery snapshot.');
 const snapshot=JSON.parse(payload.snapshotText),counts=validateSnapshot(snapshot);
 require(payload.config.mode==='roster'&&payload.config.spreadsheetId===config.env_vars.GOOGLE_SPREADSHEET_ID.value&&payload.config.calendarId===config.env_vars.GOOGLE_CALENDAR_ID.value,'Encrypted source configuration differs from the provisioned source identities.');
 const tables=(await query("SELECT name FROM sqlite_master WHERE type='table'")).map(t=>t.name);
 if(tables.includes('portal_records'))validateExisting(snapshot,await query('SELECT * FROM portal_records'));
 for(const file of ['cloudflare/migrations/0001_portal.sql','cloudflare/migrations/0002_portal_runtime.sql','cloudflare/migrations/0003_pilot_runtime.sql','scripts/production-sync-schema.sql']){
  const sql=readFileSync(file,'utf8');
  for(const statement of sql.split(/;(?=\s*(?:CREATE|ALTER|$))/).filter(s=>s.trim())){
   if(statement.trim().startsWith('ALTER TABLE portal_auth_flows')){const cols=await query('PRAGMA table_info(portal_auth_flows)');if(cols.some(c=>c.name==='payload'))continue;}
   await query(statement);
  }
 }
 const accountCols=await query('PRAGMA table_info(portal_accounts)');
 for(const col of ['provider_id','created_at'])if(!accountCols.some(c=>c.name===col))await query('ALTER TABLE portal_accounts ADD COLUMN '+col+' TEXT');
 for(const r of snapshot.records)await query('INSERT INTO portal_records(id,kind,student_id,parent_id,data,revision,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(id) DO NOTHING',[r.id,r.kind,r.student_id,r.parent_id,JSON.stringify(r.data),r.revision,r.updated_at]);
 for(const a of snapshot.tables.portal_accounts)await query('INSERT INTO portal_accounts(id,email,name,role,parent_id,student_id,enabled,provider_id,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9) ON CONFLICT(id) DO NOTHING',[a.id,a.email,a.name,a.role,a.parent_id,a.student_id,Number(a.enabled),a.provider_id,a.created_at]);
 for(const a of snapshot.tables.portal_audit)await query('INSERT INTO portal_audit(id,account_id,action,record_id,created_at) VALUES(?1,?2,?3,?4,?5) ON CONFLICT(id) DO NOTHING',[a.id,a.account_id,a.action,a.record_id,a.created_at]);
 const restored=await query('SELECT * FROM portal_records');require(restored.length===371,'Restored record count differs.');validateExisting(snapshot,restored);
 const accounts=await query('SELECT id,email,name,role,parent_id,student_id,enabled,provider_id,created_at FROM portal_accounts'),audits=await query('SELECT id,account_id,action,record_id,created_at FROM portal_audit ORDER BY id');
 require(canonical(accounts)===canonical(snapshot.tables.portal_accounts.map(a=>({...a,enabled:Number(a.enabled)}))),'Restored access records differ; release blocked.');
 require(canonical(audits)===canonical([...snapshot.tables.portal_audit].sort((a,b)=>a.id.localeCompare(b.id))),'Restored audit records differ; release blocked.');
 const raw=snapshot.records.find(r=>r.id==='settings'),settings={...raw.data,productionSyncConfig:payload.config,productionRelease:{databaseId:target,dataMigrationVerified:true,retainedRecordIds:snapshot.records.map(r=>r.id),retainedStudentIds:snapshot.records.filter(r=>r.kind==='students').map(r=>r.id),backupSha256:expectedBackup,legacyFingerprint:snapshot.fingerprintBefore.rows[0].fingerprint}};
 await query("UPDATE portal_records SET data=?1,revision=?2 WHERE id='settings' AND revision IN (?3,?2)",[JSON.stringify(settings),raw.revision+1,raw.revision]);
 const latest=await api('/pages/projects/auxesis-education');require(canonical({configs:latest.deployment_configs,deployment:latest.canonical_deployment?.id})===before,'Live project changed during import.');
 const result={databaseId:target,preservedRecords:371,preservedStudents:counts.students,preservedLessons:counts.lessons,preservedInvoices:counts.invoices,preservedPayments:counts.payments,preservedAccounts:accounts.length,preservedAudits:audits.length,sourceRecordsChanged:false,appDeployed:false,automationActivated:false,liveProjectUnchanged:true};
 console.log('::notice title=Auxesis isolated production import::'+JSON.stringify(result));if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,'All 371 preserved records imported and validated into the separate unpublished production database. No live records, payments, invoices or Calendar events changed.\n');return result;
}
if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1])importProduction().catch(e=>{console.error('::error title=Auxesis isolated production import::'+e.message);process.exitCode=1;});
