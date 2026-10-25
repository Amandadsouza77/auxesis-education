import test from 'node:test';
import assert from 'node:assert/strict';
import { evalCalendarReadEligibility } from '../portal-service/helpers/calendarReadSync.ts';

test('evalCalendarReadEligibility blocks live read on incomplete or mismatched sandbox allowlist', () => {
  // Test case 1: Test mode requested but missing allowlist IDs -> sandbox_blocked
  const res1 = evalCalendarReadEligibility({
    calendarId: 'test-cal-id',
    spreadsheetId: 'test-sheet-id',
    accessToken: 'token-123',
    hasLessons: true,
    testModeRequested: true,
    allowedSpreadsheetId: '',
    allowedCalendarId: ''
  });
  assert.equal(res1.eligible, false);
  assert.equal(res1.status, 'sandbox_blocked');
  assert.match(res1.notice || '', /Sandbox allowlist/i);

  // Test case 2: Mismatched calendar ID -> sandbox_blocked
  const res2 = evalCalendarReadEligibility({
    calendarId: 'mismatched-cal-id',
    spreadsheetId: 'allowed-sheet-id',
    accessToken: 'token-123',
    hasLessons: true,
    allowedSpreadsheetId: 'allowed-sheet-id',
    allowedCalendarId: 'allowed-cal-id'
  });
  assert.equal(res2.eligible, false);
  assert.equal(res2.status, 'sandbox_blocked');

  // Test case 3: Both allowlist IDs match -> eligible
  const res3 = evalCalendarReadEligibility({
    calendarId: 'allowed-cal-id',
    spreadsheetId: 'allowed-sheet-id',
    accessToken: 'token-123',
    hasLessons: true,
    allowedSpreadsheetId: 'allowed-sheet-id',
    allowedCalendarId: 'allowed-cal-id'
  });
  assert.equal(res3.eligible, true);
  assert.equal(res3.status, 'eligible');

  // Test case 4: Unconfigured calendarId/accessToken -> unconfigured
  const res4 = evalCalendarReadEligibility({
    calendarId: '',
    accessToken: ''
  });
  assert.equal(res4.eligible, false);
  assert.equal(res4.status, 'unconfigured');

  // Test case 5: No authorized lessons -> no_lessons
  const res5 = evalCalendarReadEligibility({
    calendarId: 'allowed-cal-id',
    spreadsheetId: 'allowed-sheet-id',
    accessToken: 'token-123',
    hasLessons: false
  });
  assert.equal(res5.eligible, false);
  assert.equal(res5.status, 'no_lessons');
});
