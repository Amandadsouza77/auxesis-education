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

test('overlayLiveCalendarToLessons filters inactive student future lessons while preserving history', () => {
  const futureDate = new Date(Date.now() + 86400000 * 10).toISOString();
  const pastDate = new Date(Date.now() - 86400000 * 10).toISOString();

  const students = [
    { id: 'active-student-id', name: 'Active Student', status: 'Active' },
    { id: 'journee-inactive-id', name: 'Journee Belboda', status: 'Ended' }
  ];

  const cachedLessons = [
    { id: 'l1', studentId: 'journee-inactive-id', start: futureDate, status: 'Scheduled', calendarEventId: 'ev1' },
    { id: 'l2', studentId: 'journee-inactive-id', start: pastDate, status: 'Completed', calendarEventId: 'ev2' },
    { id: 'l3', studentId: 'active-student-id', start: futureDate, status: 'Scheduled', calendarEventId: 'ev3' }
  ];

  const liveEvents = [
    { id: 'ev1', summary: 'Journee', start: futureDate, end: futureDate, status: 'confirmed' },
    { id: 'ev2', summary: 'Journee Past', start: pastDate, end: pastDate, status: 'confirmed' },
    { id: 'ev3', summary: 'Active Student', start: futureDate, end: futureDate, status: 'confirmed' }
  ];

  const filtered = overlayLiveCalendarToLessons(cachedLessons, liveEvents, students);

  // Future scheduled lesson for inactive student is filtered out from active schedule
  assert.equal(filtered.length, 2);
  assert.equal(filtered.some((l) => l.id === 'l1'), false);

  // Past completed lesson for inactive student remains preserved for historical audit
  assert.equal(filtered.some((l) => l.id === 'l2'), true);

  // Active student future lesson remains present
  assert.equal(filtered.some((l) => l.id === 'l3'), true);
});

test('overlayLiveCalendarToLessons exposes calendarEventStatus warning on cancellation without mutating Tracker lesson status', () => {
  const cachedLessons = [
    { id: 'l1', studentId: 'active-id', start: '2026-10-30T15:00:00Z', status: 'Scheduled', calendarEventId: 'event-cancelled' }
  ];

  const liveEvents = [
    { id: 'event-cancelled', summary: 'Cancelled Lesson', start: '2026-10-30T15:00:00Z', end: '2026-10-30T16:00:00Z', status: 'cancelled' }
  ];

  const result = overlayLiveCalendarToLessons(cachedLessons, liveEvents);

  // Lesson status from Student Tracker MUST remain Scheduled
  assert.equal(result[0].status, 'Scheduled');
  assert.equal(result[0].calendarEventStatus, 'cancelled');
  assert.equal(result[0].liveCalendarOverlay, true);
});

test('fetchLiveCalendarEvents fails closed on truncated pagination exceeding page limit', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = (async () => {
    calls++;
    return new Response(
      JSON.stringify({
        nextPageToken: `token-page-${calls + 1}`,
        items: [{ id: `ev-${calls}`, summary: `Event ${calls}` }]
      }),
      { status: 200 }
    );
  });

  try {
    const res = await fetchLiveCalendarEvents('cal-id', 'access-token');
    assert.equal(res.ok, false);
    assert.match(res.error || '', /truncated/i);
    assert.equal(calls, 10);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchLiveCalendarEvents handles multi-page pagination and page 2 failures correctly', async () => {
  const originalFetch = globalThis.fetch;
  let pageRequests = 0;

  globalThis.fetch = (async (url, init) => {
    pageRequests++;
    const urlStr = url.toString();
    if (pageRequests === 1) {
      assert.doesNotMatch(urlStr, /pageToken=/);
      return new Response(
        JSON.stringify({
          nextPageToken: 'token-page-2',
          items: [{ id: 'p1-ev1', summary: 'Page 1 Event', start: { dateTime: '2026-10-30T10:00:00Z' } }]
        }),
        { status: 200 }
      );
    } else {
      assert.match(urlStr, /pageToken=token-page-2/);
      return new Response(
        JSON.stringify({
          items: [{ id: 'p2-ev1', summary: 'Page 2 Event', start: { dateTime: '2026-10-30T11:00:00Z' } }]
        }),
        { status: 200 }
      );
    }
  });

  try {
    const res = await fetchLiveCalendarEvents('cal-id', 'access-token');
    assert.equal(res.ok, true);
    assert.equal(res.events?.length, 2);
    assert.equal(res.events[0].id, 'p1-ev1');
    assert.equal(res.events[1].id, 'p2-ev1');
    assert.equal(pageRequests, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchLiveCalendarEvents fails safely when page 2 returns API error', async () => {
  const originalFetch = globalThis.fetch;
  let pageRequests = 0;

  globalThis.fetch = (async (url) => {
    pageRequests++;
    if (pageRequests === 1) {
      return new Response(
        JSON.stringify({
          nextPageToken: 'token-page-2',
          items: [{ id: 'p1-ev1', summary: 'Page 1 Event' }]
        }),
        { status: 200 }
      );
    } else {
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    }
  });

  try {
    const res = await fetchLiveCalendarEvents('cal-id', 'access-token');
    assert.equal(res.ok, false);
    assert.match(res.error || '', /page 2/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
