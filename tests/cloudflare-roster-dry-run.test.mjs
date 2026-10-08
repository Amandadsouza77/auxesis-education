import test from 'node:test';
import assert from 'node:assert/strict';
import {rosterDryRun} from '../cloudflare/roster-dry-run.js';

const config={studentId:'pilot',studentName:'Andie Ng',calendarId:'cal',spreadsheetId:'sheet',seriesIds:['approved']};
const source={complete:true,calendarId:'cal',spreadsheetId:'sheet',timeMin:'2026-09-30T04:00:00Z',timeMax:'2026-12-03T05:00:00Z',students:[],lessons:[],billing:[],events:[]};
const row=(Student,_row,Status='Active')=>({Student,_row,Status,Rate:'100',Currency:'CAD'});
const event=(id,summary,series)=>({id,summary,recurringEventId:series,status:'confirmed',start:{dateTime:'2026-10-08T10:00:00-04:00'},end:{dateTime:'2026-10-08T11:00:00-04:00'}});

test('exact full-name titles and recurring siblings remain unapproved candidates; missing and inactive rows are visible',()=>{
 const input={...source,students:[row('Alex Smith',2),row('Sam Lee',3),row('Former Student',4,'Inactive'),row('Unknown Status',5,'')],events:[event('a','Biology — Alex Smith','alex'),event('b','Alex Smithson','wrong'),event('c','Math — Alex','first-only'),{...event('cancelled','', 'alex'),status:'cancelled'}]};
 const original=structuredClone(input),report=rosterDryRun([],input,config);
 assert.equal(report.canApply,false);assert.equal(report.activeStudentCount,2);assert.deepEqual(report.excludedStatuses,{inactive:1,'not recorded':1});
 assert.equal(report.students[0].candidateCalendarOccurrences,2);assert.equal(report.students[0].confirmedCalendarOccurrences,0);assert.equal(report.students[0].reviewRequired,true);assert.deepEqual(report.students[0].seriesIds,['alex']);
 assert.ok(report.students[0].issues.some(i=>i.code==='calendar-mapping-review'));
 assert.ok(report.students[1].issues.some(i=>i.code==='calendar-mapping-missing'));
 assert.ok(report.issues.some(i=>i.code==='roster-status-review'));assert.equal(report.unassignedCalendarOccurrences,2);
 assert.deepEqual(input,original,'source data retained unchanged');
});

test('duplicate identities and shared Calendar events fail closed without generating record changes',()=>{
 const duplicate=rosterDryRun([],{...source,students:[row('Alex Smith',2),row('Alex Smith',3)],events:[event('a','Alex Smith','alex')]},config);
 assert.ok(duplicate.students.every(s=>s.projectedChangedRecords===null&&s.issues.some(i=>i.code==='duplicate-student-name')));
 const shared=rosterDryRun([],{...source,students:[row('Alex Smith',2),row('Sam Lee',3)],events:[event('a','Alex Smith and Sam Lee','joint')]},config);
 assert.ok(shared.students.every(s=>s.projectedChangedRecords===null&&s.issues.some(i=>i.code==='shared-calendar-event')));
 const ids=rosterDryRun([],{...source,students:[{...row('Alex Smith',2),'Student ID':'same'},{...row('Sam Lee',3),'Student ID':'same'}]},config);
 assert.ok(ids.students.every(s=>s.issues.some(i=>i.code==='duplicate-student-id')));
});

test('approved pilot mapping is reused without title inference; rates and attendance conflicts reuse the existing planner',()=>{
 const all=[{_kind:'students',id:'pilot',name:'Andie Ng',purchased:8,used:0}],input={...source,students:[{...row('Andie Ng',9),Rate:'invalid'}],events:[event('a','Private title','approved')],lessons:[{Student:'Andie Ng','Lesson Date':'2026-10-08',Status:'Cancelled',_row:72}]};
 const original=structuredClone(all),report=rosterDryRun(all,input,config);
 assert.equal(report.students[0].confirmedCalendarOccurrences,1);assert.equal(report.students[0].candidateCalendarOccurrences,0);
 assert.ok(report.students[0].issues.some(i=>i.code==='invalid-rate'));assert.ok(report.students[0].issues.some(i=>i.code==='cancellation-conflict'));
 assert.equal(report.students[0].businessProposed.purchased,8);assert.equal(report.students[0].businessProposed.used,0);assert.deepEqual(all,original);
});

test('a same-day Tracker row with a conflicting Calendar Event ID is flagged even in a candidate projection',()=>{
 const wrong={...event('wrong-id','Alex Smith','alex'),start:{dateTime:'2026-10-09T10:00:00-04:00'},end:{dateTime:'2026-10-09T11:00:00-04:00'}};
 const report=rosterDryRun([],{...source,students:[row('Alex Smith',2)],events:[event('correct-date','Alex Smith','alex'),wrong],lessons:[{Student:'Alex Smith','Lesson Date':'2026-10-08',Status:'Scheduled','Calendar Event ID':'wrong-id',_row:10}]},config);
 assert.ok(report.students[0].issues.some(i=>i.code==='tracker-event-id-conflict'));
});
