import test from 'node:test';
import assert from 'node:assert/strict';
import {
  updateGoogleSheetCell,
  patchGoogleCalendarEvent,
  refreshGoogleAccessToken,
  verifyLessonRowIdentity,
  syncLessonCompletionToGoogle,
  SYNTHETIC_SANDBOX_SHEET_ID,
  SYNTHETIC_SANDBOX_CALENDAR_ID
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

test('updateGoogleSheetCell blocks writes to non-Column C ranges (Lessons!E, Students!G, Students!O)', async () => {
  const lessonsE = await updateGoogleSheetCell('sheet123', 'Lessons!E37', 'Completed', 'token123');
  assert.equal(lessonsE.ok, false);
  assert.match(lessonsE.error || '', /Blocked write to range/);

  const studentsG = await updateGoogleSheetCell('sheet123', 'Students!G9', 5, 'token123');
  assert.equal(studentsG.ok, false);
  assert.match(studentsG.error || '', /Blocked write to range/);

  const studentsO = await updateGoogleSheetCell('sheet123', 'Students!O9', 5, 'token123');
  assert.equal(studentsO.ok, false);
  assert.match(studentsO.error || '', /Blocked write to range/);
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
      lessonSubject: 'IB Biology'
    });

    assert.equal(result.ok, true);
    assert.equal(result.status, 'synced');
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

test('syncLessonCompletionToGoogle enforces strict synthetic sandbox resource match when sandboxOnly is enabled', async () => {
  const resultMismatch = await syncLessonCompletionToGoogle({
    spreadsheetId: 'production-sheet-id',
    calendarId: SYNTHETIC_SANDBOX_CALENDAR_ID,
    accessToken: 'mock-token',
    lessonRowIndex: 2,
    expectedStudentId: 'QA-STUDENT-001',
    calendarEventId: '337a0n0hecsrq55ps7bcrjnp18',
    sandboxOnly: true
  });

  assert.equal(resultMismatch.ok, false);
  assert.equal(resultMismatch.status, 'failed');
  assert.match(resultMismatch.error || '', /Sandbox enforcement block/);
});

test('syncLessonCompletionToGoogle handles durable per-destination partial retry recovery correctly', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = (async (url, init) => {
    const urlStr = url.toString();
    calls.push({ url: urlStr, method: init?.method || 'GET' });

    if (urlStr.includes('/calendars/cal123/events/event456')) {
      return new Response(JSON.stringify({ id: 'event456', summary: '[Completed] IB Chemistry' }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: 'Unexpected URL' }), { status: 400 });
  });

  try {
    // Retry sync when Sheets was already synced previously
    const result = await syncLessonCompletionToGoogle({
      spreadsheetId: 'sheet123',
      calendarId: 'cal123',
      accessToken: 'mock-token',
      lessonRowIndex: 37,
      expectedStudentId: 'student-123',
      calendarEventId: 'event456',
      lessonSubject: 'IB Chemistry',
      existingSheetsSynced: true,
      existingCalendarSynced: false
    });

    assert.equal(result.ok, true);
    assert.equal(result.status, 'synced');
    assert.equal(result.sheetsSynced, true);
    assert.equal(result.calendarSynced, true);
    assert.equal(calls.length, 1); // Only Calendar PATCH is called; Sheets update is skipped
    assert.match(calls[0].url, /calendars\/cal123\/events\/event456/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('completion never succeeds or writes Sheets when Calendar identity is absent, including partial retries', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    throw new Error('No Google request is permitted without both Calendar IDs');
  };
  try {
    for (const calendar of [{}, { calendarId: 'cal123' }, { calendarEventId: 'event456' }]) {
      for (const existingSheetsSynced of [false, true]) {
        const result = await syncLessonCompletionToGoogle({
          spreadsheetId: 'sheet123',
          accessToken: 'mock-token',
          lessonRowIndex: 37,
          expectedStudentId: 'student-123',
          existingSheetsSynced,
          existingCalendarSynced: false,
          ...calendar
        });
        assert.equal(result.ok, false);
        assert.equal(result.status, 'failed');
        assert.equal(result.sheetsSynced, existingSheetsSynced);
        assert.equal(result.calendarSynced, false);
        assert.match(result.error || '', /calendarId or calendarEventId/);
      }
    }
    assert.equal(calls.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
