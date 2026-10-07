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


## Verified checkpoint — 7 October 2026

- Branch: `codex/cloudflare-backend-migration`. Production and PR #12 were not changed.
- The failed provisioning run `37629330201` returned Cloudflare HTTP 400. Commit `d71da76` replaced shared parameters in multi-statement migration initialization with fixed statement-local literals. The subsequent run [37629460065](https://github.com/Amandadsouza77/auxesis-education/actions/runs/37629460065) succeeded. Do not rerun the obsolete failing revision.
- Database `auxesis-migration-preview` (`34a9449d-85ee-4f06-a55d-3485905ca64e`) has all three migrations verified and zero business, account, session, Google connection and audit rows. It remains unbound.
- Read-only readiness workflow added at `fdf90db`; [run 37634156114](https://github.com/Amandadsouza77/auxesis-education/actions/runs/37634156114) passed the inventory check. This is an inventory result, not a passing end-to-end sync test.
- The observed migration deployment was active at `https://1f31d04d.auxesis-education.pages.dev`. Preview `PORTAL_DB` and all migration environment variables were absent. Google OAuth client ID/secret, Picker API key/app ID, token key and admin email were also absent from the protected workflow secrets checked by that run.
- Pages preview deployment policy is currently `all`, with included branches `["*"]`. Do not apply a shared preview database binding or credentials without ensuring the migration deployment alone uses them; preserve other previews and production.
- Local validation at `d71da76`: `npm test` passed 60 tests, with one skipped; site build and static checks passed (28 HTML files and 546 local references). These checks used local fixtures, not live Google sync. No Floot infrastructure was used.
- Remaining: securely obtain/configure the existing Google OAuth client and Picker settings, register the migration callback, establish branch-safe preview bindings and variables, then authenticate as the administrator and grant the selected Tracker file. `PORTAL_TOKEN_KEY` can be generated during secure setup; it does not need to be supplied by the user.
- Run the existing Andie-only live sequence above after configuration. Preview/apply/zero-change replay, exact-row note write and restoration, unchanged Calendar checksums and rejection checks are **not yet verified live**.

Resume from this checkpoint and inspect only settings that may have changed. Do not recreate the database, rebuild the migration, merge PR #12, or modify production.
