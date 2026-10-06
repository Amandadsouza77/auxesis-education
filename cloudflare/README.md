# Cloudflare-native portal backend migration

This directory is the reversible replacement path for the Floot runtime.

## Authority boundaries
- Google Calendar: lesson scheduling authority. Calendar access from the portal is read-only.
- Student Tracker (Google Sheets): business/student authority.
- D1: portal-only state, sessions, sync metadata and records that do not belong in either source.
- R2: optional portal attachments only; do not provision it until the attachment inventory proves it is needed.

## Migration sequence
1. Create a preview-only D1 database and apply migrations/0001_portal.sql.
2. Export Floot portal tables without changing them; inventory portal_records by kind and attachment metadata.
3. Import a copy into preview D1 and compare counts + deterministic checksums.
4. Replace Floot session/auth endpoints with Cloudflare Functions and direct Google OAuth.
5. Port the existing pure sync planners/readers unchanged where practical.
6. Test Andie Ng only. Calendar is read-only. Preview sync twice; second pass must be zero-change.
7. Verify non-pilot checksums unchanged and family isolation.
8. Only after acceptance, plan production cutover. Do not disconnect Floot until rollback testing passes.

## Required secrets (preview only)
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- PORTAL_TOKEN_KEY (for encrypting stored Google refresh tokens)

Google OAuth redirect URI should terminate on the Cloudflare preview backend, not Floot.

## Floot dependency inventory
Current runtime dependencies found in PR #12:
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

No production cutover is part of this branch.
