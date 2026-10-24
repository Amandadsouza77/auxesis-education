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
  if (!calendarId) {
    return { ok: false, error: 'Missing calendarId for read-only query.' };
  }

  let activeToken = accessToken;
  let newAccessToken: string | undefined;
  if (!activeToken && refreshToken && clientId && clientSecret) {
    const refreshed = await refreshGoogleAccessToken(refreshToken, clientId, clientSecret);
    if (refreshed.ok && refreshed.accessToken) {
      activeToken = refreshed.accessToken;
      newAccessToken = activeToken;
    }
  }
  if (!activeToken) {
    return { ok: false, error: 'No Google access token available for read-only query.' };
  }

  const MAX_PAGES = 10;

  const queryAllPages = async (token: string) => {
    const allEvents: CalendarEventRead[] = [];
    let pageToken: string | undefined = undefined;
    let pageCount = 0;

    while (pageCount < MAX_PAGES) {
      pageCount++;
      const params = new URLSearchParams({
        singleEvents: 'true',
        orderBy: 'startTime'
      });
      if (timeMin) params.set('timeMin', timeMin);
      if (timeMax) params.set('timeMax', timeMax);
      if (pageToken) params.set('pageToken', pageToken);

      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;

      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
          return { ok: false, status: res.status, error: `Google Calendar API read error on page ${pageCount} (${res.status})` };
        }

        const data = (await res.json()) as any;
        if (!data || typeof data !== 'object') {
          return { ok: false, status: 500, error: `Malformed Google Calendar response on page ${pageCount}.` };
        }

        if (data.items !== undefined && !Array.isArray(data.items)) {
          return { ok: false, status: 500, error: `Malformed Google Calendar items on page ${pageCount}.` };
        }
        if (data.nextPageToken !== undefined && typeof data.nextPageToken !== 'string') {
          return { ok: false, status: 500, error: `Malformed Google Calendar nextPageToken on page ${pageCount}.` };
        }
        const items = data.items || [];
        for (const item of items) {
          if (!item || typeof item !== 'object') continue;
          allEvents.push({
            id: String(item.id || ''),
            summary: String(item.summary || ''),
            start: String(item.start?.dateTime || item.start?.date || ''),
            end: String(item.end?.dateTime || item.end?.date || ''),
            status: String(item.status || 'confirmed')
          });
        }

        pageToken = data.nextPageToken;
        if (!pageToken) {
          break;
        }
        if (pageCount >= MAX_PAGES) {
          return { ok: false, status: 500, error: 'Calendar result exceeded safe pagination limit; read is incomplete.' };
        }
      } catch (err: any) {
        return { ok: false, status: 500, error: 'Network error fetching live Google Calendar events.' };
      }
    }

    return { ok: true, status: 200, events: allEvents };
  };

  let res = await queryAllPages(activeToken);

  if (!res.ok && res.status === 401 && refreshToken && clientId && clientSecret) {
    const refresh = await refreshGoogleAccessToken(refreshToken, clientId, clientSecret);
    if (refresh.ok && refresh.accessToken) {
      activeToken = refresh.accessToken;
      newAccessToken = activeToken;
      res = await queryAllPages(activeToken);
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
