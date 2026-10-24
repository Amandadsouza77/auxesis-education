import test from 'node:test';
import assert from 'node:assert/strict';
import {
  updateGoogleSheetCell,
  patchGoogleCalendarEvent,
  syncLessonCompletionToGoogle
} from '../portal-service/helpers/googleSync.ts';

test('updateGoogleSheetCell rejects execution if credentials or parameters are missing', async () => {
  const noToken = await updateGoogleSheetCell('sheet123', 'Lessons!E37', 'Completed', '');
  assert.equal(noToken.ok, false);
  assert.match(noToken.error || '', /Missing/);

  const noSheet = await updateGoogleSheetCell('', 'Lessons!E37', 'Completed', 'token123');
  assert.equal(noSheet.ok, false);
  assert.match(noSheet.error || '', /Missing/);
});

test('patchGoogleCalendarEvent rejects execution if parameters are missing', async () => {
  const result = await patchGoogleCalendarEvent('cal123', '', { summary: 'Completed' }, 'token123');
  assert.equal(result.ok, false);
  assert.match(result.error || '', /Missing/);
});

test('syncLessonCompletionToGoogle handles missing access token gracefully without throwing', async () => {
  const result = await syncLessonCompletionToGoogle({
    spreadsheetId: 'sheet123',
    calendarId: 'cal123',
    accessToken: undefined,
    lessonRowIndex: 37,
    studentRowIndex: 9,
    newUsedCount: 1,
    calendarEventId: 'event123',
    lessonSubject: 'Biology'
  });

  assert.equal(result.ok, false);
  assert.match(result.error || '', /No Google access token configured/);
});

test('syncLessonCompletionToGoogle formats requests correctly when access token is provided', async () => {
  // Mock global fetch for testing
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = (async (url, init) => {
    calls.push({
      url: url.toString(),
      method: init?.method || 'GET',
      body: init?.body ? JSON.parse(init.body) : null
    });
    return new Response(JSON.stringify({ updatedCells: 1 }), { status: 200 });
  });

  try {
    const result = await syncLessonCompletionToGoogle({
      spreadsheetId: 'sheet123',
      calendarId: 'cal123',
      accessToken: 'mock-token',
      lessonRowIndex: 37,
      studentRowIndex: 9,
      newUsedCount: 5,
      calendarEventId: 'event456',
      lessonSubject: 'IB Biology'
    });

    assert.equal(result.ok, true);
    assert.equal(calls.length, 3); // Lessons Sheet, Students Sheet, Calendar Event

    // Verify Lessons Sheet status update
    assert.match(calls[0].url, /values\/Lessons!E37/);
    assert.equal(calls[0].method, 'PUT');
    assert.deepEqual(calls[0].body.values, [['Completed']]);

    // Verify Students Sheet used count update
    assert.match(calls[1].url, /values\/Students!O9/);
    assert.equal(calls[1].method, 'PUT');
    assert.deepEqual(calls[1].body.values, [[5]]);

    // Verify Google Calendar event patch
    assert.match(calls[2].url, /calendars\/cal123\/events\/event456/);
    assert.equal(calls[2].method, 'PATCH');
    assert.equal(calls[2].body.summary, '[Completed] IB Biology');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
