import test from 'node:test';
import assert from 'node:assert/strict';
import {rosterReview} from '../cloudflare/roster-review.js';

const config={studentId:'pilot',studentName:'Andie Ng',calendarId:'cal',spreadsheetId:'sheet',seriesIds:['approved']};
const base={complete:true,calendarId:'cal',spreadsheetId:'sheet',timeMin:'2026-09-30T04:00:00Z',timeMax:'2026-12-02T05:00:00Z',students:[],lessons:[],billing:[],events:[]};
const row=(Student,_row)=>({Student,_row,Status:'Active',Rate:'100',Currency:'CAD',Package:'Monthly'});
const event=(id,summary,recurringEventId,date='2026-10-08')=>({id,summary,recurringEventId,status:'confirmed',start:{dateTime:date+'T10:00:00-04:00'},end:{dateTime:date+'T11:00:00-04:00'}});
const log=(Student,_row,date)=>({Student,_row,'Lesson Date':date,Status:'Completed','Lesson Focus':'PRIVATE TEACHING TEXT','Homework / Next Step':'PRIVATE HOMEWORK'});

test('unique first name requires multiple corroborating dates; shared first names and unrelated substring titles remain ambiguous',()=>{
 const input={...base,students:[row('Andie Ng',9),row('Alex Smith',2),row('Maya Hassan',3),row('Maya Keinan',4)],lessons:[log('Alex Smith',2,'2026-10-08'),log('Alex Smith',3,'2026-10-15'),log('Maya Hassan',4,'2026-10-08'),log('Maya Hassan',5,'2026-10-15')],events:[event('a','Alex Biology','alex'),event('b','Alex Biology','alex','2026-10-15'),event('m','Maya Biology','maya'),event('n','Maya Biology','maya','2026-10-15'),event('bad','Alexandra Biology','alexandra')]};
 const before=structuredClone(input),report=rosterReview([],input,config);
 assert.equal(report.studentCount,3);assert.ok(!report.students.some(s=>s.name==='Andie Ng'));assert.equal(report.readOnly,true);assert.equal(report.canApply,false);
 const alex=report.students[0];assert.deepEqual(alex.proposedCalendarGroups,['series:alex']);assert.equal(alex.calendarCandidates.length,1);assert.equal(alex.calendarCandidates[0].basis,'exact-first-name-only');assert.equal(alex.calendarCandidates[0].approved,false);
 assert.deepEqual(alex.calendarCandidates[0].trackerDateMatches.map(x=>x.trackerRow),[2,3]);
 for(const maya of report.students.slice(1)){assert.equal(maya.calendarCandidates[0].assessment,'ambiguous-name');assert.deepEqual(maya.proposedCalendarGroups,[]);}
 assert.deepEqual(input,before);assert.ok(!JSON.stringify(report).includes('PRIVATE TEACHING TEXT'));assert.ok(!JSON.stringify(report).includes('PRIVATE HOMEWORK'));
});

test('full-name owner prevents another student with the same first name from claiming a group; conflicting status blocks a proposal',()=>{
 const input={...base,students:[row('Maya Hassan',2),row('Maya Keinan',3)],lessons:[{...log('Maya Keinan',4,'2026-10-08'),Status:'Cancelled'}],events:[event('m','Maya Keinan Biology','maya')]};
 const report=rosterReview([],input,config);assert.equal(report.students[0].calendarCandidates.length,0);
 assert.equal(report.students[1].calendarCandidates[0].basis,'exact-full-name');assert.ok(report.students[1].calendarCandidates[0].conflicts.some(c=>c.code==='lesson-status-review'));assert.deepEqual(report.students[1].proposedCalendarGroups,[]);
});

test('paid invoices and completed lessons never imply an opening balance; financial evidence and discrepancies retain exact row references',()=>{
 const input={...base,students:[row('Alex Smith',2)],lessons:[log('Alex Smith',4,'2026-10-08')],billing:[{Student:'Alex Smith',_row:2,'Invoice #':'INV-1',Status:'Paid','Paid On':'2026-10-01','Amount Billed':1000,'Amount Received':1000,'# Lessons':10,Currency:'CAD',Notes:'PRIVATE BILLING NOTE','Received Via':'PRIVATE PAYMENT REFERENCE'},{Student:'Alex Smith',_row:3,'Invoice #':'INV-1',Status:'Paid','Amount Billed':1000,'Amount Received':900,'# Lessons':10,Currency:'USD'}]};
 const report=rosterReview([],input,config),student=report.students[0];
 assert.equal(student.openingBalance.value,null);assert.equal(student.openingBalance.verified,false);assert.equal(report.verifiedOpeningBalances,0);
 assert.deepEqual(student.identity.billingRows,[2,3]);assert.deepEqual(student.billingEvidence.map(b=>b.lessonCount),[10,10]);
 for(const code of ['duplicate-invoice-evidence','payment-evidence-incomplete','payment-status-review','billing-currency-review'])assert.ok(student.openingBalance.financeIssues.some(i=>i.code===code));
 assert.ok(!JSON.stringify(report).includes('PRIVATE BILLING NOTE'));assert.ok(!JSON.stringify(report).includes('PRIVATE PAYMENT REFERENCE'));
});

test('one first-name date, duplicate identities and multiple same-day occurrences cannot create supported proposals; title contacts are redacted',()=>{
 const input={...base,students:[row('Alex Smith',2),row('Sam Lee',3),row('Sam Lee',4)],lessons:[log('Alex Smith',2,'2026-10-08')],events:[event('a','Alex Biology','alex'),event('s','Sam Lee Biology sam@example.invalid +1 555 555 1212 https://example.invalid/secret','sam'),event('s2','Sam Lee Biology','sam')]};
 const report=rosterReview([],input,config);
 assert.ok(report.students.every(s=>s.proposedCalendarGroups.length===0));
 assert.equal(report.students[0].calendarCandidates[0].assessment,'insufficient-or-conflicting-evidence');
 assert.ok(report.students[1].identity.identityIssues.some(i=>i.code==='duplicate-tracker-name'));
 const serialized=JSON.stringify(report);for(const value of ['sam@example.invalid','555 555 1212','https://example.invalid/secret'])assert.ok(!serialized.includes(value));
});
