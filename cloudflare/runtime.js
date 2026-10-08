import {authorizeUrl,exchangeCode,refreshAccess,googleJson,sha256} from './google.js';
import {seal,open} from './crypto.js';
import {listRecords,putRecord,getAccountBySession} from './d1-adapter.js';
import {readSyncSources} from './sources.js';
import {syncPlan} from './sync-plan.js';
import {pilotSeed} from './pilot-seed.js';
import {pilotDiagnostics} from './sync-diagnostics.js';
import {rosterDryRun} from './roster-dry-run.js';

const SESSION='__Host-auxesis_session',enc=new TextEncoder();
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...extra}});
const cookie=(value,age)=>`${SESSION}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
const random=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const hex=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const cookies=request=>Object.fromEntries((request.headers.get('Cookie')||'').split(';').map(v=>v.trim().split('=')));
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status});};
const dbOf=env=>env.PORTAL_DB||fail('Preview database is not configured.',503);
const required=(env,key)=>env[key]||fail(`Preview ${key} is not configured.`,503);
const origin=request=>new URL(request.url).origin;
const rosterEnabled=(request,env)=>env.MIGRATION_PREVIEW_ONLY==='true'&&new URL(request.url).hostname.endsWith('.auxesis-migration-preview.pages.dev');

async function ensureSeed(env,email,name){
 const db=dbOf(env),adminEmail=required(env,'ADMIN_EMAIL').toLowerCase();if(email.toLowerCase()!==adminEmail)fail('This email has not been assigned portal access.',403);
 const pilotId=required(env,'PILOT_STUDENT_ID'),pilotName=required(env,'PILOT_STUDENT_NAME');
 if(pilotId!==pilotSeed.student.id||pilotName!==pilotSeed.student.name)fail('Preview pilot identity does not match the approved migration seed.',503);
 if(!(await db.prepare('SELECT id FROM portal_accounts WHERE email=?1').bind(adminEmail).first()))await db.prepare('INSERT INTO portal_accounts(id,email,name,role,enabled) VALUES(?1,?2,?3,?4,1)').bind('admin-preview',adminEmail,name||'Amanda','admin').run();
 if(!(await db.prepare("SELECT id FROM portal_records WHERE id='settings'").first())){
  const config={mode:'pilot',studentId:pilotId,studentName:pilotName,calendarId:required(env,'GOOGLE_CALENDAR_ID'),spreadsheetId:required(env,'GOOGLE_SPREADSHEET_ID'),seriesIds:required(env,'PILOT_SERIES_IDS').split(',').map(v=>v.trim()).filter(Boolean),googleEmail:adminEmail};
  await putRecord(db,'settings',{id:'settings',transfer:'',paypal:'',reviewMode:true,syncConfig:config,syncHealth:{state:'not-run'}});
  await putRecord(db,'parents',pilotSeed.parent);
  await putRecord(db,'students',pilotSeed.student);
 }
 return db.prepare('SELECT id,email,name,role,parent_id AS parentId,student_id AS studentId FROM portal_accounts WHERE email=?1').bind(adminEmail).first();
}

async function account(request,env){const token=cookies(request)[SESSION]||'';if(!/^[\w-]{43}$/.test(token))fail('Please sign in to continue.',401);const actor=await getAccountBySession(dbOf(env),await sha256(token));if(!actor)fail('Please sign in to continue.',401);return actor;}
async function accessToken(env,actor){const row=await dbOf(env).prepare('SELECT refresh_token_ciphertext AS token FROM google_connections WHERE account_id=?1').bind(actor.id).first();if(!row)fail('Connect Google before running the pilot.',503);const refreshed=await refreshAccess(env,await open(required(env,'PORTAL_TOKEN_KEY'),row.token));return refreshed.access_token;}
const googleGet=token=>url=>googleJson(url,token);

async function startOAuth(request,env,popup=false){
 required(env,'GOOGLE_CLIENT_ID');required(env,'GOOGLE_CLIENT_SECRET');required(env,'PORTAL_TOKEN_KEY');
 const state=random(),verifier=random(),redirectUri=origin(request)+'/api/portal/auth/callback',payload=await seal(env.PORTAL_TOKEN_KEY,JSON.stringify({verifier,popup,redirectUri}));
 await dbOf(env).prepare("INSERT INTO portal_auth_flows(token_hash,phase,nonce_hash,payload,expires_at) VALUES(?1,?2,'',?3,datetime('now','+10 minutes'))").bind(await sha256(state),popup?'google-popup':'login',payload).run();
 return authorizeUrl(env,{state,redirectUri,codeChallenge:await sha256(verifier)});
}

async function oauthCallback(request,env){
 const url=new URL(request.url),state=url.searchParams.get('state')||'',code=url.searchParams.get('code')||'',db=dbOf(env),stateHash=await sha256(state),row=await db.prepare('SELECT phase,payload FROM portal_auth_flows WHERE token_hash=?1 AND expires_at>CURRENT_TIMESTAMP').bind(stateHash).first();
 if(!row||!code)fail('This sign-in has expired. Please try again.',401);await db.prepare('DELETE FROM portal_auth_flows WHERE token_hash=?1').bind(stateHash).run();
 const flow=JSON.parse(await open(required(env,'PORTAL_TOKEN_KEY'),row.payload)),tokens=await exchangeCode(env,{code,redirectUri:flow.redirectUri,verifier:flow.verifier}),profile=await googleJson('https://openidconnect.googleapis.com/v1/userinfo',tokens.access_token),actor=await ensureSeed(env,profile.email,profile.name);
 if(tokens.refresh_token)await db.prepare('INSERT INTO google_connections(account_id,email,refresh_token_ciphertext,scopes,updated_at) VALUES(?1,?2,?3,?4,CURRENT_TIMESTAMP) ON CONFLICT(account_id) DO UPDATE SET email=excluded.email,refresh_token_ciphertext=excluded.refresh_token_ciphertext,scopes=excluded.scopes,updated_at=CURRENT_TIMESTAMP').bind(actor.id,profile.email,await seal(env.PORTAL_TOKEN_KEY,tokens.refresh_token),tokens.scope||'').run();
 else if(!(await db.prepare('SELECT account_id FROM google_connections WHERE account_id=?1').bind(actor.id).first()))fail('Google did not provide continued access. Remove the prior grant and connect again.',409);
 if(flow.popup)return new Response('<!doctype html><meta charset="utf-8"><script>opener.postMessage({type:"GOOGLE_INTEGRATION_SUCCESS"},location.origin);close()</script><p>Google connection saved. You may close this window.</p>',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
 const token=random();await db.prepare("INSERT INTO portal_sessions(token_hash,account_id,expires_at) VALUES(?1,?2,datetime('now','+7 days'))").bind(await sha256(token),actor.id).run();return new Response(null,{status:302,headers:{Location:'/portal/dashboard/','Set-Cookie':cookie(token,604800),'Cache-Control':'no-store'}});
}

function snapshot(actor,all,enableRoster=false){
 const state={me:actor,students:[],parents:[],lessons:[],threads:[],reports:[],invoices:[],payments:[],categories:[],resources:[],notifications:[],onboardings:[],billingHistory:[],billingArchive:[],importReviews:[],settings:{transfer:'',paypal:''},entitled:true,policyVersion:'2026-10-03',preview:null},settings=all.find(r=>r._kind==='settings'),pilot=settings?.syncConfig?.studentId,student=all.find(r=>r._kind==='students'&&r.id===pilot);
 for(const raw of all){if(raw._kind!=='settings'&&raw.id!==pilot&&raw.studentId!==pilot&&raw.id!==student?.parentId&&raw.parentId!==student?.parentId)continue;const r={...raw};delete r._kind;if(raw._kind==='settings')state.settings={transfer:r.transfer||'',paypal:r.paypal||'',reviewMode:r.reviewMode===true,syncHealth:r.syncHealth,syncPilot:r.syncConfig?{studentName:r.syncConfig.studentName}:null};else if(Array.isArray(state[raw._kind]))state[raw._kind].push(r);}
 if(actor.role==='admin'&&enableRoster){state.settings.rosterDryRunEnabled=true;state.settings.rosterDryRun=settings?.rosterDryRun;}
 return state;
}

async function runRosterPreview(request,env,actor,body){
 if(actor.role!=='admin'||!rosterEnabled(request,env))fail('Roster dry run is available only to the isolated preview administrator.',403);
 if(body.mode!=='preview'||Object.keys(body).some(k=>k!=='mode'))fail('The roster preview is read-only; imports and configuration changes are disabled.',400);
 const db=dbOf(env),all=await listRecords(db),settings=all.find(r=>r.id==='settings'),config=settings?.syncConfig;
 if(config?.mode!=='pilot')fail('The existing pilot configuration must remain in place.');
 const input=await readSyncSources(config,googleGet(await accessToken(env,actor))),summary=rosterDryRun(all,input,config);
 summary.businessRecordsHash=await hex(JSON.stringify(all.filter(r=>r._kind!=='settings').sort((a,b)=>a.id.localeCompare(b.id))));
 // Save operational diagnostics only. No reconciliation changes are applied;
 // the existing one-student configuration, health and business records stay.
 const row=await db.prepare("SELECT data FROM portal_records WHERE id='settings'").first(),latest=JSON.parse(row.data);
 latest.rosterDryRun={state:'review',lastReadAt:new Date().toISOString(),summary,error:null};
 await putRecord(db,'settings',latest);return {ok:true,...latest.rosterDryRun};
}

async function runSync(env,actor,body){
 if(actor.role!=='admin')fail('Administrator access is required.',403);if(!['preview','apply'].includes(body.mode))fail('Choose preview or apply.',400);
 const db=dbOf(env),all=await listRecords(db),settings=all.find(r=>r.id==='settings'),config=settings?.syncConfig;if(config?.mode!=='pilot')fail('One-student pilot is not configured.');
 // Sliding read-window timestamps change on every request. Bind the preview
 // to source content, record revisions and the resulting plan instead, so time
 // alone does not invalidate apply while window-dependent changes still do.
 const input=await readSyncSources(config,googleGet(await accessToken(env,actor))),plan=syncPlan(all,input,config),recordRows=await db.prepare('SELECT id,revision FROM portal_records WHERE student_id=?1 OR id=?1 OR id=?2 ORDER BY id').bind(config.studentId,all.find(r=>r.id===config.studentId)?.parentId||'').all(),digest=await hex(JSON.stringify({config,input:Object.fromEntries(Object.entries(input).filter(([key])=>!['timeMin','timeMax'].includes(key))),records:recordRows.results||[],plan})),summary={studentName:plan.studentName,studentId:plan.studentId,changedRecords:plan.changes.length,eventCount:plan.eventCount,trackerLessonCount:plan.trackerLessonCount,billingRowCount:plan.billingRowCount,issues:plan.issues,canApply:plan.canApply,digest};
 summary.diagnostics=pilotDiagnostics(all,input,config,plan);
 // Fresh Sheets evidence, independent of the Portal's cached teaching-log
 // copy and Calendar window. Hashes allow exact write/restoration checks.
 summary.diagnostics.trackerNoteEvidence=await Promise.all(input.lessons.filter(row=>String(row.Student||'').trim().toLowerCase()===String(config.studentName).trim().toLowerCase()).map(async row=>({rowNumber:row._row,date:row['Lesson Date'],coveredHash:await hex(String(row['Lesson Focus']??'')),nextHash:await hex(String(row['Homework / Next Step']??''))})));
 if(body.mode==='apply'){if(body.digest!==digest)fail('Sources or portal records changed. Preview again.');if(!plan.canApply)fail('Resolve the listed source conflicts before applying this pilot.');const statements=plan.changes.map(change=>recordStatement(db,change.kind,change.data));statements.push(db.prepare('INSERT INTO portal_audit(id,account_id,action,record_id) VALUES(?1,?2,?3,?4)').bind(crypto.randomUUID(),actor.id,'sourceSync',config.studentId));await db.batch(statements);}
 settings.syncHealth={lastAttemptedAt:new Date().toISOString(),lastReadAt:new Date().toISOString(),lastSuccessfulAt:body.mode==='apply'?new Date().toISOString():settings.syncHealth?.lastSuccessfulAt||null,state:body.mode==='apply'?'applied':plan.canApply?'preview-ready':'conflicts',summary,error:null};await putRecord(db,'settings',settings);return {ok:true,mode:body.mode,...summary};
}

function recordStatement(db,kind,item){const data={...item};delete data._kind;const studentId=kind==='students'?data.id:(data.studentId||null),parentId=kind==='parents'?data.id:(data.parentId||null);return db.prepare(`INSERT INTO portal_records(id,kind,student_id,parent_id,data,revision,updated_at) VALUES(?1,?2,?3,?4,?5,1,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,student_id=excluded.student_id,parent_id=excluded.parent_id,data=excluded.data,revision=portal_records.revision+1,updated_at=CURRENT_TIMESTAMP`).bind(data.id,kind,studentId,parentId,JSON.stringify(data));}

const a1=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
async function trackerNotes(env,actor,lesson,notes,config){
 if(lesson.studentId!==config.studentId)fail('Only the configured pilot student is enabled.',403);if(!lesson.sourceMeta?.calendarEventId)fail('This lesson is not linked to the authoritative Calendar event.',409);
 const token=await accessToken(env,actor),url='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(config.spreadsheetId)+'/values/'+encodeURIComponent('Lessons!A1:Y1001'),sheet=await googleJson(url,token),values=sheet.values||[],headers=(values[0]||[]).map(v=>String(v).trim()),studentCol=headers.indexOf('Student'),eventCol=headers.indexOf('Calendar Event ID'),dateCol=headers.indexOf('Lesson Date'),focusCol=headers.indexOf('Lesson Focus'),nextCol=headers.indexOf('Homework / Next Step');if([studentCol,dateCol,focusCol,nextCol].some(i=>i<0))fail('Tracker columns changed; no update was made.',409);
 const localDay=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(lesson.start)),matches=values.slice(1).map((row,i)=>({row,n:i+2})).filter(({row})=>String(row[studentCol]||'').trim()===config.studentName&&(eventCol>=0&&String(row[eventCol]||'').trim()?String(row[eventCol]).trim()===lesson.sourceMeta.calendarEventId:dateValue(row[dateCol])===localDay));if(matches.length!==1)fail('The pilot lesson must match exactly one Tracker row; no update was made.',409);
 const current=matches[0].row,previous=lesson.sourceMeta?.trackerLesson?.row;if(!previous)fail('Sync this lesson from the Tracker before editing its notes.',409);if((String(current[focusCol]||'')!==String(previous['Lesson Focus']||'')&&String(current[focusCol]||'')!==notes.covered)||(String(current[nextCol]||'')!==String(previous['Homework / Next Step']||'')&&String(current[nextCol]||'')!==notes.next))fail('Tracker notes changed after the last sync. Preview the pilot again; no update was made.',409);
 const n=matches[0].n,data=[{column:focusCol,value:notes.covered},{column:nextCol,value:notes.next}].filter(({column,value})=>String(current[column]??'')!==value).map(({column,value})=>({range:`Lessons!${a1(column)}${n}`,values:[[value]]}));
 if(!data.length)return n;
 const response=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(config.spreadsheetId)+'/values:batchUpdate',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({valueInputOption:'RAW',data}),signal:AbortSignal.timeout(30000)});if(!response.ok)fail('The Tracker update failed; the portal record was not changed.',503);return n;
}
function dateValue(v){const s=String(v||'').trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const t=Date.parse(s+' 12:00:00 GMT');return Number.isFinite(t)?new Date(t).toISOString().slice(0,10):'';}

async function runCommand(env,actor,body){
 if(actor.role!=='admin'||body.action!=='notes')fail('This pilot permits only administrator lesson-note updates.',403);if(!/^[a-zA-Z0-9-]{12,80}$/.test(body.operationId||''))fail('Please retry this change.',400);
 const db=dbOf(env),prior=await db.prepare('SELECT result FROM portal_operations WHERE account_id=?1 AND operation_id=?2').bind(actor.id,body.operationId).first();if(prior)return JSON.parse(prior.result);const row=await db.prepare("SELECT data FROM portal_records WHERE id=?1 AND kind='lessons'").bind(String(body.id||'')).first();if(!row)fail('This lesson is not available.',404);const lesson=JSON.parse(row.data),settingsRow=await db.prepare("SELECT data FROM portal_records WHERE id='settings'").first(),settings=JSON.parse(settingsRow.data),notes={covered:String(body.covered||'').trim().slice(0,3000),outcome:String(body.outcome||'').trim().slice(0,3000),next:String(body.next||'').trim().slice(0,3000)},trackerRow=await trackerNotes(env,actor,lesson,notes,settings.syncConfig);
 lesson.notes=notes;lesson.sourceMeta={...lesson.sourceMeta,trackerLesson:{...(lesson.sourceMeta?.trackerLesson||{}),row:{...(lesson.sourceMeta?.trackerLesson?.row||{}),'Lesson Focus':notes.covered,'Homework / Next Step':notes.next},rowNumber:trackerRow}};await putRecord(db,'lessons',lesson);const result={ok:true};await db.prepare('INSERT INTO portal_operations(account_id,operation_id,result,created_at) VALUES(?1,?2,?3,CURRENT_TIMESTAMP)').bind(actor.id,body.operationId,JSON.stringify(result)).run();await db.prepare('INSERT INTO portal_audit(id,account_id,action,record_id) VALUES(?1,?2,?3,?4)').bind(crypto.randomUUID(),actor.id,'trackerNotes',lesson.id).run();return result;
}

export async function handlePortalRequest(context){
 const {request}=context,env=context.env||{},url=new URL(request.url),route=(Array.isArray(context.params.path)?context.params.path:[]).join('/');
 let actor;
 try{
  if(url.hostname==='auxesis-education.pages.dev')return json({error:'The Cloudflare migration is preview-only.'},503);
  if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed.'},405);
  if(request.method==='POST'&&(request.headers.get('Origin')!==origin(request)||request.headers.get('Content-Type')?.split(';')[0]!=='application/json'))return json({error:'Please submit this change from your Auxesis Portal.'},403);
  if(route==='auth/start'&&request.method==='GET')return new Response(null,{status:302,headers:{Location:await startOAuth(request,env,false),'Cache-Control':'no-store'}});
  if(route==='auth/callback'&&request.method==='GET')return await oauthCallback(request,env);
  actor=await account(request,env);if(route==='state'&&request.method==='GET')return json(snapshot(actor,await listRecords(dbOf(env)),rosterEnabled(request,env)));
  let body={};if(request.method==='POST'){const raw=await request.text();if(raw.length>150000)return json({error:'This request is too large.'},413);body=raw?JSON.parse(raw):{};}
  if(route==='roster-preview'){if(request.method!=='POST')fail('Use the read-only roster preview control.',405);return json(await runRosterPreview(request,env,actor,body));}
  if(route==='sync')return json(await runSync(env,actor,body));if(route==='command')return json(await runCommand(env,actor,body));if(route==='google/start')return json({url:await startOAuth(request,env,true)});if(route==='google/picker')return json({accessToken:await accessToken(env,actor),apiKey:required(env,'GOOGLE_API_KEY'),appId:required(env,'GOOGLE_APP_ID')});
  if(route==='logout'){await dbOf(env).prepare('DELETE FROM portal_sessions WHERE token_hash=?1').bind(await sha256(cookies(request)[SESSION]||'')).run();return json({ok:true},200,{'Set-Cookie':cookie('',0)});}if(['upload','file','realtime'].includes(route))return json({error:'This feature is not enabled in the one-student migration pilot.'},409);return json({error:'This page is not available.'},404);
 }catch(error){
  const status=error?.status||503,message=error?.status?error.message:'The portal could not complete this request. Existing records were retained.';
  // Do not log provider responses, request bodies, notes or credentials.
  const safeRoute=['sync','roster-preview','command','state','auth/start','auth/callback','google/start','google/picker','logout'].includes(route)?route:'other';
  const sourceCodes=['tracker_unreadable','tracker_columns_changed','tracker_range_limit','calendar_incomplete','calendar_pagination_incomplete'];
  console.error(JSON.stringify({event:'portal_request_failed',route:safeRoute,status,...(sourceCodes.includes(error?.code)?{code:error.code}:{})}));
  if(route==='sync'&&actor?.role==='admin')try{
   const db=dbOf(env),row=await db.prepare("SELECT data FROM portal_records WHERE id='settings'").first();
   if(row){const settings=JSON.parse(row.data);settings.syncHealth={...settings.syncHealth,lastAttemptedAt:new Date().toISOString(),state:'error',error:message,summary:{canApply:false}};await putRecord(db,'settings',settings);}
  }catch{console.error(JSON.stringify({event:'sync_health_write_failed'}));}
  if(route==='roster-preview'&&actor?.role==='admin'&&rosterEnabled(request,env)&&status>=500)try{
   const db=dbOf(env),row=await db.prepare("SELECT data FROM portal_records WHERE id='settings'").first();
   if(row){const settings=JSON.parse(row.data);settings.rosterDryRun={state:'error',lastAttemptedAt:new Date().toISOString(),error:message,summary:{readOnly:true,canApply:false}};await putRecord(db,'settings',settings);}
  }catch{console.error(JSON.stringify({event:'roster_health_write_failed'}));}
  return json({error:message},status);
 }
}
