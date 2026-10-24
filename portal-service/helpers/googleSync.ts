// Google Sheets & Calendar Direct Write Integration Helper
// Supports updating Google Sheets (Student Tracker) and Google Calendar events

export const SYNTHETIC_SANDBOX_SHEET_ID = '1iBKR0IAgdncGsmhcbrKSDrRglkw93gx8p_SSOLQ5SD8';
export const SYNTHETIC_SANDBOX_CALENDAR_ID = 'f4ba076fd0f806830c10a75a946a56dddd51dbbd086348a12619f0a5cae3fce7@group.calendar.google.com';

export interface GoogleSyncParams {
  spreadsheetId?: string;
  calendarId?: string;
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  lessonRowIndex?: number;
  expectedStudentId: string; // Required for fail-closed identity verification
  calendarEventId?: string;
  lessonSubject?: string;
  existingSyncState?: 'pending' | 'partial' | 'failed' | 'synced';
  existingSheetsSynced?: boolean;
  existingCalendarSynced?: boolean;
  sandboxOnly?: boolean;
}

export interface GoogleSyncResult {
  ok: boolean;
  status: 'synced' | 'partial' | 'failed' | 'skipped' | 'identity_mismatch';
  sheetsSynced: boolean;
  calendarSynced: boolean;
  error?: string;
  sheetsStatusResult?: { ok: boolean; error?: string };
  calendarResult?: { ok: boolean; skipped?: boolean; error?: string };
  newAccessToken?: string;
}

/**
 * Refreshes an expired Google OAuth2 access token using a stored refresh_token.
 * Redacts secret token values from any returned or logged errors.
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
      return { ok: false, error: `Google OAuth refresh failed with status ${res.status}` };
    }

    const data = (await res.json()) as any;
    if (!data.access_token) {
      return { ok: false, error: 'Google OAuth refresh response did not contain access_token.' };
    }
    return { ok: true, accessToken: data.access_token };
  } catch (err: any) {
    return { ok: false, error: 'Network error during Google OAuth token refresh.' };
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
): Promise<{ match: boolean; foundStudentId?: string; error?: string; status?: number }> {
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
      return { match: false, status: res.status, error: `Identity verify read failed with status ${res.status}` };
    }

    const data = (await res.json()) as any;
    const foundStudentId = data.values?.[0]?.[0] ? String(data.values[0][0]).trim() : '';

    if (foundStudentId && foundStudentId.toLowerCase() === expectedStudentId.toLowerCase()) {
      return { match: true, foundStudentId };
    }

    return {
      match: false,
      status: 200,
      foundStudentId,
      error: `Row identity mismatch: Lessons!G${lessonRowIndex} contains "${foundStudentId}", expected "${expectedStudentId}".`
    };
  } catch (err: any) {
    return { match: false, error: 'Network error verifying row identity.' };
  }
}

/**
 * Updates a single range in Google Sheets via REST API v4.
 * Strictly enforces target range to Lessons Column C only.
 */
export async function updateGoogleSheetCell(
  spreadsheetId: string,
  range: string,
  value: string | number,
  accessToken: string
): Promise<{ ok: boolean; status?: number; updatedCells?: number; error?: string }> {
  if (!spreadsheetId || !accessToken) {
    return { ok: false, error: 'Missing spreadsheetId or Google accessToken' };
  }

  // Enforce strict Column C target for Lessons status
  if (!/^Lessons!C(?:[2-9]|[1-9]\d+)$/i.test(range)) {
    return { ok: false, error: `Blocked write to range "${range}". Only Lessons!C (Status column) is permitted.` };
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
      return { ok: false, status: res.status, error: `Google Sheets API error (${res.status})` };
    }

    const data = (await res.json()) as any;
    return { ok: true, status: 200, updatedCells: data.updatedCells || 1 };
  } catch (err: any) {
    return { ok: false, error: 'Network error updating Google Sheets.' };
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
): Promise<{ ok: boolean; status?: number; error?: string }> {
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
      return { ok: false, status: res.status, error: `Google Calendar API error (${res.status})` };
    }

    return { ok: true, status: 200 };
  } catch (err: any) {
    return { ok: false, error: 'Network error patching Google Calendar event.' };
  }
}

/**
 * Synchronizes a lesson completion event to both Google Sheets and Google Calendar.
 * Supports per-destination sync recovery, 401 automatic refresh/retry, and fail-closed state tracking.
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
    existingSheetsSynced = false,
    existingCalendarSynced = false,
    sandboxOnly = false
  } = params;

  // Strict sandbox guardrail: If sandboxOnly mode is enabled, enforce exact synthetic resource IDs
  if (sandboxOnly) {
    if (spreadsheetId !== SYNTHETIC_SANDBOX_SHEET_ID) {
      return {
        ok: false,
        status: 'failed',
        sheetsSynced: false,
        calendarSynced: false,
        error: `Sandbox enforcement block: spreadsheetId "${spreadsheetId}" does not match synthetic sandbox sheet ID "${SYNTHETIC_SANDBOX_SHEET_ID}".`
      };
    }
    if (calendarId !== SYNTHETIC_SANDBOX_CALENDAR_ID) {
      return {
        ok: false,
        status: 'failed',
        sheetsSynced: false,
        calendarSynced: false,
        error: `Sandbox enforcement block: calendarId "${calendarId}" does not match synthetic sandbox calendar ID "${SYNTHETIC_SANDBOX_CALENDAR_ID}".`
      };
    }
  }

  let newAccessToken: string | undefined;

  // 1. Fail closed if expectedStudentId is missing
  if (!expectedStudentId) {
    return {
      ok: false,
      status: 'failed',
      sheetsSynced: existingSheetsSynced,
      calendarSynced: existingCalendarSynced,
      error: 'Missing expectedStudentId. Pre-flight identity verification failed closed.'
    };
  }

  // 2. Refresh token if accessToken is absent but refresh credentials exist
  if (!accessToken && refreshToken && clientId && clientSecret) {
    const refreshRes = await refreshGoogleAccessToken(refreshToken, clientId, clientSecret);
    if (refreshRes.ok && refreshRes.accessToken) {
      accessToken = refreshRes.accessToken;
      newAccessToken = accessToken;
    } else {
      return {
        ok: false,
        status: 'failed',
        sheetsSynced: existingSheetsSynced,
        calendarSynced: existingCalendarSynced,
        error: refreshRes.error || 'Initial token refresh failed.'
      };
    }
  }

  if (!accessToken) {
    return {
      ok: false,
      status: 'skipped',
      sheetsSynced: existingSheetsSynced,
      calendarSynced: existingCalendarSynced,
      error: 'No valid Google access token configured; external sync skipped.'
    };
  }

  if (!spreadsheetId) {
    return {
      ok: false,
      status: 'failed',
      sheetsSynced: existingSheetsSynced,
      calendarSynced: existingCalendarSynced,
      error: 'Missing Google Spreadsheet ID for synchronization.'
    };
  }

  if (!lessonRowIndex || lessonRowIndex <= 1) {
    return {
      ok: false,
      status: 'failed',
      sheetsSynced: existingSheetsSynced,
      calendarSynced: existingCalendarSynced,
      error: 'Invalid or missing lesson source row index.'
    };
  }

  // Both Calendar identifiers are mandatory, including on partial retries.
  // Check BEFORE any Sheets write: Sheets-only completion must never report success.
  if (!calendarId || !calendarEventId) {
    return {
      ok: false,
      status: 'failed',
      sheetsSynced: existingSheetsSynced,
      calendarSynced: existingCalendarSynced,
      error: 'Incomplete calendar configuration: both calendarId and calendarEventId are required.'
    };
  }

  // Helper for 401 retry wrapper
  const execWith401Retry = async <T extends { ok: boolean; status?: number }>(
    fn: (token: string) => Promise<T>
  ): Promise<T> => {
    let res = await fn(accessToken!);
    if (!res.ok && res.status === 401 && refreshToken && clientId && clientSecret) {
      const refresh = await refreshGoogleAccessToken(refreshToken, clientId, clientSecret);
      if (refresh.ok && refresh.accessToken) {
        accessToken = refresh.accessToken;
        newAccessToken = accessToken;
        res = await fn(accessToken);
      }
    }
    return res;
  };

  // 3. Mandatory Identity Verification Pre-flight (read Column G) if Sheets write is required
  let sheetsSynced = existingSheetsSynced;
  let sheetsStatusResult: { ok: boolean; error?: string } = { ok: sheetsSynced };

  if (!sheetsSynced) {
    const verifyRes = await execWith401Retry((token) =>
      verifyLessonRowIdentity(spreadsheetId, lessonRowIndex, expectedStudentId, token)
    );

    if (!verifyRes.match) {
      return {
        ok: false,
        status: 'identity_mismatch',
        sheetsSynced: false,
        calendarSynced: existingCalendarSynced,
        error: verifyRes.error || 'Lesson row identity verification failed.',
        newAccessToken
      };
    }

    // 4. Update Lessons Sheet status (Column C in Student Tracker schema)
    sheetsStatusResult = await execWith401Retry((token) =>
      updateGoogleSheetCell(spreadsheetId, `Lessons!C${lessonRowIndex}`, 'Completed', token)
    );

    if (sheetsStatusResult.ok) {
      sheetsSynced = true;
    }
  }

  // 5. Update Google Calendar event if Sheets succeeded and Calendar update is needed
  let calendarSynced = existingCalendarSynced;
  let calendarResult: { ok: boolean; skipped?: boolean; error?: string } = { ok: calendarSynced, skipped: calendarSynced };

  if (sheetsSynced && !calendarSynced) {
    if (calendarId && calendarEventId) {
      calendarResult = await execWith401Retry((token) =>
        patchGoogleCalendarEvent(
          calendarId,
          calendarEventId,
          { summary: `[Completed] ${lessonSubject || 'Tutoring Lesson'}` },
          token
        )
      );
      if (calendarResult.ok) {
        calendarSynced = true;
      }
    }
  }

  const allOk = sheetsSynced && calendarSynced;
  const status = allOk ? 'synced' : sheetsSynced ? 'partial' : 'failed';

  const errors = [
    !sheetsStatusResult.ok ? `Lessons sheet: ${sheetsStatusResult.error}` : '',
    !calendarResult.ok ? `Calendar: ${calendarResult.error}` : ''
  ].filter(Boolean).join(' | ');

  return {
    ok: allOk,
    status,
    sheetsSynced,
    calendarSynced,
    error: errors || undefined,
    sheetsStatusResult,
    calendarResult,
    newAccessToken
  };
}
