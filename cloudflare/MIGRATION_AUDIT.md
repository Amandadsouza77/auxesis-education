# Floot runtime audit

## Replace
| Floot dependency | Cloudflare-native replacement |
|---|---|
| Managed PostgreSQL/Kysely | D1 adapter + migrations |
| Floot OAuth/session handoff | first-party Google identity + D1 sessions |
| @floot/google-integrations | direct Google OAuth 2.0 + REST APIs |
| Floot service URL | same-origin Pages Functions/Workers |
| @floot/realtime | remove; re-fetch state after successful mutation |
| @floot/storage | pending attachment inventory; R2 only if durable files exist |
| @floot/email | existing website mail provider/Cloudflare-side mail adapter; not part of Calendar/Tracker authority |

## Preserve
- Existing portal UI and routes.
- readSyncSources, syncPlan and portalSyncPlan logic/guardrails.
- Google Calendar as scheduling authority.
- Student Tracker as business/student authority.
- One-student pilot guard.

## Floot-only durable-data classes to export before cutover
portalAccounts, portalRecords, portalAudit and durable attachment metadata/content if any. The portalRecords kinds visible in the existing snapshot model include students, parents, lessons, threads, reports, invoices, payments, categories, resources, notifications, onboardings, billingHistory, billingArchive, importReviews, settings and Tracker evidence.

## Do not migrate as durable state
Expired sessions, expired auth flows, realtime tokens, rate-limit buckets and temporary public form challenges.

## Storage decision
R2 is deliberately not provisioned yet. The old core imports Floot storage for portal upload/download, but repository inspection alone cannot prove that durable uploaded objects exist. Inventory objects/attachment references before choosing R2.

## Realtime decision
No dedicated realtime service is required for the migration. The UI can re-fetch state after successful mutations and on navigation. This removes a Floot dependency without changing source-of-truth rules.

## Security invariants
Calendar scope is calendar.readonly and the replacement Google module exposes no Calendar write operation. Tracker selection remains file-scoped via drive.file. OAuth credentials stay server-side. Production is not a migration target.
