import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
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
   calls[calls.length-1].ranges=JSON.parse(options.body).data.map(item=>item.range);
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
 return {request,records,db,sqlite,env,values,calls,setNow:value=>now=value,setEvents:value=>events=value,getEvents:()=>structuredClone(events)};
}

test('active roster preview reconciles in memory with GET-only sources and no business imports or apply token',async t=>{
 const p=await pilot(t);p.env.MIGRATION_PREVIEW_ONLY='true';
 p.values.students=[['Student','Rate','Currency','Status','Package'],['Fixture Student','125','CAD','Active','Monthly'],['Second Student','90','USD','Active','Block'],['Former Student','80','CAD','Inactive','Block']];
 p.values.lessons[0].push('Calendar Event ID');p.values.lessons[1].push('');
 p.values.lessons.push(['Second Student','2026-10-08','Scheduled','Private second focus','Private second homework','second-event']);
 p.setEvents([...p.getEvents(),{id:'second-event',status:'confirmed',start:{dateTime:'2026-10-08T12:00:00-04:00'},end:{dateTime:'2026-10-08T13:00:00-04:00'}}]);
 const before=await p.records(),businessRows=p.sqlite.prepare("SELECT id,data,revision FROM portal_records WHERE id!='settings' ORDER BY id").all();
 const settingsBefore=JSON.parse(p.sqlite.prepare("SELECT data FROM portal_records WHERE id='settings'").get().data);
 const report=await p.request('roster-preview',{mode:'preview'});
 assert.equal(report.status,200,JSON.stringify(report.data));
 const s=report.data.summary;assert.equal(s.readOnly,true);assert.equal(s.canApply,false);assert.equal(s.activeStudentCount,2);assert.deepEqual(s.excludedStatuses,{inactive:1});assert.ok(!('digest' in s));
 const second=s.students.find(r=>r.name==='Second Student');assert.equal(second.projectionOnly,true);assert.equal(second.confirmedCalendarOccurrences,1);assert.equal(second.reviewRequired,true);assert.ok(second.issues.some(i=>i.code==='opening-record-review'));assert.equal(second.businessProposed.rate,90);assert.equal(second.businessProposed.purchased,null);assert.equal(second.businessProposed.used,null);
 assert.deepEqual(await p.records(),before);
 assert.deepEqual(p.sqlite.prepare("SELECT id,data,revision FROM portal_records WHERE id!='settings' ORDER BY id").all(),businessRows);
 assert.equal(p.sqlite.prepare('SELECT COUNT(*) AS n FROM portal_audit').get().n,0);
 const settingsAfter=JSON.parse(p.sqlite.prepare("SELECT data FROM portal_records WHERE id='settings'").get().data);
 assert.deepEqual(settingsAfter.syncConfig,settingsBefore.syncConfig);assert.deepEqual(settingsAfter.syncHealth,settingsBefore.syncHealth);
 assert.ok(p.calls.filter(c=>c.url.includes('googleapis.com')&&!c.url.includes('oauth2.')).every(c=>c.method==='GET'));
 for(const value of ['Private second focus','Private second homework','fixture-access','fixture-refresh','fixture-secret'])assert.ok(!JSON.stringify(report.data).includes(value));
 assert.equal((await p.request('roster-preview',{mode:'apply'})).status,400);
 assert.equal((await p.request('roster-preview',{mode:'preview',studentId:'second'})).status,400);
 assert.equal((await p.request('sync',{mode:'apply'})).status,409);
 assert.deepEqual(await p.records(),before);
 const state=(await p.request('state')).data;assert.equal(state.students.length,1);assert.equal(state.settings.rosterDryRunEnabled,true);assert.deepEqual(state.settings.rosterDryRun.summary,s);
});

test('roster preview requires preview flag, admin session, POST and normal same-origin protection',async t=>{
 const p=await pilot(t);
 assert.equal((await p.request('roster-preview',{mode:'preview'})).status,403);assert.equal(p.calls.length,0);
 p.env.MIGRATION_PREVIEW_ONLY='true';assert.equal((await p.request('roster-preview')).status,405);
 const cross=await handlePortalRequest({env:p.env,params:{path:['roster-preview']},request:new Request('https://fixture.auxesis-migration-preview.pages.dev/api/portal/roster-preview',{method:'POST',headers:{Origin:'https://another.invalid','Content-Type':'application/json',Cookie:'__Host-auxesis_session='+'A'.repeat(43)},body:'{"mode":"preview"}'})});
 assert.equal(cross.status,403);
 const outside=await handlePortalRequest({env:p.env,params:{path:['roster-preview']},request:new Request('https://another.pages.dev/api/portal/roster-preview',{method:'POST',headers:{Origin:'https://another.pages.dev','Content-Type':'application/json',Cookie:'__Host-auxesis_session='+'A'.repeat(43)},body:'{"mode":"preview"}'})});
 assert.equal(outside.status,403);assert.equal(p.calls.length,0);
 p.sqlite.prepare("UPDATE portal_accounts SET role='parent'").run();
 assert.equal((await p.request('roster-preview',{mode:'preview'})).status,403);assert.equal(p.calls.length,0);
 assert.equal((await p.request('state')).data.settings.rosterDryRunEnabled,undefined);
});

test('failed roster read clears its stale report while preserving completed pilot health and business records',async t=>{
 const p=await pilot(t);p.env.MIGRATION_PREVIEW_ONLY='true';p.values.students=[['Student','Rate','Currency','Status'],['Fixture Student','125','CAD','Active']];
 await p.request('sync',{mode:'preview'});await p.request('roster-preview',{mode:'preview'});
 const before=await p.records(),health=(await p.request('state')).data.settings.syncHealth;
 p.values.students=[];assert.equal((await p.request('roster-preview',{mode:'preview'})).status,503);
 const state=(await p.request('state')).data;assert.equal(state.settings.rosterDryRun.state,'error');assert.equal(state.settings.rosterDryRun.summary.canApply,false);assert.equal(state.settings.rosterDryRun.summary.students,undefined);
 assert.deepEqual(state.settings.syncHealth,health);assert.deepEqual(await p.records(),before);
});

test('mapping/balance review uses existing GET sources, preserves dry-run/pilot health and cannot create identities or infer balances',async t=>{
 const p=await pilot(t);p.env.MIGRATION_PREVIEW_ONLY='true';
 p.values.students=[['Student','Rate','Currency','Status','Package'],['Fixture Student','125','CAD','Active','Monthly'],['Second Student','90','USD','Active','Block']];
 // The synthetic configured pilot is excluded by its configured name.
 p.values.lessons.push(['Second Student','2026-10-08','Completed','PRIVATE SECOND NOTES','PRIVATE SECOND HOMEWORK']);
 p.values.billing=[['Student','Invoice Date','Status','Amount Billed','Amount Received','# Lessons','Paid On'],['Second Student','2026-10-01','Paid','900','900','10','2026-10-01']];
 p.setEvents([...p.getEvents(),{id:'second-event',summary:'Second Student Biology',status:'confirmed',start:{dateTime:'2026-10-08T12:00:00-04:00'},end:{dateTime:'2026-10-08T13:00:00-04:00'}}]);
 await p.request('sync',{mode:'preview'});await p.request('roster-preview',{mode:'preview'});
 const before=await p.records(),settingsBefore=JSON.parse(p.sqlite.prepare("SELECT data FROM portal_records WHERE id='settings'").get().data),businessRows=p.sqlite.prepare("SELECT id,data,revision FROM portal_records WHERE id!='settings' ORDER BY id").all();
 const review=await p.request('roster-preview',{mode:'review'});assert.equal(review.status,200);
 const s=review.data.summary;assert.equal(s.studentCount,1);assert.equal(s.readOnly,true);assert.equal(s.canApply,false);assert.ok(!('digest' in s));
 assert.equal(s.students[0].openingBalance.value,null);assert.equal(s.students[0].openingBalance.verified,false);assert.equal(s.students[0].billingEvidence[0].lessonCount,'10');
 assert.deepEqual(p.sqlite.prepare("SELECT id,data,revision FROM portal_records WHERE id!='settings' ORDER BY id").all(),businessRows);assert.deepEqual(await p.records(),before);
 assert.equal(p.sqlite.prepare('SELECT COUNT(*) AS n FROM portal_audit').get().n,0);
 const state=(await p.request('state')).data;assert.deepEqual(state.settings.syncHealth,settingsBefore.syncHealth);assert.deepEqual(state.settings.rosterDryRun,settingsBefore.rosterDryRun);assert.deepEqual(state.settings.rosterReview.summary,s);
 assert.ok(p.calls.filter(c=>c.url.includes('googleapis.com')&&!c.url.includes('oauth2.')).every(c=>c.method==='GET'));
 for(const value of ['PRIVATE SECOND NOTES','PRIVATE SECOND HOMEWORK','fixture-refresh','fixture-access','fixture-secret'])assert.ok(!JSON.stringify(review.data).includes(value));
 p.values.students=[];assert.equal((await p.request('roster-preview',{mode:'review'})).status,503);
 const failed=(await p.request('state')).data;assert.equal(failed.settings.rosterReview.state,'error');assert.equal(failed.settings.rosterReview.summary.students,undefined);assert.deepEqual(failed.settings.rosterDryRun,settingsBefore.rosterDryRun);assert.deepEqual(await p.records(),before);
 assert.equal((await p.request('roster-preview',{mode:'review',digest:'attempted-apply'})).status,400);
});

test('preview, delayed apply, Portal state and replay reconcile without debiting balances',async t=>{
 const p=await pilot(t),before=await p.records(),preview=await p.request('sync',{mode:'preview'});
 assert.equal(preview.status,200);assert.equal(preview.data.canApply,true);assert.ok(preview.data.changedRecords>0);
 assert.equal(preview.data.diagnostics.calendar[0].eventId,'fixture-event');
 assert.equal(preview.data.diagnostics.proposedLessons[0].start,'2026-10-08T14:00:00.000Z');
 assert.equal(preview.data.diagnostics.portalBefore.purchased,preview.data.diagnostics.portalProposed.purchased);
 const diagnostic=JSON.stringify(preview.data.diagnostics);
 for(const privateValue of ['Existing focus','Existing homework','fixture-access','fixture-refresh','fixture-secret'])assert.ok(!diagnostic.includes(privateValue),'diagnostics exclude notes and credentials');
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
 const written=await p.request('sync',{mode:'preview'});assert.equal(written.data.changedRecords,0);
 const writeProof=written.data.diagnostics.trackerNoteEvidence.find(row=>row.rowNumber===4);
 assert.equal(writeProof.coveredHash,createHash('sha256').update('Temporary note').digest('hex'));
 assert.equal(writeProof.nextHash,createHash('sha256').update('Temporary next step').digest('hex'));
 assert.equal((await p.request('state')).data.lessons[0].notes.outcome,'Portal only outcome');
 const restore=await p.request('command',{action:'notes',id:lesson.id,operationId:'fixture-note-restore-01',covered:original[3][3],outcome:'',next:original[3][4]});assert.equal(restore.status,200);
 assert.deepEqual(p.values.lessons,original);assert.deepEqual(p.getEvents(),events);
 const restored=await p.request('sync',{mode:'preview'});assert.equal(restored.data.changedRecords,0);
 assert.equal(restored.data.diagnostics.trackerNoteEvidence.find(row=>row.rowNumber===4).coveredHash,createHash('sha256').update(original[3][3]).digest('hex'));
 assert.ok(p.calls.filter(c=>c.method!=='GET').every(c=>c.url==='https://oauth2.googleapis.com/token'||c.url.endsWith('/values:batchUpdate')));
});

test('saved note hashes use fresh pilot Sheets values rather than cached Portal notes, including rows outside the Calendar window',async t=>{
 const p=await pilot(t);
 p.values.lessons.push(['Fixture Student','2026-09-20','Completed','Historical source note','Historical next']);
 p.values.lessons.push(['Other Student','2026-09-20','Completed','Other student private note','Other next']);
 const first=await p.request('sync',{mode:'preview'});assert.equal(first.status,200);
 assert.equal((await p.request('sync',{mode:'apply',digest:first.data.digest})).status,200);
 const lesson=(await p.request('state')).data.lessons[0];
 lesson.notes.covered='Portal-only copy';lesson.sourceMeta.trackerLesson.row['Lesson Focus']='Portal-only copy';
 await putRecord(p.db,'lessons',lesson);
 const result=await p.request('sync',{mode:'preview'}),proof=result.data.diagnostics.trackerNoteEvidence;
 assert.equal(proof.length,2);assert.equal(proof.find(r=>r.rowNumber===2).coveredHash,createHash('sha256').update('Existing focus').digest('hex'));
 assert.equal(proof.find(r=>r.rowNumber===3).coveredHash,createHash('sha256').update('Historical source note').digest('hex'));
 assert.ok(!JSON.stringify(proof).includes('Historical source note'));assert.ok(!proof.some(r=>r.rowNumber===4));
});

test('editing the covered note writes one exact cell and leaves the unchanged Tracker homework cell untouched',async t=>{
 const p=await pilot(t),preview=await p.request('sync',{mode:'preview'});
 assert.equal((await p.request('sync',{mode:'apply',digest:preview.data.digest})).status,200);
 const lesson=(await p.request('state')).data.lessons[0];
 const result=await p.request('command',{action:'notes',id:lesson.id,operationId:'fixture-single-cell-note-01',covered:'Single-cell pilot check',outcome:lesson.notes.outcome,next:lesson.notes.next});
 assert.equal(result.status,200);
 assert.deepEqual(p.calls.filter(c=>c.url.endsWith('/values:batchUpdate')).map(c=>c.ranges),[['Lessons!D2']]);
 assert.equal(p.values.lessons[1][4],'Existing homework');
 assert.equal((await p.request('sync',{mode:'preview'})).data.changedRecords,0);
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
