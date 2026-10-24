import test from 'node:test';
import assert from 'node:assert/strict';
import {
  updateGoogleSheetCell,
  patchGoogleCalendarEvent,
  refreshGoogleAccessToken,
  verifyLessonRowIdentity,
  syncLessonCompletionToGoogle
} from '../portal-service/helpers/googleSync.ts';

test('refreshGoogleAccessToken rejects missing credentials', async () => {
  const res = await refreshGoogleAccessToken('', '', '');
  assert.equal(res.ok, false);
  assert.match(res.error || '', /Missing OAuth refresh credentials/);
});

test('verifyLessonRowIdentity detects student ID matches and mismatches', async () => {
  const originalFetch = globalThis.fetch;

  // Case 1: Match
  globalThis.fetch = (async () => {
    return new Response(JSON.stringify({ values: [['student-123']] }), { status: 200 });
  });

  const matchRes = await verifyLessonRowIdentity('sheet123', 37, 'student-123', 'token123');
  assert.equal(matchRes.match, true);
  assert.equal(matchRes.foundStudentId, 'student-123');

  // Case 2: Mismatch
  globalThis.fetch = (async () => {
    return new Response(JSON.stringify({ values: [['other-student']] }), { status: 200 });
  });

  const mismatchRes = await verifyLessonRowIdentity('sheet123', 37, 'student-123', 'token123');
  assert.equal(mismatchRes.match, false);
  assert.match(mismatchRes.error || '', /identity mismatch/i);

  globalThis.fetch = originalFetch;
});

test('syncLessonCompletionToGoogle stops and fails on student ID identity mismatch', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    return new Response(JSON.stringify({ values: [['wrong-student-id']] }), { status: 200 });
  });

  const result = await syncLessonCompletionToGoogle({
    spreadsheetId: 'sheet123',
    calendarId: 'cal123',
    accessToken: 'mock-token',
    lessonRowIndex: 37,
    expectedStudentId: 'expected-student-id',
    calendarEventId: 'event456',
    lessonSubject: 'IB Biology'
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'identity_mismatch');
  assert.match(result.error || '', /identity/i);

  globalThis.fetch = originalFetch;
});

test('updateGoogleSheetCell blocks writes to unsafe columns (Lessons!E, Students!G, Students!O)', async () => {
  const lessonsE = await updateGoogleSheetCell('sheet123', 'Lessons!E37', 'Completed', 'token123');
  assert.equal(lessonsE.ok, false);
  assert.match(lessonsE.error || '', /Blocked attempt/);

  const studentsG = await updateGoogleSheetCell('sheet123', 'Students!G9', 5, 'token123');
  assert.equal(studentsG.ok, false);
  assert.match(studentsG.error || '', /Blocked attempt/);

  const studentsO = await updateGoogleSheetCell('sheet123', 'Students!O9', 5, 'token123');
  assert.equal(studentsO.ok, false);
  assert.match(studentsO.error || '', /Blocked attempt/);
});

test('syncLessonCompletionToGoogle formats requests correctly when access token and verified identity are provided', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = (async (url, init) => {
    const urlStr = url.toString();
    calls.push({
      url: urlStr,
      method: init?.method || 'GET',
      body: init?.body ? JSON.parse(init.body) : null
    });

    if (urlStr.includes('/values/Lessons!G37')) {
      return new Response(JSON.stringify({ values: [['student-123']] }), { status: 200 });
    }

    return new Response(JSON.stringify({ updatedCells: 1 }), { status: 200 });
  });

  try {
    const result = await syncLessonCompletionToGoogle({
      spreadsheetId: 'sheet123',
      calendarId: 'cal123',
      accessToken: 'mock-token',
      lessonRowIndex: 37,
      expectedStudentId: 'student-123',
      calendarEventId: 'event456',
      lessonSubject: 'IB Biology',
      statusColumn: 'C'
    });

    assert.equal(result.ok, true);
    assert.equal(result.status, 'success');
    assert.equal(calls.length, 3); // Verify G37, Lessons Sheet status, Calendar Event

    // Verify identity read
    assert.match(calls[0].url, /values\/Lessons!G37/);
    assert.equal(calls[0].method, 'GET');

    // Verify Lessons Sheet status update (Column C)
    assert.match(calls[1].url, /values\/Lessons!C37/);
    assert.equal(calls[1].method, 'PUT');
    assert.deepEqual(calls[1].body.values, [['Completed']]);

    // Verify Google Calendar event patch
    assert.match(calls[2].url, /calendars\/cal123\/events\/event456/);
    assert.equal(calls[2].method, 'PATCH');
    assert.equal(calls[2].body.summary, '[Completed] IB Biology');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
