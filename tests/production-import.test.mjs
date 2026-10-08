import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSnapshot,validateExisting} from '../scripts/production-import.mjs';
test('partial recovery may resume only when every existing record exactly matches the backup',()=>{
 const old={id:'l1',kind:'lessons',student_id:'s1',parent_id:null,revision:3,data:{id:'l1',status:'Completed',hours:1,notes:{covered:'fixture notes'}}};
 const snapshot={records:[old]};assert.doesNotThrow(()=>validateExisting(snapshot,[]));assert.doesNotThrow(()=>validateExisting(snapshot,[{...old,data:JSON.stringify(old.data)}]));
 for(const change of [{id:'unknown'},{revision:2},{kind:'invoices'},{student_id:'different'},{data:{...old.data,hours:1.5}}])assert.throws(()=>validateExisting(snapshot,[{...old,...change}]));
 assert.throws(()=>validateSnapshot({...snapshot,tables:{}}));
});
