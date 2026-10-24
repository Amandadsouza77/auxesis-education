// Google Sheets & Calendar Direct Write Integration Helper
// Supports updating Google Sheets (Student Tracker) and Google Calendar events

export interface GoogleSyncParams {
  spreadsheetId?: string;
  calendarId?: string;
  accessToken?: string;
  lessonRowIndex?: number;
  calendarEventId?: string;
  lessonSubject?: string;
  statusColumn?: string; // Correct column for Lessons status is 'C' (Row 1 Header: 'Status')
}

export interface GoogleSyncResult {
  ok: boolean;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  sheetsStatusResult?: { ok: boolean; error?: string };
  calendarResult?: { ok: boolean; error?: string };
}

/**
 * Updates a single range in Google Sheets via REST API v4.
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

  // Prevent writing to known incorrect columns based on Student Tracker live schema:
  // Lessons!E is "Homework / Next Step" (Status is Lessons!C)
  // Students!O is "Oct 25–31 Local Time" and Students!G is "Rate" (no prepaid balance column in Students tab)
  if (/^Lessons!E\d+/i.test(range)) {
    return { ok: false, error: 'Blocked attempt to write status to Lessons!E (Column E is Homework/Next Step; status is Column C).' };
  }
  if (/^Students!(O|G)\d+/i.test(range)) {
    return { ok: false, error: 'Blocked attempt to write balance to Students tab (No prepaid balance column exists in Students tab).' };
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
 * Validates row index and updates Lessons status (Column C) safely.
 */
export async function syncLessonCompletionToGoogle(params: GoogleSyncParams): Promise<GoogleSyncResult> {
  const {
    spreadsheetId,
    calendarId,
    accessToken,
    lessonRowIndex,
    calendarEventId,
    lessonSubject,
    statusColumn = 'C'
  } = params;

  if (!accessToken) {
    return {
      ok: false,
      status: 'skipped',
      error: 'No Google access token configured; external sync skipped.'
    };
  }

  if (!spreadsheetId) {
    return {
      ok: false,
      status: 'failed',
      error: 'Missing Google Spreadsheet ID for synchronization.'
    };
  }

  if (!lessonRowIndex || lessonRowIndex <= 1) {
    return {
      ok: false,
      status: 'failed',
      error: 'Invalid or missing lesson source row index. Identity revalidation required.'
    };
  }

  let sheetsStatusResult: { ok: boolean; error?: string } = { ok: true };
  let calendarResult: { ok: boolean; error?: string } = { ok: true };

  // 1. Update Lessons Sheet status (Column C in Student Tracker schema)
  sheetsStatusResult = await updateGoogleSheetCell(
    spreadsheetId,
    `Lessons!${statusColumn}${lessonRowIndex}`,
    'Completed',
    accessToken
  );

  // 2. Patch Google Calendar event if calendarId & eventId are available
  if (calendarId && calendarEventId) {
    calendarResult = await patchGoogleCalendarEvent(
      calendarId,
      calendarEventId,
      { summary: `[Completed] ${lessonSubject || 'Tutoring Lesson'}` },
      accessToken
    );
  }

  const allOk = sheetsStatusResult.ok && calendarResult.ok;
  const errors = [
    !sheetsStatusResult.ok ? `Lessons sheet: ${sheetsStatusResult.error}` : '',
    !calendarResult.ok ? `Calendar: ${calendarResult.error}` : ''
  ].filter(Boolean).join(' | ');

  return {
    ok: allOk,
    status: allOk ? 'success' : 'failed',
    error: errors || undefined,
    sheetsStatusResult,
    calendarResult
  };
}
