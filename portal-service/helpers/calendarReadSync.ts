// Read-only Google Calendar Fetching & Sync Helper for Portal Views
// Fetches live calendar events to ensure portal calendar view reflects Google Calendar scheduling authority

export interface CalendarEventRead {
  id: string;
  summary: string;
  start: string;
  end: string;
  status: string;
}

/**
 * Reads live Google Calendar events for a specific timeframe to overlay schedule changes
 * (e.g. Lara Oct 30 lesson moved to 5:30-6:30 AM Toronto).
 * Read-only: never modifies calendar events or student records.
 */
export async function fetchLiveCalendarEvents(
  calendarId: string,
  accessToken: string,
  timeMin?: string,
  timeMax?: string
): Promise<{ ok: boolean; events?: CalendarEventRead[]; error?: string }> {
  if (!calendarId || !accessToken) {
    return { ok: false, error: 'Missing calendarId or Google accessToken for read-only query.' };
  }

  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime'
  });
  if (timeMin) params.set('timeMin', timeMin);
  if (timeMax) params.set('timeMax', timeMax);

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Google Calendar API read error (${res.status}): ${errText}` };
    }

    const data = (await res.json()) as any;
    const items = Array.isArray(data.items) ? data.items : [];

    const events: CalendarEventRead[] = items.map((item: any) => ({
      id: item.id,
      summary: item.summary || '',
      start: item.start?.dateTime || item.start?.date || '',
      end: item.end?.dateTime || item.end?.date || '',
      status: item.status || 'confirmed'
    }));

    return { ok: true, events };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error fetching live Google Calendar events' };
  }
}

/**
 * Overlay live Google Calendar event timing onto cached portal lesson records safely.
 * Preserves role permissions and student identity while reflecting Google Calendar scheduling authority.
 */
export function overlayLiveCalendarToLessons(
  cachedLessons: any[],
  liveEvents: CalendarEventRead[]
): any[] {
  if (!Array.isArray(cachedLessons) || !Array.isArray(liveEvents) || liveEvents.length === 0) {
    return cachedLessons;
  }

  return cachedLessons.map((lesson) => {
    if (!lesson.calendarEventId) return lesson;

    const matchedEvent = liveEvents.find((e) => e.id === lesson.calendarEventId);
    if (!matchedEvent) return lesson;

    // Overlay live start time if different from cached store
    if (matchedEvent.start && matchedEvent.start !== lesson.start) {
      return {
        ...lesson,
        start: matchedEvent.start,
        calendarSyncedAt: new Date().toISOString(),
        liveCalendarOverlay: true
      };
    }

    return lesson;
  });
}
