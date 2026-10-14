# Auxesis synchronization repair — October 14, 2026

Continue this project; do not restart. The managed backend is authoritative for portal service code and is newer than repository copies. Do not follow the obsolete copy-over instructions in LAUNCH_FUNCTIONALITY.md without comparing files.

## Confirmed
- Original Tracker is configured: 1UrdpPD4AWU1H1Ok7Txb-sL1hIXoIEVN8u--8fZqXwUQ. The October 14 backup was neither read nor connected.
- Existing calendar: classroom107924035776692772286@group.calendar.google.com (Amanda's Tutoring). No calendar or event writes.
- Existing Floot service/project: https://auxesis-portal-service.floot.app / 8ccfb85d-97a5-4359-b701-9f9a48672fab.
- Andie-only pilot remains; reviewMode=true, only one enabled admin account, no family accounts/invitations.
- Live anonymous state requests return 401 at both service and Cloudflare boundary.
- 15 portal students are now present; previous 14-student handoff is obsolete.

## Faults and blockers
- oauth_access_token has zero rows: portal Google consent is incomplete despite the connected chat tools having source access. Do not transfer connector credentials.
- Original Lessons Student IDs are missing or cross-assigned: Andie's Oct 13 (row 37) and Oct 14 (row 40) have no ID; Oct 20 row 52 has Lara's ID. Andie ID appears on unrelated rows (e.g. Maya Hassan row 5, Nina row 13, Ari row 18, Fern row 22). Do not automatically repair all source identities from names.
- Tracker confirms Oct 13 cancelled/no charge and Oct 14 completed, 6:30–7:30 AM Toronto in Calendar. Portal retains Oct 13 Scheduled and Oct 14 Scheduled at 4:45 AM.
- Oct 14 now uses standalone Calendar event 6osm2e1mc4oj0b9n6ksjgb9kckp36b9p6pgm4b9p6phjgc9p6cp3gpj6cg, whereas portal links old recurring occurrence c5h36dph71gmabb5c5gj6b9k68sj8bb1cko3gb9n6ssj6c9n70om6opn68_20261014T084500Z. Needs an evidence-backed replacement mapping before apply; do not create another lesson.
- Frontend has no Google connection or source-sync controls; backend routes existed but Cloudflare proxy omitted them. New allowlist enables sync, google/start, google/picker; UI/Picker completion remains outstanding.
- Legacy source_snapshot applied partial changes despite reported conflicts; corrected.
- Production homepage exposed two portal links. Removed shared header/footer links in website source.
- Shell HTTP proxy is unreachable; network checks used the existing Floot VM. No credentials configured in this environment.

## Exact changes
Managed backend (published October 14):
- helpers/syncPlan.tsx: planners now provide current student roster; reject pilot name assigned another ID or pilot ID naming another known student. Unknown surname changes retain stable-ID behavior.
- helpers/portalSyncPlan.tsx: same identity checks; cancellation cannot overwrite completed/no-show attendance.
- endpoints/portal/source_snapshot_POST.ts: conflict summaries can be dry-run but cannot apply.
- helpers/portalCore.tsx: pilot complete/noShow operations use source attendance, preventing manual deductions while source sync is stale.
- helpers/octoberSyncSafety.spec.tsx: five safety cases.
Checkpoint fe4b56b4-6615-4482-8924-90b70c023720. Publish job 369ad8ac-4c76-4c21-94dc-275c00850664 succeeded.

Website:
- templates/components/header.html, footer.html: remove public portal navigation.
- functions/api/portal/[[path]].js: add authenticated POST routes sync, google/start, google/picker.
- tests/portal.test.mjs: authenticated forwarding and anonymous rejection for those routes.

## Tests and limits
- Managed full typecheck clean; five October safety cases plus eight existing permanent-identity cases pass.
- Isolated fixtures use actual October dates, teaching-note/no-charge wording and a correctly mapped lesson. They verify completed/no-charge status, repeat-sync no changes, no source mutation, unchanged purchased/used, and no invoice/payment writes. These are not successful live synchronization.
- Website build, all six test files and site checker pass (28 HTML files, 524 local links/assets/fragments).
- Baseline record counts: lessons 200/revision sum 208, students 15/19, invoices 16/19, payments 9/9. Andie purchased=8, used=0. No database writes performed.
- No live attendance, billing balances, credentials, events or invitations were modified.
- Authenticated live admin/student/parent rendering not exercised; private family previews have existing local tests. Do not claim family end-to-end synchronization.

## Next command
Continue from docs/SYNC_REPAIR_2026-10-14.md: complete owner-only Google/Picker and sync controls, reconcile original Tracker pilot IDs and the October 14 replacement-event mapping, then preview Andie without applying financial changes or inviting users.

