// Google Sheets & Calendar Direct Write Integration Helper
// Supports updating Google Sheets (Student Tracker) and Google Calendar events

export interface GoogleSyncParams {
  spreadsheetId?: string;
  calendarId?: string;
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  lessonRowIndex?: number;
  expectedStudentId?: string;
  calendarEventId?: string;
  lessonSubject?: string;
  statusColumn?: string; // Correct column for Lessons status is 'C' (Row 1 Header: 'Status')
}

export interface GoogleSyncResult {
  ok: boolean;
  status: 'success' | 'failed' | 'skipped' | 'identity_mismatch';
  error?: string;
  sheetsStatusResult?: { ok: boolean; error?: string };
  calendarResult?: { ok: boolean; error?: string };
}

/**
 * Refreshes an expired Google OAuth2 access token using a stored refresh_token.
 */
export async function refreshGoogleAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ ok: boolean; accessToken?: string; error?: string }> {
  if (!refreshToken || !clientId || !clientSecret) {
    return { ok: false, error: 'Missing OAuth refresh credentials (refreshToken, clientId, clientSecret).' };
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Token refresh failed (${res.status}): ${errText}` };
    }

    const data = (await res.json()) as any;
    return { ok: true, accessToken: data.access_token };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error refreshing Google access token' };
  }
}

/**
 * Verifies that the Student ID in Column G of the target Lessons row matches expectedStudentId before writing.
 */
export async function verifyLessonRowIdentity(
  spreadsheetId: string,
  lessonRowIndex: number,
  expectedStudentId: string,
  accessToken: string
): Promise<{ match: boolean; foundStudentId?: string; error?: string }> {
  if (!spreadsheetId || !lessonRowIndex || !expectedStudentId || !accessToken) {
    return { match: false, error: 'Missing parameters for identity verification.' };
  }

  // Column G in Lessons sheet is Student ID
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(`Lessons!G${lessonRowIndex}`)}`;

  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      return { match: false, error: `Identity verify read failed with status ${res.status}` };
    }

    const data = (await res.json()) as any;
    const foundStudentId = data.values?.[0]?.[0] ? String(data.values[0][0]).trim() : '';

    if (foundStudentId && foundStudentId.toLowerCase() === expectedStudentId.toLowerCase()) {
      return { match: true, foundStudentId };
    }

    return {
      match: false,
      foundStudentId,
      error: `Row identity mismatch: Lessons!G${lessonRowIndex} contains "${foundStudentId}", expected "${expectedStudentId}".`
    };
  } catch (err: any) {
    return { match: false, error: err?.message || 'Network error verifying row identity' };
  }
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

  // Guardrails: Prevent writing to known incorrect columns based on Student Tracker live schema
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
 * Handles token refresh, row identity verification, and explicit status reporting.
 */
export async function syncLessonCompletionToGoogle(params: GoogleSyncParams): Promise<GoogleSyncResult> {
  let {
    spreadsheetId,
    calendarId,
    accessToken,
    refreshToken,
    clientId,
    clientSecret,
    lessonRowIndex,
    expectedStudentId,
    calendarEventId,
    lessonSubject,
    statusColumn = 'C'
  } = params;

  // 1. Attempt token refresh if accessToken is missing or expired, and refresh credentials exist
  if (!accessToken && refreshToken && clientId && clientSecret) {
    const refreshRes = await refreshGoogleAccessToken(refreshToken, clientId, clientSecret);
    if (refreshRes.ok && refreshRes.accessToken) {
      accessToken = refreshRes.accessToken;
    } else {
      return {
        ok: false,
        status: 'failed',
        error: `Token refresh failed: ${refreshRes.error}`
      };
    }
  }

  if (!accessToken) {
    return {
      ok: false,
      status: 'skipped',
      error: 'No valid Google access token configured; external sync skipped.'
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
      error: 'Invalid or missing lesson source row index.'
    };
  }

  // 2. Identity Verification Pre-flight: Check Student ID in Column G if expectedStudentId is supplied
  if (expectedStudentId) {
    const verifyRes = await verifyLessonRowIdentity(spreadsheetId, lessonRowIndex, expectedStudentId, accessToken);
    if (!verifyRes.match) {
      return {
        ok: false,
        status: 'identity_mismatch',
        error: verifyRes.error || 'Lesson row identity verification failed.'
      };
    }
  }

  let sheetsStatusResult: { ok: boolean; error?: string } = { ok: true };
  let calendarResult: { ok: boolean; error?: string } = { ok: true };

  // 3. Update Lessons Sheet status (Column C in Student Tracker schema)
  sheetsStatusResult = await updateGoogleSheetCell(
    spreadsheetId,
    `Lessons!${statusColumn}${lessonRowIndex}`,
    'Completed',
    accessToken
  );

  // 4. Patch Google Calendar event if calendarId & eventId are available
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
