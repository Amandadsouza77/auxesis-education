import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchLiveCalendarEvents,
  overlayLiveCalendarToLessons
} from '../portal-service/helpers/calendarReadSync.ts';

test('fetchLiveCalendarEvents handles missing parameters gracefully', async () => {
  const noToken = await fetchLiveCalendarEvents('cal123', '');
  assert.equal(noToken.ok, false);
  assert.match(noToken.error || '', /Missing/);

  const noCal = await fetchLiveCalendarEvents('', 'token123');
  assert.equal(noCal.ok, false);
  assert.match(noCal.error || '', /Missing/);
});

test('fetchLiveCalendarEvents queries Google Calendar API correctly', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = (async (url, init) => {
    calls.push({ url: url.toString(), method: init?.method || 'GET' });
    return new Response(
      JSON.stringify({
        items: [
          {
            id: 'lara-event-id',
            summary: 'Lara Tutoring',
            start: { dateTime: '2026-10-30T09:30:00Z' },
            end: { dateTime: '2026-10-30T10:30:00Z' },
            status: 'confirmed'
          }
        ]
      }),
      { status: 200 }
    );
  });

  try {
    const res = await fetchLiveCalendarEvents(
      'classroom107924035776692772286@group.calendar.google.com',
      'mock-access-token',
      '2026-10-30T00:00:00Z',
      '2026-10-30T23:59:59Z'
    );

    assert.equal(res.ok, true);
    assert.equal(res.events?.length, 1);
    assert.equal(res.events[0].id, 'lara-event-id');
    assert.equal(res.events[0].start, '2026-10-30T09:30:00Z');

    assert.match(calls[0].url, /singleEvents=true/);
    assert.match(calls[0].url, /timeMin=2026-10-30/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('overlayLiveCalendarToLessons updates lesson timing while maintaining permissions and fallback on failure', () => {
  const cachedLessons = [
    {
      id: 'lesson-1',
      studentId: 'lara-id',
      calendarEventId: 'lara-event-id',
      start: '2026-10-30T10:30:00Z', // Stale cached time
      subject: 'IB Biology'
    },
    {
      id: 'lesson-2',
      studentId: 'andie-id',
      calendarEventId: 'andie-event-id',
      start: '2026-10-31T14:00:00Z',
      subject: 'IB Chemistry'
    }
  ];

  const liveEvents = [
    {
      id: 'lara-event-id',
      summary: 'Lara Tutoring',
      start: '2026-10-30T09:30:00Z', // Updated live time (5:30 AM Toronto)
      end: '2026-10-30T10:30:00Z',
      status: 'confirmed'
    }
  ];

  const updated = overlayLiveCalendarToLessons(cachedLessons, liveEvents);

  // Lara's lesson timing reflects live Calendar authority
  assert.equal(updated[0].start, '2026-10-30T09:30:00Z');
  assert.equal(updated[0].liveCalendarOverlay, true);

  // Andie's lesson remains untouched
  assert.equal(updated[1].start, '2026-10-31T14:00:00Z');
  assert.equal(updated[1].liveCalendarOverlay, undefined);

  // Fallback test: Empty or failed API response preserves cached store safely
  const fallback = overlayLiveCalendarToLessons(cachedLessons, []);
  assert.deepEqual(fallback, cachedLessons);
});
