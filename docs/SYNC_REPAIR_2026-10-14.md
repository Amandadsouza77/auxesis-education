# Auxesis synchronization repair — October 14, 2026

## Current continuation status (14:50 UTC)

Continue the existing project. The managed Floot backend is authoritative and newer than repository backend copies. Never copy the old portal-service directory over it. Read current managed file versions before further changes.

Implementation is saved in Floot preview and a frontend continuation branch. It is **not deployed**. Floot's daily build-action limit was reached when requesting final typecheck/tests, and resets October 14 at 17:00 UTC. Do not report completed live synchronization.

## Sources and identity repairs

- Original Tracker only: https://docs.google.com/spreadsheets/d/1UrdpPD4AWU1H1Ok7Txb-sL1hIXoIEVN8u--8fZqXwUQ/edit. The October 14 backup was neither read nor connected.
- Calendar: classroom107924035776692772286@group.calendar.google.com (Amanda's Tutoring).
- Existing Floot project: 8ccfb85d-97a5-4359-b701-9f9a48672fab; service https://auxesis-portal-service.floot.app.
- Andie ID is 5febba2d-82ee-5585-805f-a3fc5e89f803, verified in Students!S9 with the corresponding student record.
- After the verified snapshot preview passed, repaired **only Lessons!G37 and Lessons!G40** from blank to Andie's ID. Before-write CellData verified no formulas, chips or validation in these target cells. One atomic batch wrote only userEnteredValue. Readback verified both IDs, surrounding dates/status/notes and unchanged Arial cell formatting. No row, column, sheet, balance or financial writes.
- October 13 Lessons row 37: Cancelled; “Holiday cancellation; no charge.” Calendar occurrence 60r3iohi6oq68b9o6srj6b9k61h62b9p70oj4b9m6lijicb4ckqmae9mco_20261013T091500Z is cancelled. Existing portal lesson is 300e998c-60fb-5fd7-b57b-ef631e5a3022.
- October 14 Lessons row 40: Completed; membranes and membrane transport practice. Next-step note explicitly says this was one rescheduled lesson at the 6:30 AM slot, not an additional lesson, with no extra credit owed.
- October 14 old occurrence c5h36dph71gmabb5c5gj6b9k68sj8bb1cko3gb9n6ssj6c9n70om6opn68_20261014T084500Z is cancelled.
- Exact standalone replacement 6osm2e1mc4oj0b9n6ksjgb9kckp36b9p6pgm4b9p6phjgc9p6cp3gpj6cg is confirmed, titled Andie, 2026-10-14T10:30:00Z–11:30:00Z (6:30–7:30 AM Toronto).
- Preview maps that replacement to existing portal lesson 50f5e66f-ae05-51a3-b97a-42d03129c2e5. No duplicate lesson and no Calendar write.
- Broader source identity conflicts remain: October 20 row 52 has Lara's ID; unrelated students carry Andie's ID; other Andie dates have blank IDs. Do not bulk repair identities by names. The full pilot remains blocked; the two-day preview is explicitly scoped and never applies.

## Changes saved in managed preview

Last saved managed version: 1791988861221. These edits followed reads of current managed files, not repository copies.

- helpers/googleConnect.tsx: configured-owner gate on start, authorize, callback, Picker, status, selection and disconnect; rechecks enabled admin and configured googleEmail. One-use handoff/callback flows retained. Wrong-account connection is disconnected. Callback still emits Floot's standard integration message types.
- Existing Picker POST now accepts fileId to verify access to the exact original Tracker; wrong file/backup rejected. It checks Students/Lessons/Billing tab structure. Picker tokens are ephemeral browser memory only, solely for Picker; Google data reads remain server-side.
- New POST endpoints portal/google/status and portal/google/disconnect and their schema files. Status verifies Calendar and original Tracker access and reports Picker setup readiness without returning tokens.
- helpers/readSyncSources.tsx: preserves physical _row numbers before filtering blank rows and can read exact event IDs in addition to paginated Calendar lists.
- helpers/octoberReconciliation.tsx: evidence-checked, two-day preview only. Validates original source IDs, roster identity, exact physical rows, status, full notes, cancellation and replacement times, and existing lesson IDs. Changed evidence blocks all proposals. Produces only existing lesson changes and proposed source ID repairs. Does not change purchases, used counts, balances, payments, invoices, entitlements or Calendar.
- helpers/portalSync.tsx: configured owner only; apply rejected with 403; scopes pilot / october13-14; preview returns details and conflicts. Preview success and failure do not persist sync health, records or audit rows. Two-day scope uses the evidence helper. Full pilot retains strict identity checks.
- helpers/octoberReconciliation.spec.tsx: saved five verified-snapshot regression cases; final managed test run blocked by build limit. Check inferred fixture types during final typecheck.
- The earlier October 14 fixes in syncPlan, portalSyncPlan, portalCore, and source_snapshot remain preserved.

No new checkpoint or publish could be created after the limit was reached. Existing published checkpoint fe4b56b4-6615-4482-8924-90b70c023720 / publish job 369ad8ac-4c76-4c21-94dc-275c00850664 is prior-session work.

## Frontend continuation branch

Branch: codex/owner-google-sync-preview-2026-10-14 (based on current main b1e4c3f1b30864814e7cc54404d051f702258c5b).

- public/portal.js: owner-only Connections & settings panel; Check connection, Authorize/Reconnect, Google Picker selection, Disconnect, October 13–14 preview and full-pilot conflict check. No apply control. Popup messages require exact service origin and the opened window. Account state and preview clear on sign-out/disconnect. Check connection can recover after closing the consent popup.
- functions/api/portal/[[path]].js: authenticated same-origin POST allowlist adds google/status and google/disconnect alongside prior sync/start/picker routes.
- tests/portal.test.mjs: first-party routes, family-view exclusion, popup origin/source checks, and preview-only request payload.
- New pure preview helper copy, verified before/after-ID-repair fixtures, regression tests and scripts/preview_october_reconciliation.mjs. These are a limited new-helper snapshot, not a complete backend mirror.
- docs/SYNC_PREVIEW_2026-10-14.json records the post-ID-repair proposal.

Do not deploy the frontend before publishing and verifying the corresponding backend endpoints. No merge to main is needed until that is done.

## Tests and deployment evidence

- Local npm test: all seven test files pass.
- Local node --check public/portal.js passes.
- Local npm run build and scripts/check_site.py pass: 28 HTML files, 524 local links/assets/fragments.
- Pure verified-snapshot preview passes: two existing lesson updates, no source ID repairs remaining after the two-cell repair, no financial changes; repeated proposed state is idempotent. Changed identity, notes, source, cancellation, missing replacement or duplicate Tracker rows block all proposals.
- Frontend tests verify owner-only rendering, forged popup message rejection and mode=preview.
- Managed checks attached to earlier writes reported googleConnect, portalSync and new endpoints clean. **Final full managed typecheck and tests did not run** because the limit was reached. Re-run them after reset.
- Live read-only checks via Floot VM: website homepage 200 and **still two public portal links**; service /_api/portal/state and Cloudflare /api/portal/state both 401 anonymously.
- Floot get_publish_status confirms service published at its existing URL, with no custom domains. It does not establish that the new preview version is live.
- Main b1e4c3f has no combined commit status entries. Previous Cloudflare deployment completion is unverified; observed live homepage still differs from main's removed header/footer links.
- Portal baseline read before edits: lessons 200/revision sum 208; students 15/19; invoices 16/19; payments 9/9; Andie purchased=8, used=0; one enabled admin; reviewMode=true; oauth_access_token count=0.
- No portal DB write operation, source-sync apply, payment/balance update, family invitation or Calendar mutation was executed. Post-edit database readback is blocked by the same build limit; recheck counts/revisions after reset.
- Local snapshot testing is not live portal OAuth synchronization or family end-to-end testing.

## Blockers

1. Floot daily build limit resets 2026-10-14T17:00:00Z. Final typecheck, managed tests, checkpoint, note update and publish remain pending.
2. Portal owner Google consent is incomplete. Connected chat tools are source evidence only; never transfer connector credentials.
3. Google Picker key missing. Secure request job 00dfd557-4bdc-426c-90be-ecaa33893b6b: https://floot.com/mcp-connect?request=00dfd557-4bdc-426c-90be-ecaa33893b6b. Enable Google Picker API in the owner's Google Cloud project; supply a key restricted to Google Picker API through the secure form only. If expired, re-request it. Do not paste keys into chat.
4. Environment shell proxy is unreachable and no deployment credentials are configured. Do not bypass the proxy. Existing connector tools/Floot VM were used for permitted reads. Cloudflare source-to-live deployment mismatch remains unresolved.
5. Broader Tracker identity conflicts remain. Only rows 37 and 40 were repaired in this continuation.

## Next command

Local reproducible preview (Node 24):

```sh
cd /workspace/auxesis-education
node scripts/preview_october_reconciliation.mjs
```

After 17:00 UTC, start with:
`floot_typecheck({projectId:"8ccfb85d-97a5-4359-b701-9f9a48672fab"})`,
then `floot_run_tests` for helpers/octoberReconciliation.spec.tsx, helpers/octoberSyncSafety.spec.tsx and helpers/studentIdentity.spec.tsx.

Resume prompt:
“Continue Auxesis from docs/SYNC_REPAIR_2026-10-14.md and branch codex/owner-google-sync-preview-2026-10-14. Re-read current Floot files. Finish the managed typecheck/tests and checkpoint; check exact Calendar tombstone reads and fixture types. Verify unchanged DB counts/revisions. Publish only the tested existing backend, then deploy the matching frontend and verify Cloudflare live source. Complete owner Google consent and original Tracker Picker access; run {mode:'preview',scope:'october13-14'} first. Lessons!G37/G40 are already repaired; do not repeat or bulk repair IDs. Keep apply disabled; do not change payments, balances, Calendar events or invite families. Update both handoffs with actual results and remaining blockers.”
