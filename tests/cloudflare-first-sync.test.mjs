import test from 'node:test';
import assert from 'node:assert/strict';
import {syncPlan} from '../cloudflare/sync-plan.js';
import {readSyncSources} from '../cloudflare/sources.js';

const config={studentId:'fixture-student',studentName:'Fixture Student',calendarId:'fixture-calendar',spreadsheetId:'fixture-tracker',seriesIds:['fixture-series']};
const student={id:config.studentId,_kind:'students',name:config.studentName,purchased:8,used:0};
const cancelled={id:'fixture-cancelled',recurringEventId:'fixture-series',status:'cancelled',originalStartTime:{dateTime:'2026-10-07T04:45:00-04:00'}};
const log={Student:config.studentName,'Lesson Date':'2026-10-07',Status:'Cancelled','Lesson Focus':'Cancelled; no charge.','Homework / Next Step':'Keep original next step',_row:9};
const source={complete:true,calendarId:config.calendarId,spreadsheetId:config.spreadsheetId,timeMin:'2026-09-30T04:00:00.000Z',timeMax:'2026-12-02T05:00:00.000Z',students:[{Student:config.studentName,Rate:125,Currency:'CAD'}],lessons:[log],billing:[],events:[cancelled]};
const plan=(input={},records=[student])=>syncPlan(records,{...source,...input},config);

test('first sync links a Calendar cancellation to one corroborating cancelled Tracker row without inventing duration or debiting balances',()=>{
 const p=plan();assert.equal(p.canApply,true,JSON.stringify(p.issues));
 const lesson=p.changes.find(c=>c.kind==='lessons').data;
 assert.equal(lesson.status,'Cancelled');assert.equal(lesson.start,'2026-10-07T08:45:00.000Z');
 assert.equal(lesson.sourceMeta.calendarEventId,cancelled.id);assert.equal(lesson.sourceMeta.trackerLesson.rowNumber,9);
 assert.equal(lesson.chargeable,false);assert.equal(lesson.hours,null);assert.equal(lesson.end,undefined);
 assert.equal(lesson.durationVerified,false);assert.equal(lesson.notes.covered,log['Lesson Focus']);
 const updated=p.changes.find(c=>c.kind==='students').data;
 assert.equal(updated.purchased,8);assert.equal(updated.used,0);
 const all=p.changes.map(c=>({...c.data,_kind:c.kind}));assert.equal(syncPlan(all,source,config).changes.length,0);
});

test('unlinked cancellations retain the safeguard when the Tracker does not corroborate them',()=>{
 for(const lessons of [[],[{...log,Status:'Completed'}],[{...log,Status:'Scheduled'}],[log,{...log,_row:10}],[{...log,'Calendar Event ID':'different-event'}]]){
  const p=plan({lessons});assert.equal(p.canApply,false);assert.equal(p.changes.filter(c=>c.kind==='lessons').length,0);
 }
});

test('first sync preserves explicitly supplied Calendar cancellation times and duration without charging the lesson',()=>{
 const p=plan({events:[{...cancelled,start:{dateTime:'2026-10-07T04:45:00-04:00'},end:{dateTime:'2026-10-07T05:45:00-04:00'}}]});
 assert.equal(p.canApply,true,JSON.stringify(p.issues));
 const lesson=p.changes.find(c=>c.kind==='lessons').data;
 assert.equal(lesson.start,'2026-10-07T08:45:00.000Z');assert.equal(lesson.end,'2026-10-07T09:45:00.000Z');
 assert.equal(lesson.hours,1);assert.equal(lesson.durationVerified,true);assert.equal(lesson.status,'Cancelled');assert.equal(lesson.chargeable,false);
 const updated=p.changes.find(c=>c.kind==='students').data;assert.equal(updated.purchased,8);assert.equal(updated.used,0);
});

test('invalid supplied cancellation intervals remain blocked',()=>{
 for(const end of ['invalid','2026-10-07T04:15:00-04:00'])assert.equal(plan({events:[{...cancelled,start:cancelled.originalStartTime,end:{dateTime:end}}]}).canApply,false);
});

test('a cancelled tombstone without a timed Calendar slot cannot create a lesson',()=>{
 for(const originalStartTime of [undefined,{date:'2026-10-07'},{dateTime:'invalid'}]){
  const p=plan({events:[{...cancelled,originalStartTime}]});assert.equal(p.canApply,false);
  assert.equal(p.changes.filter(c=>c.kind==='lessons').length,0);
 }
});

test('a cancellation reuses an imported exact-time lesson and preserves completed-history and ambiguous-match safeguards',()=>{
 const existing={id:'imported-lesson',_kind:'lessons',studentId:student.id,start:'2026-10-07T08:45:00.000Z',status:'Scheduled',hours:1,notes:{covered:'',next:''}};
 const p=plan({},[student,existing]);assert.equal(p.canApply,true,JSON.stringify(p.issues));
 assert.equal(p.changes.filter(c=>c.kind==='lessons').length,1);assert.equal(p.changes.find(c=>c.kind==='lessons').data.id,existing.id);
 for(const records of [[student,{...existing,status:'Completed'}],[student,existing,{...existing,id:'duplicate-lesson'}]])assert.equal(plan({},records).canApply,false);
});

async function read(now){
 const requests=[];
 const input=await readSyncSources(config,async url=>{
  requests.push(url);
  if(url.includes('Students'))return {values:[['Student','Rate','Currency'],[config.studentName,125,'CAD']]};
  if(url.includes('Lessons'))return {values:[['Student','Lesson Date','Status','Lesson Focus','Homework / Next Step'],[config.studentName,'2026-09-30','Completed','Original note','']]};
  if(url.includes('Billing'))return {values:[['Student','Invoice Date','Status']]};
  const q=new URL(url).searchParams,start='2026-09-30T08:45:00.000Z';
  return {items:Date.parse(start)>=Date.parse(q.get('timeMin'))&&Date.parse(start)<Date.parse(q.get('timeMax'))?[{id:'first-day-event',recurringEventId:'fixture-series',status:'confirmed',start:{dateTime:start},end:{dateTime:'2026-09-30T09:45:00.000Z'}}]:[]};
 },new Date(now));return {input,requests};
}

test('an afternoon preview includes the morning lesson on the first Toronto read day',async()=>{
 const {input}=await read('2026-10-07T21:09:19.692Z');
 assert.equal(input.timeMin,'2026-09-30T04:00:00.000Z');assert.equal(input.timeMax,'2026-12-02T05:00:00.000Z');
 const p=plan(input);assert.equal(p.canApply,true,JSON.stringify(p.issues));assert.equal(p.eventCount,1);
 assert.equal(p.changes.find(c=>c.kind==='lessons').data.status,'Completed');
});

test('read bounds follow Toronto calendar dates across daylight saving rather than subtracting elapsed hours',async()=>{
 const {input}=await read('2026-03-09T04:30:00.000Z');
 assert.equal(input.timeMin,'2026-03-02T05:00:00.000Z');assert.equal(input.timeMax,'2026-05-04T04:00:00.000Z');
});
