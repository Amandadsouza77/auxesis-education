import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const code=stripTypeScriptTypes(readFileSync(new URL('../portal-service/helpers/portalSyncPlan.tsx',import.meta.url),'utf8'));
const {portalSyncPlan:sync}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const config={calendarId:'qa-calendar@example.invalid',spreadsheetId:'qa-sheet',studentId:'qa-student',series:['qa-series-tue','qa-series-wed']};
const eid=config.series[0]+'_20261006T091500Z';
const student={id:config.studentId,_kind:'students',name:'QA Student',programme:'IB',subject:'Bio HL',rate:125,currency:'CAD',status:'Active',package:'Monthly',used:0,purchased:8};
const lesson={id:'existing-lesson',_kind:'lessons',studentId:student.id,start:'2026-10-06T05:15:00-04:00',status:'Scheduled',hours:1,notes:{covered:'',outcome:'Keep me',next:''},planning:[{text:'Preparation'}],resources:[],sourceMeta:{calendarEventId:eid}};
const event={id:eid,recurringEventId:config.series[0],status:'confirmed',summary:'QA Student',start:{dateTime:lesson.start},end:{dateTime:'2026-10-06T06:15:00-04:00'}};
const input={calendarId:config.calendarId,spreadsheetId:config.spreadsheetId,studentId:student.id,from:'2026-10-01T00:00:00Z',through:'2026-11-30T00:00:00Z',studentRow:{Student:'QA Student',Curriculum:'IB','Subject / Level':'Bio HL',Rate:'125',Currency:'CAD',Status:'Active',Package:'Monthly'},lessonRows:[{Student:'QA Student','Lesson Date':'Oct 6, 2026',Status:'Completed','Lesson Focus':'Cell membrane and transport','Homework / Next Step':'Pre-learning',_row:69}],events:[event],observedAt:'2026-10-06T20:00:00Z'};
const run=(changes={})=>sync.plan([student,lesson],{...input,...changes},config);

test('Calendar supplies time, Tracker supplies attendance and notes, record identity and balances survive',()=>{const p=run(),l=p.changes.find(c=>c.kind==='lessons').data;assert.equal(l.id,lesson.id);assert.equal(l.status,'Completed');assert.equal(l.start,'2026-10-06T09:15:00.000Z');assert.equal(l.notes.covered,'Cell membrane and transport');assert.equal(l.notes.outcome,'Keep me');assert.deepEqual(l.planning,lesson.planning);assert.equal(p.changes.filter(c=>c.kind==='students').length,0);});
test('a repeated source snapshot changes no lesson and applies no debit',()=>{const p=run();const all=[student,...p.changes.map(c=>({...c.data,_kind:c.kind}))];const repeat=sync.plan(all,input,config);assert.equal(repeat.changes.length,0);assert.equal(repeat.summary.unchanged,1);assert.equal(all[0].used,0);assert.equal(all[0].purchased,8);});
test('cancellation retains no-charge evidence without deleting the lesson',()=>{const p=run({events:[{...event,status:'cancelled'}],lessonRows:[{...input.lessonRows[0],Status:'Cancelled','Lesson Focus':'Cancelled; no charge.','Homework / Next Step':'Does not consume a paid lesson.'}]});assert.equal(p.changes[0].data.status,'Cancelled');assert.equal(p.changes[0].data.chargeable,false);assert.equal(p.changes[0].data.id,lesson.id);});
test('confirmed Calendar does not resurrect a Tracker cancellation and flags the conflict',()=>{const p=run({lessonRows:[{...input.lessonRows[0],Status:'Cancelled'}]});assert.equal(p.changes[0].data.status,'Cancelled');assert.equal(p.summary.issues[0].code,'calendar-tracker-cancellation-conflict');});
test('an absent or unreadable event does not cancel an existing lesson',()=>assert.equal(run({events:[]}).changes.length,0));
test('a moved occurrence keeps its event identity and records the previous time',()=>{const moved={...event,start:'2026-10-08T09:15:00Z',end:'2026-10-08T10:15:00Z',originalStartTime:lesson.start};const p=run({events:[moved]});const l=p.changes[0].data;assert.equal(l.id,lesson.id);assert.equal(l.notes.covered,'Cell membrane and transport');assert.equal(l.scheduleHistory[0].start,lesson.start);});
test('hold events and other students are excluded',()=>{assert.equal(run({events:[{...event,summary:'HOLD QA Student'}]}).changes.length,0);assert.equal(run({events:[{...event,id:'other-series_123',recurringEventId:'other-series'}]}).changes.length,0);});
test('ambiguous business rows block the occurrence',()=>{const p=run({lessonRows:[...input.lessonRows,...input.lessonRows]});assert.equal(p.changes.length,0);assert.equal(p.summary.issues[0].code,'ambiguous-tracker-row');});
test('wrong source IDs and multi-student rollout are rejected',()=>{assert.throws(()=>run({studentId:'another-student'}),/Only the configured pilot/);assert.throws(()=>run({calendarId:'primary'}),/Only the configured pilot/);});
test('recurring instances across DST use exact Calendar instants',()=>{const p=run({events:[{...event,id:config.series[0]+'_20261103T101500Z',start:'2026-11-03T05:15:00-05:00',end:'2026-11-03T06:15:00-05:00'}],lessonRows:[]});const l=p.changes[0].data;assert.equal(l.start,'2026-11-03T10:15:00.000Z');assert.equal(l.hours,1);assert.equal(l.status,'Scheduled');});
