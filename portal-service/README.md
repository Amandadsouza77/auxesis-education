# Auxesis Portal Service

Production backend for the Auxesis Cloudflare Pages portal. The public website stays at its existing address. Floot provides managed PostgreSQL, private object storage and brokered Google identity; Cloudflare Pages Functions own the first-party session cookie and proxy authenticated requests. The prototype remains separate.

Only explicitly invited accounts are admitted. All records and file requests are authorized server-side; snapshots are filtered by family and role before leaving the service. No sample families are deployed.

Live service: https://auxesis-portal-service.floot.app
Floot project: 8ccfb85d-97a5-4359-b701-9f9a48672fab

The executable endpoint and helper copies here match the managed service. The managed project also supplies the generated schema/db helper, Google OAuth provider and service SDKs; they are not built by the static website. Changes to the service must be applied and published in that project. Website deployment runs `python3 scripts/build.py`, including the portal route builder.

Run local checks with `node --test tests/*.test.mjs` and `python3 scripts/check_site.py` after building. The backend workflow test runs through Floot's project VM and uses explicitly marked temporary QA records. Remove those fixtures and test sessions before release. Do not run destructive QA cleanup against populated production data.

The portal uses Google identity for invited emails, rather than the prototype's demonstration email-link flow. Invitations are prepared for Amanda to copy and send. Notifications are saved in the portal and delivered live while it is open; automatic notification email requires a verified sender domain. Transfers and PayPal are external payment methods; the portal does not connect to bank accounts.

## Private import review

The settings record's `reviewMode` flag pauses family sign-in and invitation creation. Importing student and parent records does not create login accounts or acknowledge policies. Source billing rows, archived invoice entries and review flags remain owner-only. Imported invoices marked `importReview` cannot be issued or have payments changed until reconciliation. Imported historical receipts do not purchase lessons; verified opening balances are recorded separately, and unverified balances display "To review".

Amanda can select **View as student** or **View as parent** from a student record. The first-party proxy forwards `x-auxesis-preview-role` and `x-auxesis-preview-student` alongside the existing HttpOnly session. The backend requires an actual administrator and uses the same role and family filters as genuine accounts. Preview headers do not grant identity or switch the stored session. Command and upload endpoints reject preview writes. Onboarding can be stepped through locally without saving acknowledgements. **Return to Amanda's workspace** removes the preview scope.

Run the additional import render checks with `PORTAL_REVIEW_FIXTURE_PATH=/absolute/path/to/private-payload.json node --test tests/*.test.mjs`. Keep private payloads outside the repository. The optional `tests/portal-review-browser.mjs` uses Playwright with the same external fixture and a local server at port 8080; it checks navigation and overflow at mobile and desktop widths. It requires an installed Chromium executable.

## Synchronization pilot

The existing portal has a pilot-scoped `portal/sync` endpoint. Calendar controls exact occurrence times and cancellations; the Student Tracker controls business arrangements, attendance and teaching notes. Source mappings, account identity and pilot selection are held only in private server settings. Repository tests use synthetic identities.

Existing records are updated by Calendar occurrence ID. Preparation, resources, opening balances, schedule history and cancellation evidence are preserved. Repeated snapshots update no lessons. Missing events are not assumed cancelled, and ambiguous matches are held for review. No purchases or attendance debits are replayed. The runner reads source data without writing Calendar or Sheets.

Eight occurrences passed a connected-source pilot and a repeat pass updated zero lessons. Family previews showed the expected records and non-pilot data checksums were unchanged. Direct Google consent and permission to the existing Tracker file are still required; the drive.file integration may need Google Picker and its separately configured API key. Do not describe the connected-snapshot pilot as continuous or two-way synchronization.

No scheduled job or wider rollout is enabled. Family access remains in private review. Publish the Floot service before deploying the companion Cloudflare interface change. After publication and consent, run the direct Google pilot twice and verify current source data, cancellation retention, family isolation and zero repeat changes before rollout.

Local checks: 41 tests pass; one existing private-fixture test is skipped. Managed backend typecheck is clean.
