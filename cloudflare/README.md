# Cloudflare-native portal backend migration

This directory is the reversible replacement path for the Floot runtime.

## Authority boundaries
- Google Calendar: lesson scheduling authority. Calendar access from the portal is read-only.
- Student Tracker (Google Sheets): business/student authority.
- D1: portal-only state, sessions, sync metadata and records that do not belong in either source.
- R2: optional portal attachments only; do not provision it until the attachment inventory proves it is needed.

## Implemented preview boundary
- `functions/api/portal/[[path]].js` terminates in `cloudflare/runtime.js`; it does not proxy to Floot.
- Google sign-in and source authorization use direct OAuth 2.0 with PKCE.
- D1 stores the preview session, encrypted refresh token, portal-only records, operation idempotency and audit rows.
- Calendar access is GET-only and requests `calendar.readonly`.
- Tracker reads use Sheets values endpoints. The only pilot write is an administrator lesson-note update to the exactly matched Andie lesson row.
- A source digest binds every apply to a fresh preview. Conflicts, source changes, ambiguous matches and failed writes retain the current portal record.
- Realtime is replaced by explicit state refresh. Pilot attachments remain disabled because no pilot attachment dependency was established.
- The runtime refuses the production `auxesis-education.pages.dev` hostname.

## Preview deployment sequence
1. Create one preview D1 database and bind it as `PORTAL_DB` to the migration branch only.
2. Apply `0001_portal.sql`, `0002_portal_runtime.sql` and `0003_pilot_runtime.sql` in order.
3. Add the preview-only variables listed in `.env.example`. Secret values are `GOOGLE_CLIENT_SECRET` and `PORTAL_TOKEN_KEY`.
4. Register the branch preview callback URI as `https://<preview-host>/api/portal/auth/callback` in the existing Google OAuth client.
5. Deploy this branch and sign in as `ADMIN_EMAIL`. Select the existing Student Tracker once through Google Picker so `drive.file` grants access.
6. Test Andie Ng only. Preview, apply, then preview again; the second preview must have zero changes.
7. Edit one non-sensitive pilot lesson-note value through the portal, confirm the exact Tracker row changes, restore the original value through the portal, and verify Calendar checksums remain unchanged.
8. Verify rejected non-pilot, ambiguous-row, stale-digest and cross-origin requests. Production and PR #12 remain unchanged.

## Required secrets (preview only)
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_API_KEY
- GOOGLE_APP_ID
- PORTAL_TOKEN_KEY (for encrypting stored Google refresh tokens)

Google OAuth redirect URI should terminate on the Cloudflare preview backend, not Floot.

## Floot dependency inventory
Legacy production dependencies found in PR #12 (not called by the preview runtime):
- Floot-hosted Postgres/Kysely persistence for accounts, sessions, auth flows and portal records.
- @floot/google-integrations for OAuth/token/picker convenience.
- @floot/storage for portal attachments.
- @floot/realtime for live refresh tokens/publish.
- Floot OAuth for existing portal sign-in.
- Cloudflare's current portal function proxies authenticated requests to auxesis-portal-service.floot.app.

Portable without Floot:
- public/portal.js UI.
- readSyncSources source reader (uses standard Google REST endpoints).
- syncPlan and portalSyncPlan reconciliation/guardrails.
- Cloudflare first-party request boundary and cookie pattern, after replacing its remote target.

No production cutover is part of this branch. Do not merge PR #12 or disconnect the production fallback as part of the pilot.
