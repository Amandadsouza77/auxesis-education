import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('D1 schema keeps business sources external',()=>{
 const sql=fs.readFileSync('cloudflare/migrations/0001_portal.sql','utf8');
 assert.match(sql,/portal_records/);
 assert.match(sql,/google_connections/);
 assert.doesNotMatch(sql,/CREATE TABLE IF NOT EXISTS calendar_events/i);
 assert.doesNotMatch(sql,/CREATE TABLE IF NOT EXISTS student_tracker/i);
});

test('migration documents Calendar as read-only authority',()=>{
 const readme=fs.readFileSync('cloudflare/README.md','utf8');
 assert.match(readme,/Google Calendar: lesson scheduling authority/);
 assert.match(readme,/Calendar access from the portal is read-only/);
 assert.match(readme,/Andie Ng only/);
 assert.match(readme,/Do not disconnect Floot/);
});
