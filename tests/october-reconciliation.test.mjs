import fs from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stripTypeScriptTypes } from 'node:module';

const source=fs.readFileSync(new URL('../portal-service/helpers/octoberReconciliation.tsx',import.meta.url),'utf8');
const {octoberReconciliation}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
const fixture=()=>JSON.parse(fs.readFileSync(new URL('./fixtures/andie-october-verified.json',import.meta.url),'utf8'));
test('verified original source preview maps two lessons, never creates a lesson or changes finances',()=>{
 const f=fixture(),before=JSON.stringify(f),p=octoberReconciliation.plan(f.all,f.input,f.config);
 assert.deepEqual(p.issues,[]);assert.equal(p.previewOnly,true);assert.equal(p.canApply,false);
 assert.equal(p.changes.length,2);assert.equal(JSON.stringify(f),before);
 assert.deepEqual(p.sourceRepairs.map(r=>r.range),['Lessons!G37','Lessons!G40']);
 assert.ok(p.changes.every(c=>c.kind==='lessons'&&f.all.some(r=>r.id===c.data.id)));
 const cancelled=p.changes.find(c=>c.data.id==='300e998c-60fb-5fd7-b57b-ef631e5a3022').data;
 const completed=p.changes.find(c=>c.data.id==='50f5e66f-ae05-51a3-b97a-42d03129c2e5').data;
 assert.equal(cancelled.status,'Cancelled');assert.equal(cancelled.chargeable,false);
 assert.equal(completed.status,'Completed');assert.equal(completed.start,'2026-10-14T10:30:00.000Z');
 assert.equal(completed.sourceMeta.calendarEventId,'6osm2e1mc4oj0b9n6ksjgb9kckp36b9p6pgm4b9p6phjgc9p6cp3gpj6cg');
 assert.equal(f.all.find(r=>r._kind==='students').purchased,8);assert.equal(f.all.find(r=>r._kind==='students').used,0);
});
test('repeat verified snapshot is idempotent with the same existing lesson IDs',()=>{
 const f=fixture(),p=octoberReconciliation.plan(f.all,f.input,f.config);
 f.all=f.all.map(r=>p.changes.find(c=>c.data.id===r.id)?.data||r);
 f.input.lessons.forEach(r=>r['Student ID']=f.config.studentId);
 const again=octoberReconciliation.plan(f.all,f.input,f.config);
 assert.deepEqual(again.issues,[]);assert.deepEqual(again.changes,[]);assert.deepEqual(again.sourceRepairs,[]);
});
test('changed source identities, notes, sources and ambiguous evidence fail without partial proposals',()=>{
 for(const modify of [
  f=>f.input.lessons[0]['Student ID']='other-student',
  f=>f.input.lessons[1]['Lesson Focus']='Changed notes',
  f=>f.input.spreadsheetId='backup',
  f=>f.input.events[1].status='confirmed',
  f=>f.input.events.pop(),
  f=>f.input.lessons.push({...f.input.lessons[1]}),
  f=>f.all[1].status='Completed'
 ]){
  const f=fixture();modify(f);const p=octoberReconciliation.plan(f.all,f.input,f.config);
  assert.ok(p.issues.length);assert.deepEqual(p.changes,[]);assert.deepEqual(p.sourceRepairs,[]);
 }
});
