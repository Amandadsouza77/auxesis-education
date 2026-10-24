// Read-only Google Calendar Fetching & Sync Helper for Portal Views
// Fetches live calendar events to ensure portal calendar view reflects Google Calendar scheduling authority

import { refreshGoogleAccessToken } from './googleSync.ts';

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
 * Supports automatic 401 token refresh without leaking secrets.
 */
export async function fetchLiveCalendarEvents(
  calendarId: string,
  accessToken: string,
  timeMin?: string,
  timeMax?: string,
  refreshToken?: string,
  clientId?: string,
  clientSecret?: string
): Promise<{ ok: boolean; events?: CalendarEventRead[]; error?: string; newAccessToken?: string }> {
  if (!calendarId || !accessToken) {
    return { ok: false, error: 'Missing calendarId or Google accessToken for read-only query.' };
  }

  let activeToken = accessToken;
  let newAccessToken: string | undefined;

  const queryEvents = async (token: string) => {
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
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        return { ok: false, status: res.status, error: `Google Calendar API read error (${res.status})` };
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

      return { ok: true, status: 200, events };
    } catch (err: any) {
      return { ok: false, status: 500, error: 'Network error fetching live Google Calendar events.' };
    }
  };

  let res = await queryEvents(activeToken);

  if (!res.ok && res.status === 401 && refreshToken && clientId && clientSecret) {
    const refresh = await refreshGoogleAccessToken(refreshToken, clientId, clientSecret);
    if (refresh.ok && refresh.accessToken) {
      activeToken = refresh.accessToken;
      newAccessToken = activeToken;
      res = await queryEvents(activeToken);
    }
  }

  return {
    ok: res.ok,
    events: res.events,
    error: res.error,
    newAccessToken
  };
}

/**
 * Overlay live Google Calendar event timing and cancellation status onto cached portal lesson records safely.
 * Filters out upcoming/future scheduled lessons for inactive students while preserving historical completed records.
 */
export function overlayLiveCalendarToLessons(
  cachedLessons: any[],
  liveEvents: CalendarEventRead[],
  studentsList: any[] = []
): any[] {
  if (!Array.isArray(cachedLessons)) {
    return cachedLessons;
  }

  const inactiveStudentIds = new Set(
    Array.isArray(studentsList)
      ? studentsList.filter((s) => s.status && String(s.status).toLowerCase() !== 'active').map((s) => s.id)
      : []
  );

  const now = new Date();

  return cachedLessons
    .filter((lesson) => {
      // Rule 1: Exclude upcoming/future scheduled lessons for inactive students from active portal view
      const isInactive = inactiveStudentIds.has(lesson.studentId);
      const isFuture = new Date(lesson.start) > now;
      if (isInactive && isFuture && lesson.status === 'Scheduled') {
        return false;
      }
      return true;
    })
    .map((lesson) => {
      if (!lesson.calendarEventId || !Array.isArray(liveEvents) || liveEvents.length === 0) {
        return lesson;
      }

      const matchedEvent = liveEvents.find((e) => e.id === lesson.calendarEventId);
      if (!matchedEvent) return lesson;

      // Rule 2: Handle live Calendar event cancellation / status change
      if (matchedEvent.status === 'cancelled') {
        return {
          ...lesson,
          status: 'Cancelled',
          cancelledAt: lesson.cancelledAt || new Date().toISOString(),
          calendarSyncedAt: new Date().toISOString(),
          liveCalendarOverlay: true
        };
      }

      // Rule 3: Overlay live start time if different from cached store
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
