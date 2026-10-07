import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {syncPlan} from '../cloudflare/sync-plan.js';
import {readSyncSources} from '../cloudflare/sources.js';

const config={mode:'pilot',studentId:'pilot-andie',studentName:'Andie Ng',calendarId:'calendar@example.test',spreadsheetId:'tracker-1',seriesIds:['series-andie']};
const student={id:config.studentId,_kind:'students',parentId:'parent-andie',name:'Andie Ng',rate:125,currency:'CAD',status:'Active',notes:'preserve'};
const parent={id:'parent-andie',_kind:'parents',name:'Parent',mobile:'confirmed'};
const input={complete:true,calendarId:config.calendarId,spreadsheetId:config.spreadsheetId,timeMin:'2026-10-01T00:00:00Z',timeMax:'2026-11-30T00:00:00Z',students:[{Student:'Andie Ng',Rate:'125',Currency:'CAD',Status:'Active'}],lessons:[{Student:'Andie Ng','Lesson Date':'2026-10-07',Status:'Completed','Lesson Focus':'Cells','Homework / Next Step':'Review',_row:4}],billing:[],events:[{id:'event-1',recurringEventId:'series-andie',status:'confirmed',start:{dateTime:'2026-10-07T04:45:00-04:00'},end:{dateTime:'2026-10-07T05:45:00-04:00'}}]};

test('pilot sync reads Calendar timing and Tracker business evidence without changing balances',()=>{
 const plan=syncPlan([student,parent],input,config),lesson=plan.changes.find(c=>c.kind==='lessons').data,nextStudent=plan.changes.find(c=>c.kind==='students')?.data;
 assert.equal(plan.canApply,true);assert.equal(lesson.start,'2026-10-07T08:45:00.000Z');assert.equal(lesson.status,'Completed');assert.equal(lesson.notes.covered,'Cells');assert.equal(nextStudent?.used,undefined);assert.equal(nextStudent?.purchased,undefined);
});

test('pilot guard rejects a different Tracker or Calendar',()=>{
 assert.throws(()=>syncPlan([student,parent],{...input,spreadsheetId:'other'},config),/Both source reads/);
 assert.throws(()=>syncPlan([student,parent],input,{...config,studentId:'someone-else'}),/configured pilot student is missing/);
});

test('ambiguous Tracker logs fail closed and produce no lesson mutation',()=>{
 const plan=syncPlan([student,parent],{...input,lessons:[...input.lessons,{...input.lessons[0],_row:5}]},config);
 assert.equal(plan.canApply,false);assert.equal(plan.issues[0].code,'ambiguous-log');
});

test('source reader uses only Sheets and read-only Calendar GET endpoints',async()=>{
 const calls=[],get=async url=>{calls.push(url);if(url.includes('Students'))return {values:[['Student','Rate','Currency'],['Andie Ng','125','CAD']]};if(url.includes('Lessons'))return {values:[['Student','Lesson Date','Status','Lesson Focus','Homework / Next Step'],['Andie Ng','2026-10-07','Completed','Cells','Review']]};if(url.includes('Billing'))return {values:[['Student','Invoice Date','Status']]};return {items:[]};};
 const result=await readSyncSources(config,get,new Date('2026-10-07T12:00:00Z'));assert.equal(result.complete,true);assert.equal(calls.length,4);assert.equal(calls.filter(u=>u.includes('calendar/v3')).length,1);assert.ok(calls.every(u=>u.startsWith('https://')));
});

test('Pages boundary and runtime contain no Floot network dependency',()=>{
 const boundary=fs.readFileSync('functions/api/portal/[[path]].js','utf8'),runtime=fs.readFileSync('cloudflare/runtime.js','utf8');assert.doesNotMatch(boundary+runtime,/floot\.app|https:\/\/floot\.com/i);assert.match(boundary,/handlePortalRequest/);
});

test('runtime blocks the production Pages hostname and has no Calendar write URL',()=>{
 const runtime=fs.readFileSync('cloudflare/runtime.js','utf8');assert.match(runtime,/auxesis-education\.pages\.dev/);assert.doesNotMatch(runtime,/calendar\/v3[^'"`]*[\s\S]{0,120}method:\s*['"](?:POST|PUT|PATCH|DELETE)/i);assert.match(runtime,/sheets\.googleapis\.com/);
});

test('pilot note write-back requires linked pilot lesson and one exact Tracker row',()=>{
 const runtime=fs.readFileSync('cloudflare/runtime.js','utf8');assert.match(runtime,/lesson\.studentId!==config\.studentId/);assert.match(runtime,/matches\.length!==1/);assert.match(runtime,/Tracker notes changed after the last sync/);assert.match(runtime,/portal record was not changed/);assert.match(runtime,/values:batchUpdate/);
});

test('pilot apply uses one atomic D1 batch and keeps the approved student identity',()=>{
 const runtime=fs.readFileSync('cloudflare/runtime.js','utf8'),seed=fs.readFileSync('cloudflare/pilot-seed.js','utf8');assert.match(runtime,/await db\.batch\(statements\)/);assert.match(seed,/5febba2d-82ee-5585-805f-a3fc5e89f803/);assert.match(seed,/Andie Ng/);
});
