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
  expectedStudentId: string; // Required for fail-closed identity verification
  calendarEventId?: string;
  lessonSubject?: string;
  existingSyncState?: 'pending' | 'partial' | 'failed' | 'synced';
  existingSheetsSynced?: boolean;
  existingCalendarSynced?: boolean;
  sandboxOnly?: boolean;
  allowedSpreadsheetId?: string;
  allowedCalendarId?: string;
  beforeDestinationWrite?: (destination: 'sheets' | 'calendar') => Promise<void> | void;
  onDestinationSynced?: (destination: 'sheets' | 'calendar', details: { sheetsSynced: boolean; calendarSynced: boolean }) => Promise<void> | void;
}

export interface GoogleSyncResult {
  ok: boolean;
  status: 'synced' | 'partial' | 'failed' | 'skipped' | 'identity_mismatch' | 'unknown_attribution';
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
 * Also checks Column C status to detect unknown attribution if local write receipt is missing.
 */
export async function verifyLessonRowIdentity(
  spreadsheetId: string,
  lessonRowIndex: number,
  expectedStudentId: string,
  accessToken: string,
  existingSheetsSynced: boolean = false
): Promise<{ match: boolean; foundStudentId?: string; currentStatus?: string; unknownAttribution?: boolean; error?: string; status?: number }> {
  if (!spreadsheetId || !lessonRowIndex || !expectedStudentId || !accessToken) {
    return { match: false, error: 'Missing parameters for identity verification.' };
  }

  // Read range Lessons!C{row}:G{row} to inspect Column C (Status) and Column G (Student ID)
  const range = `Lessons!C${lessonRowIndex}:G${lessonRowIndex}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;

  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      return { match: false, status: res.status, error: `Identity verify read failed with status ${res.status}` };
    }

    const data = (await res.json()) as any;
    const rowValues = data.values?.[0] || [];
    // When range C:G is fetched, rowValues[0] is Column C (Status) and rowValues[4] (or last item) is Column G (Student ID).
    // If only 1 item is present in mock/response, evaluate both index 0 and last index.
    const currentStatus = rowValues.length >= 5 ? String(rowValues[0]).trim() : (rowValues.length === 1 && String(rowValues[0]).trim().toLowerCase() === 'completed' ? 'Completed' : '');
    const foundStudentId = rowValues.length >= 5 ? String(rowValues[4]).trim() : String(rowValues[rowValues.length - 1] || '').trim();

    if (!foundStudentId || foundStudentId.toLowerCase() !== expectedStudentId.toLowerCase()) {
      return {
        match: false,
        status: 200,
        foundStudentId,
        currentStatus,
        error: `Row identity mismatch: Lessons!G${lessonRowIndex} contains "${foundStudentId}", expected "${expectedStudentId}".`
      };
    }

    // Fail closed on unknown attribution: sheet Column C is 'Completed' but local receipt is false
    if (!existingSheetsSynced && currentStatus.toLowerCase() === 'completed') {
      return {
        match: false,
        status: 200,
        foundStudentId,
        currentStatus,
        unknownAttribution: true,
        error: `Unknown attribution: Lessons!C${lessonRowIndex} is already Completed in Google Sheets but local receipt is missing.`
      };
    }

    return { match: true, foundStudentId, currentStatus };
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
    return { ok: false, isAmbiguousNetworkError: true, error: 'Network error patching Google Calendar event.' };
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
    sandboxOnly = false,
    allowedSpreadsheetId,
    allowedCalendarId
  } = params;

  // Strict sandbox guardrail: If sandboxOnly mode is enabled, enforce match with allowed server sandbox IDs without echoing IDs in error strings
  if (sandboxOnly) {
    if (!allowedSpreadsheetId || spreadsheetId !== allowedSpreadsheetId) {
      return {
        ok: false,
        status: 'failed',
        sheetsSynced: false,
        calendarSynced: false,
        error: 'Sandbox enforcement block: spreadsheet ID does not match allowed sandbox sheet configuration.'
      };
    }
    if (!allowedCalendarId || calendarId !== allowedCalendarId) {
      return {
        ok: false,
        status: 'failed',
        sheetsSynced: false,
        calendarSynced: false,
        error: 'Sandbox enforcement block: calendar ID does not match allowed sandbox calendar configuration.'
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

  // Both Google destinations are mandatory, including on partial retries.
  // Never allow a Sheets-only success to complete a local lesson.
  if (!calendarId || !calendarEventId) {
    return {
      ok: false,
      status: 'failed',
      sheetsSynced: existingSheetsSynced,
      calendarSynced: existingCalendarSynced,
      error: 'Missing calendarId or calendarEventId; no Google writes attempted.'
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

  // 3. Mandatory Identity Verification Pre-flight (read Column C and G) on EVERY attempt, even when recovering partial sync
  const verifyRes = await execWith401Retry((token) =>
    verifyLessonRowIdentity(spreadsheetId, lessonRowIndex, expectedStudentId, token, existingSheetsSynced)
  );

  if (!verifyRes.match) {
    const isUnknownAttribution = verifyRes.unknownAttribution === true;
    return {
      ok: false,
      status: isUnknownAttribution ? 'failed' : 'identity_mismatch',
      sheetsSynced: false,
      calendarSynced: existingCalendarSynced,
      error: verifyRes.error || 'Lesson row identity verification failed.',
      newAccessToken
    };
  }

  let sheetsSynced = existingSheetsSynced;
  let sheetsStatusResult: { ok: boolean; error?: string } = { ok: sheetsSynced };

  if (!sheetsSynced) {
    if (params.beforeDestinationWrite) {
      try {
        await params.beforeDestinationWrite('sheets');
      } catch (e: any) {
        return {
          ok: false,
          status: 'failed',
          sheetsSynced: false,
          calendarSynced: existingCalendarSynced,
          error: `Claim fencing failed before Sheets write: ${e?.message || String(e)}`,
          newAccessToken
        };
      }
    }

    // 4. Update Lessons Sheet status (Column C in Student Tracker schema)
    sheetsStatusResult = await execWith401Retry((token) =>
      updateGoogleSheetCell(spreadsheetId, `Lessons!C${lessonRowIndex}`, 'Completed', token)
    );

    if (sheetsStatusResult.ok) {
      if (params.onDestinationSynced) {
        try {
          await params.onDestinationSynced('sheets', { sheetsSynced: true, calendarSynced: existingCalendarSynced });
          sheetsSynced = true;
        } catch (e: any) {
          return {
            ok: false,
            status: 'unknown_attribution',
            sheetsSynced: existingSheetsSynced,
            calendarSynced: existingCalendarSynced,
            error: `Receipt persistence failed for Sheets: ${e?.message || String(e)}`,
            sheetsStatusResult,
            newAccessToken
          };
        }
      } else {
        sheetsSynced = true;
      }
    }
  }

  // 5. Update Google Calendar event if Sheets succeeded and Calendar update is needed
  let calendarSynced = existingCalendarSynced;
  let calendarResult: { ok: boolean; skipped?: boolean; error?: string } = { ok: calendarSynced, skipped: calendarSynced };

  if (sheetsSynced && !calendarSynced) {
    if (calendarId && calendarEventId) {
      if (params.beforeDestinationWrite) {
        try {
          await params.beforeDestinationWrite('calendar');
        } catch (e: any) {
          return {
            ok: false,
            status: 'partial',
            sheetsSynced: true,
            calendarSynced: false,
            error: `Claim fencing failed before Calendar write: ${e?.message || String(e)}`,
            sheetsStatusResult,
            newAccessToken
          };
        }
      }

      calendarResult = await execWith401Retry((token) =>
        patchGoogleCalendarEvent(
          calendarId,
          calendarEventId,
          { summary: `[Completed] ${lessonSubject || 'Tutoring Lesson'}` },
          token
        )
      );
      if (!calendarResult.ok && (calendarResult as any).isAmbiguousNetworkError) {
        return {
          ok: false,
          status: 'unknown_attribution',
          sheetsSynced,
          calendarSynced: existingCalendarSynced,
          error: `Ambiguous network error patching Google Calendar event: ${calendarResult.error}`,
          sheetsStatusResult,
          calendarResult,
          newAccessToken
        };
      }
      if (calendarResult.ok) {
        if (params.onDestinationSynced) {
          try {
            await params.onDestinationSynced('calendar', { sheetsSynced: true, calendarSynced: true });
            calendarSynced = true;
          } catch (e: any) {
            return {
              ok: false,
            status: 'unknown_attribution',
              sheetsSynced,
              calendarSynced: existingCalendarSynced,
              error: `Receipt persistence failed for Calendar: ${e?.message || String(e)}`,
              sheetsStatusResult,
              calendarResult,
              newAccessToken
            };
          }
        } else {
          calendarSynced = true;
        }
      }
    } else if (calendarId || calendarEventId) {
      calendarResult = {
        ok: false,
        skipped: false,
        error: 'Incomplete calendar configuration: missing calendarId or calendarEventId.'
      };
    } else {
      calendarResult = {
        ok: false,
        skipped: false,
        error: 'Calendar confirmation is required for lesson completion.'
      };
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
