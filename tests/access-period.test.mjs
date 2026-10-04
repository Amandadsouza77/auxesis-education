import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../portal-service/helpers/portalCore.tsx',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('function entitlement('),source.indexOf('\nfunction allowed(')).replace('s:Item','s');
function allowed(student,at){class Clock extends Date{static now(){return Date.parse(at);}}const ctx={Date:Clock};vm.createContext(ctx);vm.runInContext(fn,ctx);return ctx.entitlement(student);}
test('resources require a verified paid period and close when the active period ends',()=>{
 assert.equal(allowed({},'2026-10-04'),false);
 assert.equal(allowed({paidThrough:'invalid'},'2026-10-04'),false);
 assert.equal(allowed({paidThrough:'2026-10-31T23:59:59Z'},'2026-10-31T12:00Z'),true);
 assert.equal(allowed({paidThrough:'2026-10-31T23:59:59Z'},'2026-11-01'),false);
});
test('quarterly and end-of-tutoring grace periods last one calendar month, including month ends',()=>{
 const quarterly={paidThrough:'2027-01-31T23:59:59Z',package:'3 months'};
 assert.equal(allowed(quarterly,'2027-02-28T12:00Z'),true);assert.equal(allowed(quarterly,'2027-03-01'),false);
 const ended={paidThrough:'2026-10-31T23:59:59Z',endDate:'2026-10-04T23:59:59Z'};
 assert.equal(allowed(ended,'2026-11-04T12:00Z'),true);assert.equal(allowed(ended,'2026-11-05'),false);
});
