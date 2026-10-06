import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const google=fs.readFileSync('cloudflare/google.js','utf8'),audit=fs.readFileSync('cloudflare/MIGRATION_AUDIT.md','utf8');
test('Google migration uses read-only Calendar scope',()=>{assert.match(google,/calendar\.readonly/);assert.doesNotMatch(google,/calendar\.events|calendar\.events\.owned|auth\/calendar['"]/);});
test('replacement has no Calendar mutation implementation',()=>{assert.doesNotMatch(google,/method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);});
test('Tracker OAuth remains file scoped',()=>assert.match(google,/auth\/drive\.file/));
test('Floot remains fallback while runtime replacements are inventoried',()=>{assert.match(audit,/R2 is deliberately not provisioned/);assert.match(audit,/re-fetch state/);});
