import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../portal-service/helpers/portalCore.tsx', import.meta.url), 'utf8');

// Source-level regression tripwires only. These do NOT replace authenticated
// endpoint tests or live Calendar verification.
test('unverified admin Calendar mutations are explicitly disabled', () => {
  assert.match(source, /a\.role==='admin'&&\['schedule','cancel','requestCancellation','reschedule','tutorCancel','approveRequest'\]\.includes\(action\)\)fail\(/);
});

test('extra-lesson requests persist a durable pending record', () => {
  assert.match(source, /await save\('extraLessonRequests',pending\)/);
  assert.match(source, /status:'Pending',requestedBy:a\.name/);
  assert.match(source, /out\.requestId=pending\.id/);
});

test('extra-lesson request views are restricted to the linked student or family', () => {
  assert.match(source, /if\(k==='lessons'\|\|k==='extraLessonRequests'\)ok=child\(r\.studentId\)/);
});

test('extra-lesson approval fails closed without Calendar verification', () => {
  assert.match(source, /action==='approveExtraLesson'[\s\S]*?fail\('Extra-lesson approval requires a verified matching Google Calendar event/);
});
