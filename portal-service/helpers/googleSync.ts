// Google Sheets & Calendar Direct Write Integration Helper
// Supports updating Google Sheets (Student Tracker) and Google Calendar events

export interface GoogleSyncOptions {
  accessToken?: string;
  spreadsheetId?: string;
  calendarId?: string;
}

/**
 * Updates a single range in Google Sheets via REST API v4.
 * Uses stable range coordinates (e.g. "Lessons!E37") or value search.
 */
export async function updateGoogleSheetCell(
  spreadsheetId: string,
  range: string,
  value: string | number,
  accessToken: string
): Promise<{ ok: boolean; updatedCells?: number; error?: string }> {
  if (!spreadsheetId || !accessToken) {
    return { ok: false, error: 'Missing spreadsheetId or Google accessToken' };
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: [[value]]
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Google Sheets API error (${res.status}): ${errText}` };
    }

    const data = (await res.json()) as any;
    return { ok: true, updatedCells: data.updatedCells || 1 };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Network error updating Google Sheets' };
  }
}

/**
 * Patches a Google Calendar event summary or status via REST API v3.
 */
export async function patchGoogleCalendarEvent(
  calendarId: string,
  eventId: string,
  updates: { summary?: string; description?: string; colorId?: string },
  accessToken: string
): Promise<{ ok: boolean; error?: string }> {
  if (!calendarId || !eventId || !accessToken) {
    return { ok: false, error: 'Missing calendarId, eventId, or accessToken' };
  }

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Google Calendar API error (${res.status}): ${errText}` };
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Network error patching Google Calendar event' };
  }
}

/**
 * Synchronizes a lesson completion event to both Google Sheets and Google Calendar.
 * Handles errors gracefully without crashing local transactions.
 */
export async function syncLessonCompletionToGoogle(params: {
  spreadsheetId?: string;
  calendarId?: string;
  accessToken?: string;
  lessonRowIndex?: number;
  studentRowIndex?: number;
  newUsedCount?: number;
  calendarEventId?: string;
  lessonSubject?: string;
}): Promise<{ ok: boolean; sheetsResult?: any; calendarResult?: any; error?: string }> {
  const {
    spreadsheetId,
    calendarId,
    accessToken,
    lessonRowIndex,
    studentRowIndex,
    newUsedCount,
    calendarEventId,
    lessonSubject
  } = params;

  if (!accessToken) {
    return { ok: false, error: 'No Google access token configured; external sync skipped.' };
  }

  let sheetsResult: any = { ok: true };
  let calendarResult: any = { ok: true };

  // 1. Update Lessons Sheet status if row index is known
  if (spreadsheetId && lessonRowIndex && lessonRowIndex > 1) {
    sheetsResult = await updateGoogleSheetCell(
      spreadsheetId,
      `Lessons!E${lessonRowIndex}`,
      'Completed',
      accessToken
    );
  }

  // 2. Update Students Sheet used balance count if student row index is known (Used column is Column O / 15 or target range)
  // Used lessons column in Student Tracker is column O (e.g. Students!O)
  if (spreadsheetId && studentRowIndex && studentRowIndex > 1 && typeof newUsedCount === 'number') {
    const studentBalanceRes = await updateGoogleSheetCell(
      spreadsheetId,
      `Students!O${studentRowIndex}`,
      newUsedCount,
      accessToken
    );
    if (!studentBalanceRes.ok) {
      sheetsResult = studentBalanceRes;
    }
  }

  // 3. Patch Google Calendar event if calendarId & eventId are available
  if (calendarId && calendarEventId) {
    calendarResult = await patchGoogleCalendarEvent(
      calendarId,
      calendarEventId,
      { summary: `[Completed] ${lessonSubject || 'Tutoring Lesson'}` },
      accessToken
    );
  }

  const ok = sheetsResult.ok && calendarResult.ok;
  return {
    ok,
    sheetsResult,
    calendarResult,
    error: !ok ? (sheetsResult.error || calendarResult.error) : undefined
  };
}
