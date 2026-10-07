import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const google=fs.readFileSync('cloudflare/google.js','utf8'),audit=fs.readFileSync('cloudflare/MIGRATION_AUDIT.md','utf8');
test('Google migration uses read-only Calendar scope',()=>{assert.match(google,/calendar\.readonly/);assert.doesNotMatch(google,/calendar\.events|calendar\.events\.owned|auth\/calendar['"]/);});
test('replacement exposes only a generic authenticated GET helper for Google source data',()=>{assert.match(google,/function googleJson/);assert.doesNotMatch(google,/calendar\/v3|method:\s*['"](?:PUT|PATCH|DELETE)['"]/i);});
test('Tracker OAuth remains file scoped',()=>assert.match(google,/auth\/drive\.file/));
test('attachment and realtime decisions are explicit',()=>{assert.match(audit,/R2 is deliberately not provisioned/);assert.match(audit,/re-fetch state/);assert.match(audit,/preview has no Floot network route/);});
