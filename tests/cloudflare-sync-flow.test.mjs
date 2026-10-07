import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {handlePortalRequest} from '../cloudflare/runtime.js';
import {putRecord,listRecords} from '../cloudflare/d1-adapter.js';
import {seal} from '../cloudflare/crypto.js';
import {sha256} from '../cloudflare/google.js';
import {readSyncSources} from '../cloudflare/sources.js';

// Exercise the actual Pages handler and SQL using temporary, synthetic records.
// Google is mocked at the HTTP boundary; no production endpoint is contacted.
async function pilot(t){
 const sqlite=new DatabaseSync(':memory:');
 for(const migration of ['0001_portal.sql','0002_portal_runtime.sql','0003_pilot_runtime.sql'])sqlite.exec(readFileSync(new URL('../cloudflare/migrations/'+migration,import.meta.url),'utf8'));
 const db={prepare(sql){return {bind(...params){return {
  async first(){return sqlite.prepare(sql).get(...params)||null;},
  async all(){return {results:sqlite.prepare(sql).all(...params)};},
  async run(){return sqlite.prepare(sql).run(...params);}
 };},async first(){return sqlite.prepare(sql).get()||null;},async all(){return {results:sqlite.prepare(sql).all()};}};},
 async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 t.after(()=>sqlite.close());
 const config={mode:'pilot',studentId:'fixture-student',studentName:'Fixture Student',calendarId:'fixture-calendar',spreadsheetId:'fixture-tracker',seriesIds:['fixture-series']};
 await putRecord(db,'settings',{id:'settings',reviewMode:true,syncConfig:config});
 await putRecord(db,'parents',{id:'fixture-parent',name:'Fixture Parent'});
 await putRecord(db,'students',{id:config.studentId,parentId:'fixture-parent',name:config.studentName,programme:'IB',subject:'Biology',rate:125,currency:'CAD',purchased:8,used:2});
 const token='A'.repeat(43),env={PORTAL_DB:db,PORTAL_TOKEN_KEY:'test-only-key',GOOGLE_CLIENT_ID:'fixture-client',GOOGLE_CLIENT_SECRET:'fixture-secret'};
 sqlite.prepare('INSERT INTO portal_accounts(id,email,name,role) VALUES(?,?,?,?)').run('fixture-admin','fixture@example.invalid','Fixture Admin','admin');
 sqlite.prepare("INSERT INTO portal_sessions(token_hash,account_id,expires_at) VALUES(?,?,datetime('now','+1 day'))").run(await sha256(token),'fixture-admin');
 sqlite.prepare('INSERT INTO google_connections(account_id,email,refresh_token_ciphertext,scopes) VALUES(?,?,?,?)').run('fixture-admin','fixture@example.invalid',await seal(env.PORTAL_TOKEN_KEY,'fixture-refresh'),'fixture');
 const values={students:[['Student','Rate','Currency'],[config.studentName,'125','CAD']],lessons:[['Student','Lesson Date','Status','Lesson Focus','Homework / Next Step'],[config.studentName,'2026-10-08','Scheduled','Existing focus','Existing homework']],billing:[['Student','Invoice Date','Status']]};
 let events=[{id:'fixture-event',recurringEventId:'fixture-series',status:'confirmed',start:{dateTime:'2026-10-08T10:00:00-04:00'},end:{dateTime:'2026-10-08T11:00:00-04:00'}}];
 const calls=[];
 t.mock.method(globalThis,'fetch',async(url,options={})=>{
  calls.push({url:String(url),method:options.method||'GET'});
  if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'fixture-access'});
  const decoded=decodeURIComponent(String(url));
  if(decoded.endsWith('/values:batchUpdate')){
   for(const item of JSON.parse(options.body).data){const match=item.range.match(/^Lessons!([A-Z]+)(\d+)$/);assert.ok(match);const column=[...match[1]].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;values.lessons[Number(match[2])-1][column]=item.values[0][0];}
   return Response.json({totalUpdatedCells:2});
  }
  for(const [key,tab] of [['students','Students!'],['lessons','Lessons!'],['billing','Billing!']])if(decoded.includes('/values/'+tab))return Response.json({values:values[key]});
  if(decoded.includes('/calendar/v3/'))return Response.json({items:events});
  throw new Error('Unexpected outbound URL in isolated test');
 });
 const NativeDate=globalThis.Date;let now='2026-10-07T12:00:00.000Z';
 globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return NativeDate.parse(now);}};
 t.after(()=>globalThis.Date=NativeDate);
 const request=async(route,body)=>{
  const base='https://fixture.auxesis-migration-preview.pages.dev',response=await handlePortalRequest({env,params:{path:route.split('/')},request:new Request(base+'/api/portal/'+route,{method:body===undefined?'GET':'POST',headers:{Cookie:'__Host-auxesis_session='+token,...(body===undefined?{}:{Origin:base,'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)})});
  return {status:response.status,data:await response.json()};
 };
 const records=async()=>JSON.parse(JSON.stringify((await listRecords(db)).filter(r=>r._kind!=='settings')));
 return {request,records,db,sqlite,values,calls,setNow:value=>now=value,setEvents:value=>events=value,getEvents:()=>structuredClone(events)};
}

test('preview, delayed apply, Portal state and replay reconcile without debiting balances',async t=>{
 const p=await pilot(t),before=await p.records(),preview=await p.request('sync',{mode:'preview'});
 assert.equal(preview.status,200);assert.equal(preview.data.canApply,true);assert.ok(preview.data.changedRecords>0);
 assert.deepEqual(await p.records(),before,'preview leaves business records untouched');
 p.setNow('2026-10-07T12:02:00.000Z');
 const applied=await p.request('sync',{mode:'apply',digest:preview.data.digest});assert.equal(applied.status,200,JSON.stringify(applied.data));
 const state=await p.request('state');assert.equal(state.status,200);assert.equal(state.data.lessons.length,1);
 assert.equal(state.data.lessons[0].start,'2026-10-08T14:00:00.000Z');assert.equal(state.data.lessons[0].notes.covered,'Existing focus');
 assert.equal(state.data.students[0].purchased,8);assert.equal(state.data.students[0].used,2);
 p.setNow('2026-10-07T12:03:00.000Z');
 const replay=await p.request('sync',{mode:'preview'});assert.equal(replay.data.changedRecords,0);
 assert.ok(p.calls.filter(c=>c.url.includes('calendar/v3')).every(c=>c.method==='GET'));
});

test('changed Google data rejects a stale preview without changing Portal business records',async t=>{
 const p=await pilot(t),before=await p.records(),preview=await p.request('sync',{mode:'preview'});
 p.values.students[1][1]='130';p.setNow('2026-10-07T12:02:00.000Z');
 const result=await p.request('sync',{mode:'apply',digest:preview.data.digest});assert.equal(result.status,409);assert.deepEqual(await p.records(),before);
});

test('time passing cannot apply an unpreviewed reconciliation change at a window boundary',async t=>{
 const p=await pilot(t),event=p.getEvents()[0];
 p.setEvents([{...event,start:{dateTime:'2026-12-02T10:00:00Z'},end:{dateTime:'2026-12-02T11:00:00Z'}}]);
 p.values.lessons[1][1]='2026-12-02';p.values.lessons[1][2]='Completed';
 const preview=await p.request('sync',{mode:'preview'});
 p.setNow('2026-10-08T12:00:00.000Z');
 const result=await p.request('sync',{mode:'apply',digest:preview.data.digest});assert.equal(result.status,409);
 assert.equal((await p.records()).filter(r=>r._kind==='lessons').length,0);
});

test('Tracker row evidence retains physical row numbers across blank rows',async()=>{
 const get=async url=>url.includes('Students')?{values:[['Student','Rate','Currency'],[],['Fixture Student','125','CAD']]}:url.includes('Lessons')?{values:[['Student','Lesson Date','Status','Lesson Focus','Homework / Next Step'],[],[],['Fixture Student','2026-10-08','Scheduled','Focus','Next']]}:url.includes('Billing')?{values:[['Student','Invoice Date','Status']]}:{items:[]};
 const source=await readSyncSources({calendarId:'fixture-calendar',spreadsheetId:'fixture-tracker'},get,new Date('2026-10-07T12:00:00Z'));
 assert.equal(source.students[0]._row,3);assert.equal(source.lessons[0]._row,4);
});

test('Calendar create, reschedule and cancellation keep lesson identity and business balances',async t=>{
 const p=await pilot(t);p.values.lessons=[p.values.lessons[0]];
 const apply=async()=>{const preview=await p.request('sync',{mode:'preview'});assert.equal(preview.status,200);assert.equal(preview.data.canApply,true,JSON.stringify(preview.data.issues));const result=await p.request('sync',{mode:'apply',digest:preview.data.digest});assert.equal(result.status,200,JSON.stringify(result.data));return (await p.request('state')).data;};
 let state=await apply();const id=state.lessons[0].id,original=p.getEvents()[0];
 p.setEvents([{...original,start:{dateTime:'2026-10-09T10:00:00-04:00'},end:{dateTime:'2026-10-09T11:30:00-04:00'}}]);
 state=await apply();assert.equal(state.lessons[0].id,id);assert.equal(state.lessons[0].start,'2026-10-09T14:00:00.000Z');assert.equal(state.lessons[0].hours,1.5);
 p.setEvents([{id:original.id,recurringEventId:original.recurringEventId,status:'cancelled'}]);
 state=await apply();assert.equal(state.lessons[0].id,id);assert.equal(state.lessons[0].status,'Cancelled');assert.equal(state.lessons[0].chargeable,null);
 assert.equal(state.students[0].used,2);assert.equal(state.students[0].purchased,8);assert.equal(state.lessons.length,1);
});

test('Portal notes write and restoration touch only the exact Tracker cells after blank rows',async t=>{
 const p=await pilot(t);p.values.lessons.splice(1,0,[],[]);
 const preview=await p.request('sync',{mode:'preview'});assert.equal((await p.request('sync',{mode:'apply',digest:preview.data.digest})).status,200);
 const lesson=(await p.request('state')).data.lessons[0],original=structuredClone(p.values.lessons),events=p.getEvents();
 const update=await p.request('command',{action:'notes',id:lesson.id,operationId:'fixture-note-update-01',covered:'Temporary note',outcome:'Portal only outcome',next:'Temporary next step'});
 assert.equal(update.status,200,JSON.stringify(update.data));assert.equal(p.values.lessons[3][3],'Temporary note');assert.equal(p.values.lessons[3][4],'Temporary next step');
 assert.equal((await p.request('state')).data.lessons[0].notes.outcome,'Portal only outcome');
 const restore=await p.request('command',{action:'notes',id:lesson.id,operationId:'fixture-note-restore-01',covered:original[3][3],outcome:'',next:original[3][4]});assert.equal(restore.status,200);
 assert.deepEqual(p.values.lessons,original);assert.deepEqual(p.getEvents(),events);
 assert.equal((await p.request('sync',{mode:'preview'})).data.changedRecords,0);
 assert.ok(p.calls.filter(c=>c.method!=='GET').every(c=>c.url==='https://oauth2.googleapis.com/token'||c.url.endsWith('/values:batchUpdate')));
});

test('a failed source read is visible in sync health and clears the old apply affordance',async t=>{
 const p=await pilot(t),preview=await p.request('sync',{mode:'preview'});assert.equal(preview.data.canApply,true);
 const before=await p.records();p.values.students=[];
 const failed=await p.request('sync',{mode:'preview'});assert.equal(failed.status,503);
 const state=(await p.request('state')).data;assert.equal(state.settings.syncHealth.state,'error');assert.equal(state.settings.syncHealth.summary.canApply,false);assert.ok(state.settings.syncHealth.error);
 assert.match(state.settings.syncHealth.error,/Tracker tab is empty or unreadable/);
 assert.deepEqual(await p.records(),before);
});

test('an invalid OAuth callback returns the handled error without creating a session',async t=>{
 const p=await pilot(t),count=()=>p.sqlite.prepare('SELECT count(*) AS n FROM portal_sessions').get().n;
 const before=count(),response=await p.request('auth/callback');assert.equal(response.status,401);assert.match(response.data.error,/sign-in has expired/);assert.equal(count(),before);
});

test('non-pilot lessons and concurrent Tracker note changes are rejected before any write',async t=>{
 const p=await pilot(t),preview=await p.request('sync',{mode:'preview'});assert.equal((await p.request('sync',{mode:'apply',digest:preview.data.digest})).status,200);
 const lesson=(await p.request('state')).data.lessons[0];
 await putRecord(p.db,'lessons',{...lesson,id:'other-lesson',studentId:'other-student'});
 const edits={action:'notes',operationId:'fixture-rejected-notes-01',covered:'Should not be saved',next:''},callsBefore=p.calls.length;
 assert.equal((await p.request('command',{...edits,id:'other-lesson'})).status,403);assert.equal(p.calls.length,callsBefore);
 p.values.lessons[1][3]='New Tracker edit';const before=await p.records();
 assert.equal((await p.request('command',{...edits,id:lesson.id})).status,409);assert.deepEqual(await p.records(),before);
 assert.equal(p.calls.filter(c=>c.url.endsWith('/values:batchUpdate')).length,0);
});
