import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const code=fs.readFileSync(new URL('../portal-service/helpers/octoberReconciliation.tsx',import.meta.url),'utf8');
const {octoberReconciliation}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(code)).toString('base64'));
const fixture=JSON.parse(fs.readFileSync(new URL('../tests/fixtures/andie-october-after-id-repair.json',import.meta.url),'utf8'));
const plan=octoberReconciliation.plan(fixture.all,fixture.input,fixture.config);
console.log(JSON.stringify({mode:'preview',source:'verified read-only snapshot after the two source ID repairs on 2026-10-14',previewOnly:plan.previewOnly,canApply:plan.canApply,issues:plan.issues,sourceRepairs:plan.sourceRepairs,changes:plan.changes.map(c=>({id:c.data.id,status:c.data.status,start:c.data.start,eventId:c.data.sourceMeta.calendarEventId,chargeable:c.data.chargeable,notes:c.data.notes})),unchangedBalances:fixture.all.filter(r=>r._kind==='students').map(s=>({id:s.id,purchased:s.purchased,used:s.used}))},null,2));
if(plan.issues.length)process.exitCode=1;
