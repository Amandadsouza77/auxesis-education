# Auxesis launch functionality continuation

The website source is prepared for protected public-form delivery through the existing portal service. Public contact is `adsouza35@gmail.com`. With the current unverified sender domain, Floot routes mail to the workspace owner's inbox; a preview send and the provider's delivery status confirmed this route. Do not describe it as delivery to the public Gmail address. A branded sender is optional for initial owner-only notifications.

## Current boundary

- The public form frontend requests a one-use check from `/api/enquiry?delivery=portal&kind=enquiry` (or `kind=review`). It stays disabled with a direct email alternative unless the backend confirms readiness.
- Cloudflare proxies those checks and submissions to the service's `/_api/public/forms` endpoint. The service checks consent, origin, field values, elapsed time, one-use checks, client/email/global limits and the hidden spam field. It sends only to the administrator/workspace owner. Reviews are never published automatically.
- Public indexing remains disabled until production enquiry and review delivery pass.
- Family access remains disabled by `reviewMode`. Do not change that flag until source records, opening balances, paid-through dates and the missing roster entry are reconciled. Do not infer financial balances.
- The latest local/backend source adds verified paid-through access, calendar-month grace periods, intake nationality and optional parent pronouns, package/status arrangement fields and required-value checks. The managed service has only part of this change set: compare and synchronise both helpers before publishing.

## After the Floot action limit resets

1. Open `Amandadsouza77/auxesis-education` at the latest main. Read the current managed project's file versions before editing. Project: `8ccfb85d-97a5-4359-b701-9f9a48672fab`; live service: `https://auxesis-portal-service.floot.app`.
2. Compare and apply the current repository copies of `portal-service/helpers/portalCore.tsx` and `portal-service/helpers/publicForms.tsx` to `helpers/portalCore.tsx` and `helpers/publicForms.tsx`, preserving unrelated newer work. Ensure all six `portal-service/endpoints/public/*` files match their managed paths. Do not blindly overwrite newer edits.
3. Typecheck, create a checkpoint, publish to the existing `auxesis-portal-service` subdomain, poll the publish job and verify production readiness. Preserve the current audience and all account/resource configuration.
4. Test real enquiry and review submissions through the public website proxy with clearly marked QA text. Verify `Reply-To`, delivery status and review moderation. Also test invalid consent/email/Other fields, expired or reused checks, failed delivery and preserved form values. Do not send messages to families. Keep screenshots or proof of published behaviour where useful.
5. Confirm resource access for an unknown paid-through date, an active paid period, expiry, quarterly grace and end-of-tutoring grace. Review parent/student snapshot filtering and the read-only preview write denial. Do not disable family review mode to test.
6. Remove only the explicitly marked synthetic QA submissions/notifications and expired QA sessions; never delete genuine records. A short QA owner session created around `2026-10-04T12:06:20Z`–`12:06:40Z` had a five-minute lifetime and expired automatically. Its cleanup was refused by the action limit. Use `execute_sql` for any cleanup; destructive SQL is not accepted from VM snippets.
7. When real production form delivery passes, enable `content/settings.json` production mode, rebuild, test canonical links/robots/sitemap, publish through the existing repository/Cloudflare flow, and verify the live site. Preserve noindex on private portal/resources/admin paths.
8. Read the current reconciliation register and authoritative Tracker/calendar/invoice/payment evidence. The Tracker has 15 students and the portal import has 14. The opening-balance summary has only three verified balances. Resolve clear evidence and keep conflicting finances pending. The existing separate Hub is out of scope. Maintain the Google Sheet as the durable record.
9. Update the user's Functionality & Launch report with actual published results, exact test limits, remaining blockers and the launch decision. Continue all safe authorised work; do not stop at recommendations or ask Amanda to make routine implementation decisions.

## Checks already completed

Local build and 546 internal links/assets/fragments pass. The current automated suite has 31 passes, no failures and one import-fixture test skipped. JavaScript syntax and diff checks pass. New checks cover one-use proxy behaviour, frontend readiness/submission/failure retention, origin/size rejection, service failure handling, Tracker intake coverage and paid resource windows. A preview enquiry was delivered to the workspace owner's mailbox using the platform sender. Full production delivery and newly changed authenticated backend workflows remain unverified.

The local browser client blocked `localhost:8080`; do not claim browser QA of the new private layouts from that attempted navigation. Verify the published screens or use a permitted preview route. Do not publish the temporary local `__qa` harness.
