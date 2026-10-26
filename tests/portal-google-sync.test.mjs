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
    return new Response(JSON.stringify({ values: [['Scheduled', '', '', '', 'student-123']] }), { status: 200 });
  });

  const matchRes = await verifyLessonRowIdentity('sheet123', 37, 'student-123', 'token123');
  assert.equal(matchRes.match, true);
  assert.equal(matchRes.foundStudentId, 'student-123');

  // Case 2: Mismatch
  globalThis.fetch = (async () => {
    return new Response(JSON.stringify({ values: [['Scheduled', '', '', '', 'other-student']] }), { status: 200 });
  });

  const mismatchRes = await verifyLessonRowIdentity('sheet123', 37, 'student-123', 'token123');
  assert.equal(mismatchRes.match, false);
  assert.match(mismatchRes.error || '', /identity mismatch/i);

  globalThis.fetch = originalFetch;
});

test('syncLessonCompletionToGoogle stops and fails on student ID identity mismatch', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    return new Response(JSON.stringify({ values: [['Scheduled', '', '', '', 'wrong-student-id']] }), { status: 200 });
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

test('verifyLessonRowIdentity flags unknown attribution if Sheet Column C is Completed but local receipt is false', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    return new Response(JSON.stringify({ values: [['Completed', '', '', '', 'student-123']] }), { status: 200 });
  });

  const result = await syncLessonCompletionToGoogle({
    spreadsheetId: 'sheet123',
    calendarId: 'cal123',
    accessToken: 'mock-token',
    lessonRowIndex: 37,
    expectedStudentId: 'student-123',
    calendarEventId: 'event456',
    lessonSubject: 'IB Biology',
    existingSheetsSynced: false
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'failed');
  assert.match(result.error || '', /Unknown attribution/i);

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

test('Lessons status writer rejects suffixes, multi-cell ranges and header rows without issuing requests', async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error('Unexpected Google API call'); };
  try {
    for (const range of ['Lessons!C37:D37', 'Lessons!C37garbage', 'Lessons!C37:C38', 'Lessons!C1', 'Lessons!C0', 'Lessons!C-3']) {
      const result = await updateGoogleSheetCell('sheet123', range, 'Completed', 'token123');
      assert.equal(result.ok, false, `Expected rejection for ${range}`);
      assert.match(result.error || '', /Blocked write to range/);
    }
    assert.equal(requests, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('syncLessonCompletionToGoogle formats requests correctly when access token and verified identity are provided', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const destinationReceipts = [];

  globalThis.fetch = (async (url, init) => {
    const urlStr = url.toString();
    calls.push({
      url: urlStr,
      method: init?.method || 'GET',
      body: init?.body ? JSON.parse(init.body) : null
    });

    if (decodeURIComponent(urlStr).includes('/values/Lessons!C37:G37')) {
      return new Response(JSON.stringify({ values: [['Scheduled', '', '', '', 'student-123']] }), { status: 200 });
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
      onDestinationSynced: async (dest, details) => {
        destinationReceipts.push({ dest, details });
      }
    });

    assert.equal(result.ok, true);
    assert.equal(result.status, 'synced');
    assert.equal(calls.length, 3); // Verify C37:G37, Lessons Sheet status, Calendar Event

    // Verify identity read
    assert.match(decodeURIComponent(calls[0].url), /values\/Lessons!C37:G37/);
    assert.equal(calls[0].method, 'GET');

    // Verify Lessons Sheet status update (Column C)
    assert.match(decodeURIComponent(calls[1].url), /values\/Lessons!C37/);
    assert.equal(calls[1].method, 'PUT');
    assert.deepEqual(calls[1].body.values, [['Completed']]);

    // Verify Google Calendar event patch
    assert.match(calls[2].url, /calendars\/cal123\/events\/event456/);
    assert.equal(calls[2].method, 'PATCH');
    assert.equal(calls[2].body.summary, '[Completed] IB Biology');

    // Verify incremental receipts were called twice (sheets, then calendar)
    assert.equal(destinationReceipts.length, 2);
    assert.equal(destinationReceipts[0].dest, 'sheets');
    assert.equal(destinationReceipts[0].details.sheetsSynced, true);
    assert.equal(destinationReceipts[1].dest, 'calendar');
    assert.equal(destinationReceipts[1].details.calendarSynced, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('syncLessonCompletionToGoogle enforces strict synthetic sandbox resource match when sandboxOnly is enabled', async () => {
  const resultMismatch = await syncLessonCompletionToGoogle({
    spreadsheetId: 'production-sheet-id',
    calendarId: 'sandbox-calendar-id',
    accessToken: 'mock-token',
    lessonRowIndex: 2,
    expectedStudentId: 'QA-STUDENT-001',
    calendarEventId: '337a0n0hecsrq55ps7bcrjnp18',
    sandboxOnly: true,
    allowedSpreadsheetId: 'allowed-sandbox-sheet-id',
    allowedCalendarId: 'sandbox-calendar-id'
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

    if (decodeURIComponent(urlStr).includes('/values/Lessons!C37:G37')) {
      return new Response(JSON.stringify({ values: [['Completed', '', '', '', 'student-123']] }), { status: 200 });
    }
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
    assert.equal(calls.length, 2); // Pre-flight C37:G37 verify read + Calendar PATCH
    assert.match(decodeURIComponent(calls[0].url), /values\/Lessons!C37:G37/);
    assert.match(calls[1].url, /calendars\/cal123\/events\/event456/);
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
