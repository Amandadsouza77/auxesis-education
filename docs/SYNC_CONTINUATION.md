# Synchronization continuation — 7 October 2026

Continue the existing Cloudflare pilot. Do not recreate its project or database,
rebuild completed artifacts, use Floot, or change the production Portal.
The checkout remains on `codex/auxesis-sync-continuation`, continuing the existing
`origin/codex/cloudflare-backend-migration` checkpoint originally at `0fa7656`.

## Existing work retained

The Cloudflare branch already supplies direct Google OAuth with PKCE, encrypted
refresh-token storage, D1 sessions and records, read-only Calendar access,
file-scoped Tracker access, an Andie-only reconciliation plan, preview/apply
guards, and exact-row lesson-note write-back. The Portal UI is retained.
The existing project is `auxesis-migration-preview`; its stable alias is
`https://codex-cloudflare-backend-mig.auxesis-migration-preview.pages.dev`.
The database, student identity, Tracker, Calendar and recurring-series mappings
remain as recorded in `cloudflare/README.md` and `.env.example`.

## Completed corrections — deployed at `72bf74c`

- Preview digests previously included `timeMin` and `timeMax`, calculated anew
  on each read. Even unchanged sources failed delayed apply. Digests now bind
  source content, Portal revisions **and the resulting reconciliation plan**.
  A window-dependent plan change still rejects an old preview.
- Filtering blank Sheet rows before numbering them produced incorrect source
  row references. Physical row numbers now survive blank rows.
- A failed read left the previous successful preview and its apply button in
  sync health. Authenticated failed attempts now retain business records, save
  an error state and clear apply eligibility. Last-success information remains.
- Source-reader errors carry safe diagnostic codes and actionable messages.
  Structured logs omit request bodies, notes, credentials and provider payloads.
- OAuth callback errors now pass through the existing JSON error boundary.

These corrections were first validated locally and have now been deployed to the
existing isolated preview. No production records, Google business data,
credentials or business rules were changed. Legacy Floot-helper edits started on
`main` were removed before this continuation.

## Validation

Run from `/workspace/auxesis-education`:

```sh
node --test tests/cloudflare-first-sync.test.mjs tests/cloudflare-sync-flow.test.mjs tests/cloudflare-pilot-runtime.test.mjs tests/cloudflare-roster-dry-run.test.mjs tests/cloudflare-roster-review.test.mjs tests/portal.test.mjs tests/cloudflare-ui-migration.test.mjs
git diff --check
```

Current result: **54 passed, 0 failed, 0 skipped** (earlier checkpoints had
17 and 23 passing tests). The new flow tests execute the actual
Pages handler and SQL against an in-memory SQLite database, with synthetic
students and Google HTTP fixtures. They cover delayed preview/apply, zero-change
replay, Portal state, stale-source and window-change rejection, physical row
numbers, Calendar creation/rescheduling/cancellation, preserved balances,
exact-cell note write and restoration, failed-read visibility, invalid OAuth
callbacks, non-pilot rejection and concurrent Tracker-note conflicts.

These include synthetic integration tests; live evidence is distinguished below. Earlier
unchanged build/deployment checks were not repeated. Full-roster synchronization
and unattended automation remain paused under the current Andie-only scope.

## Current checkpoint — remaining 14 students reviewed; no import authorized

### Latest owner confirmation — Nina's regular schedule confirmed separately

Amanda confirmed Nina's regular **Monday 05:15 Toronto** schedule, starting
19 October. This agrees with existing Students row 8. The local proposed review
now supports the seven existing confirmed regular occurrences individually
(19/26 October and 2/9/16/23/30 November), using their exact Calendar event IDs
and actual start/end times. It does not approve the entire mixed-title group:
the original 5/12 October cancellations remain unchanged and the 5 October
replacement date is still unknown. No attendance, charge or balance is inferred.

The owner-confirmed review now has proposals for **13 students** (12 with group
proposals, plus Nina's explicitly scoped regular-occurrence proposals). Mireya's
upcoming Wednesday Tracker log dates versus Thursday Calendar dates remain
unresolved, along with other partial coverage/status items and all 14 balances.
The source-only report/UI remains unchanged at 10 automatically supported
students; the owner-confirmed addendum is outside git. Assertions verified exact
Monday/time/event scope, preserved cancellations/pending date, unchanged other
students and business evidence, and all read-only safeguards. No runtime, live
configuration, Google data, Portal business records or production changes.

### Latest owner confirmation — Nina's 5 October replacement is pending

Amanda confirmed the replacement lesson date is still unknown. Tracker Lessons
row 67 says Rescheduled; the original 5 October Calendar occurrence is cancelled.
These are compatible facts, not a schedule discrepancy. The local review records
replacement date/start/end as null. No replacement event, lesson status, charge
or financial treatment is inferred or changed. The pending makeup is explained;
the regular-series proposal remains separate because the saved source inventory
aggregates `Nina` and `Nina — rescheduled (TBD)` labels for the whole group.

The local proposed-review count remains 12; all 14 balances remain unverified.
The confirmation is retained in the existing external owner-confirmation JSON
and Markdown addendum. No Google read, runtime change, deployment, live mapping,
business-data write or production change was needed.

### Latest owner confirmation — Ari Figgs future series resolved in proposals

Amanda confirmed the `Ari` Monday/Wednesday 16:00 Toronto series belongs to
**Ari Figgs**, existing Students row 11. The specific group is
`series:6pj3ip9o6co32bb26os68b9k70s3cb9o6oom2bb56gqjgor2ccqmcob1c8`:
16 confirmed occurrences from 12 October through 2 December, all 16:00 Toronto
across DST. The Tracker roster already records Monday/Wednesday 16:00.
The confirmation does not extend to Ari's separate earlier two-occurrence group
or approve new lesson-log links, imports, balances or financial changes.

The local owner-confirmed review now supports proposals for **12 students**;
Mireya and Nina remain unresolved, along with other partial coverage/status
items and all 14 opening balances. Maya Hassan's previously confirmed identity
remains intact. Exact-series/time scope, unchanged other students/business
evidence and all read-only safeguards were validated. The same external
`owner-confirmed-mapping-proposals.json` and `OWNER_MAPPING_CONFIRMATIONS.md`
retain both confirmations. No runtime, live diagnostics/configuration, business
records, Google sources or production settings were changed. The saved
Google-only report still records 10 automatically supported students.

### Latest owner confirmation — Maya Hassan identity resolved in proposals

Amanda explicitly confirmed **`Maya gr 11 chem` belongs to Maya Hassan**.
The exact-title confirmation is attached to three retained Calendar groups in
the local proposed review, using existing Students row 14. Those groups are
excluded from Maya Keinan's proposed mapping; her full-name lessons and HOLD
review remain separate. No student IDs or records were created.

The owner-confirmed proposed review now has **11 students with at least one
supported proposal**; Mireya, Nina and Ari still require further evidence or
reconciliation. Other partial coverage/status issues and all 14 unverified
opening balances remain. The saved Google-only report still records 10; it was
not rewritten, and the Portal review UI has not been changed to consume owner
confirmations. Every execution approval remains false, with readOnly true and
canApply false. This is evidence for a future safe review, not a live mapping
or import/configuration change.

Owner evidence and assessed proposals are retained outside git:
`/workspace/auxesis-pilot-evidence/OWNER_MAPPING_CONFIRMATIONS.md` and
`/workspace/auxesis-pilot-evidence/owner-confirmed-mapping-proposals.json`.
Assertions verified exact-title scope, exclusion from Maya Keinan, unchanged
other students' proposals/business evidence, all unverified balances and the
unchanged business-record hash. No runtime changes, deployments, Google reads,
business-data writes or repeated tests were needed.

### Latest owner refresh — Maria/today discrepancy checked

The owner clicked the read-only review again. Its fresh Google source read was
`2026-10-08T05:21:01.306Z` (**01:21 on 8 October in Toronto**).
[Protected readiness run 37715995546, attempt 6](https://github.com/Amandadsouza77/auxesis-education/actions/runs/37715995546/attempts/6)
verified the refreshed saved report, exact unchanged Andie restoration proof,
earlier roster report, business hash and production binding isolation. The fresh
source summary exactly matches the prior corrected assessment: 10 students with
partial supported proposals, all 14 balances unverified, no imports.

For 8 October, Calendar contains six student-labelled lesson entries: Maya Keinan
04:30, Mireya 05:45, Guiliana Stalteri 09:30, Fern 13:00, May 14:30 and the
unresolved `Maya gr 11 chem` label 16:00, all Toronto times. A separate Meet &
Greet is at 20:00. Maya Keinan's actual 04:30 start differs from the original
11:45 start, confirming that existing rescheduled occurrence times are read.
Maria's title-matched series has no occurrence on 8 October; its next is
10 October, 06:30–07:30 Toronto, with unchanged original start. The owner's
reported move is not visible in this connected Calendar inventory. Do not
guess an event identity or change sources to match the report.

The owner subsequently clarified the name as **Maria** and confirmed Maria has
no lesson on 8 October; the six listed Calendar entries are correct. The prior
reported Maria discrepancy is resolved. No screenshot or source change is needed.
This confirms the schedule read, without approving ambiguous full-name Maya
identities, opening balances or imports.
A targeted Maria Tracker check confirms Students row 6 says Sat 06:30 and
Lessons row 76 says 10 October Scheduled. All nine in-window Maria Tracker dates
match Calendar, with zero conflicts. The earlier dry-run mapping warning came
from requiring an approved link or full-name title (`Maria` versus
`Maria Estavillo`); the later review already supports a first-name proposal with
nine date matches. The assistant's separate "today discrepancy" was a mistaken
interpretation, not a Tracker or reader error. No schedule/code change is needed.
Evidence: `/workspace/auxesis-pilot-evidence/maria-schedule-verification.json`.
The regular Portal remains unchanged; isolated preview still imports only Andie.
No new code, deployment, business write or repeated tests were needed.
Detailed evidence is retained outside git at
`/workspace/auxesis-pilot-evidence/TODAY_CALENDAR_CHECK.md` and
`/workspace/auxesis-pilot-evidence/refreshed-calendar-review.json`.

### Completed mapping and balance review

The owner completed the read-only review control. Fresh source evidence was saved
at `2026-10-08T04:38:29.908Z` (**00:38 on 8 October in Toronto**), then exported
losslessly by [protected readiness run 37715995546, attempt 3](https://github.com/Amandadsouza77/auxesis-education/actions/runs/37715995546/attempts/3).
The completed Andie restoration proof, earlier full-roster report and business
record hash remain unchanged. No repeat of either pilot or Google source read
was necessary to complete the review.

Results:

- **10 students have at least one supported, unapproved Calendar proposal**.
  These are partial proposals where other series or standalone events lack
  sufficient evidence; they do not imply full schedule coverage or import readiness.
- **Mireya Borromeo, Nina Mapa, Ari Figgs and Maya Hassan** have no supported
  proposal. Mireya's new Thursday series lacks corroborating Wednesday Tracker
  dates; Nina's group includes rescheduled/TBD evidence; Ari's new series has no
  matching Tracker dates; shared first-name Maya labels remain ambiguous.
- Clara's Monday series has a Calendar-active versus Tracker-Cancelled conflict.
  Maya Keinan's HOLD series remains provisional. Operational invoice reminders
  and wholly cancelled older series are not proposed as current lessons.
- All 14 exact roster names are unique; no Student ID column exists. Identity
  proposals retain the exact existing roster name and physical row reference.
  No non-pilot identity was created, and production identities were not compared.
- **All 14 opening balances remain unverified**. There is no explicit source
  opening/carry-forward/paid-through field. A confirmed cutoff, units and
  reconciled ledger are needed before any future balance approval. Invoice
  quantities minus historical attendance are never treated as balances.
  Paid-versus-received differences may include fees; no payment status or
  billing rule was changed. The literal Maya Hassan discount is retained and
  requires business-rule clarification before a future import.
- The read window covers 1 October–2 December inclusive in Toronto. The full
  Calendar inventory has 184 groups (145 cancelled-history, 4 operational
  reminders, 33 lesson candidates, 2 provisional). These include unrelated
  entries and are not student/lesson counts. Lesson and Billing names have no
  unmatched source aliases in this read.

Revision `7d74464` corrects conservative review classification using the retained
whitelisted evidence. The original saved report remains unchanged; authenticated
admin GET state reassesses it in memory for display, without Google calls or D1
writes. Fresh reviews use the same rules. Operational reminders, HOLD/TBD,
wholly cancelled series, invalid timed intervals and duplicate/status conflicts
cannot become supported current-lesson proposals. The raw saved initial report
count of 11 supported students is superseded by the corrected assessment of 10.
All proposals remain `approved:false`, `readOnly:true`, `canApply:false`.

Affected tests passed locally (21); the required full 54-test suite and existing
preview security/isolation checks passed in [deployment run 37729200000](https://github.com/Amandadsouza77/auxesis-education/actions/runs/37729200000).
The corrected application is deployed only to the existing isolated preview at
`https://f8d4f470.auxesis-migration-preview.pages.dev`, with the same stable alias.
No production merge, automation, imports, credentials, security controls or
source business data were changed. Andie-only write guards remain active.
[Protected readiness run 37715995546, attempt 4](https://github.com/Amandadsouza77/auxesis-education/actions/runs/37715995546/attempts/4)
confirmed the corrected deployed commit, exact equality of the original saved
mapping report and earlier roster report, and exact equality of Andie's completed
restoration proof. Non-pilot students/lessons remain zero; pilot lessons remain
18, with one source apply and two exact-row note saves. Business record hash
remains `61a1474a72ff65e1ad8c04f7ef2470795d446177d69e3987082d9e39f6114c6b`.
Full final verification is saved alongside the report at
`/workspace/auxesis-pilot-evidence/mapping-review-final-verification.json`.

Detailed per-student evidence, exact Calendar IDs/times, physical lesson and
invoice row references, proposed mappings and unresolved items are retained
outside the repository to avoid publishing student business records:

- `/workspace/auxesis-pilot-evidence/MAPPING_BALANCE_REVIEW.md`
- `/workspace/auxesis-pilot-evidence/mapping-balance-review.json` (original read)
- `/workspace/auxesis-pilot-evidence/mapping-review-assessed.json` (corrected review)

The authorized read-only review is complete. No further owner click or Google
authorization is required for it. Do not import records, approve aliases/balances,
enable automation or alter production. A later phase must resolve the documented
ambiguities and obtain verified opening-balance evidence before any separately
authorized safe rollout.

## Completed checkpoint — full active-roster dry run read and verified; no import authorized

The owner clicked **Preview active roster (read-only)**. [Protected read-only
run 37709597195, attempt 3](https://github.com/Amandadsouza77/auxesis-education/actions/runs/37709597195/attempts/3)
completed successfully and exported the saved report without truncation. Its
fresh Google-source read was `2026-10-08T01:45:24.060Z` (**21:45 on 7 October
in Toronto**). Scope remains **dry run only, production unchanged**.

Verified results:

- **15 explicitly Active students** were assessed, against **340 Calendar
  occurrences** in the existing 30 September–1 December Toronto lesson window.
- Andie reuses 18 approved occurrence links and has **zero proposed changes or
  individual source conflicts**. Rate/package/balances, original restored note
  hashes, one source apply and two note-save audits remain identical to baseline.
- Two other students have **23 unapproved title/series candidates** in total;
  12 have no approved link or exact-full-name candidate in this report. Missing
  conservative mappings do not prove that their lessons are absent in Calendar.
- All 14 non-pilot students lack imported records in the isolated preview, as
  intended. Their identity/opening balances require review before any future
  import; these projections do not compare or replace production Portal records.
- There is no Student ID column in the current Tracker roster and no Calendar
  Event ID column in its Lessons tab. Existing approved series mappings remain
  Andie-only. No source columns or source values were added or changed.
- The Students read has 22 nonempty rows: 15 Active plus seven unrecorded or
  non-active-status rows, including time-zone/DST annotations. A general status
  warning currently makes the UI count all 15 as needing review; only **14 have
  individual review issues**. Andie's clean result has not regressed.
- **299 Calendar occurrences** are unassigned by this conservative report;
  these may include other lessons or unrelated entries and are not automatically
  synchronization errors. No event titles/aliases were fabricated or approved.
- The report is `readOnly:true`, `canApply:false`, with no Apply digest. D1
  still has **zero non-pilot students or lessons**, and completed Andie proof
  exactly matches the restoration baseline. Production remains isolated and
  unchanged. No business writes, merges, rebuilds or repeated tests were needed.

Full safe diagnostics, verification assertions and the per-student review table
are preserved outside the checkout in
`/workspace/auxesis-pilot-evidence/latest-roster-report.json` and
`/workspace/auxesis-pilot-evidence/ROSTER_DRY_RUN.md`. Real student fixtures,
contacts, teaching text and credentials are not committed. The application
remains deployed at `a9007c4`; the existing 47 relevant checks already passed.

The authorized dry run is **complete**; no remaining authentication step is
needed for it. Any next phase must preserve the source authority rules and begin
with mapping/identity/balance review. No wider imports, writes, unattended
automation or production rollout have been authorized. Do not repeat the owner
clicks or the completed Andie pilot.

### Completed read-only roster deployment and authenticated read preparation

The owner authorized **full-roster dry run only, production unchanged** after
the completed Andie round trip. Revision `a9007c4` adds an admin-only
`POST /api/portal/roster-preview` accepting only `{mode:"preview"}` on the
existing isolated migration preview, additionally guarded by its existing
`MIGRATION_PREVIEW_ONLY=true` flag. No settings/credentials/security controls
were replaced. Calendar remains read-only; the existing source reader and
reconciliation planner are reused.

Active Tracker rows are assessed in memory. Existing Andie mappings are reused;
explicit Tracker event IDs and existing preview lesson links are distinguished
from unapproved exact-full-name Calendar title/series candidates. Duplicates,
shared events, missing mappings, attendance/cancellation conflicts, invalid
rates and conflicting Tracker event IDs are reported. Missing preview identities
and opening balances remain review items; unknown status is never assumed Active.
No balances or new business identities are fabricated or imported.

Only operational diagnostics under `settings.rosterDryRun` are saved. No
non-pilot student/lesson/business record, billing rule or source cell is written.
The existing pilot config and health are preserved. The report has `readOnly:true`,
`canApply:false` and no Apply digest; neither its endpoint nor its UI offers
an import path. Existing Andie-only mutation guards remain in place.
Source window remains the verified whole Toronto days -7/+56; the report covers
every explicitly Active roster row inside that lesson window. Production Portal
records are not read by this isolated runtime; non-imported students are clearly
marked as projections, not reconciliation with production data.

Local validation passed **47 tests** across runtime/SQLite flows, planner,
read-only/same-origin/admin/preview guards, no non-pilot imports, unchanged
business revisions, GET-only Google business reads, failure visibility and
Portal rendering/privacy. Both protected read-only workflow Python scripts
compile; `git diff --check` passes. The existing deployment workflow now runs
these targeted checks and packages the existing site for this actual change.
[Deployment run 37709597189](https://github.com/Amandadsouza77/auxesis-education/actions/runs/37709597189)
completed successfully; verification details are recorded below.

Revision `a9007c4c71d7dd7c10772ffd90c15bc06dbb0bb4` is deployed at
`https://081acc2d.auxesis-migration-preview.pages.dev`; the stable alias is
unchanged. All deployment steps passed, including targeted tests, actual D1
session rejection, cross-origin rejection, Portal/callback/OAuth PKCE checks,
and the unchanged live-project settings/deployment snapshot.
[Read-only run 37709597195](https://github.com/Amandadsouza77/auxesis-education/actions/runs/37709597195)
confirmed the exact deployed revision, production binding isolation, unchanged
completed Andie proof (two restored note saves, one import, 18 lessons, zero
non-pilot students/lessons), and saved roster state **not-run**.
Evidence is retained at `/workspace/auxesis-pilot-evidence/roster-deployment-proof.json`.
The real roster dry run must not be claimed complete before the owner click.

**Next authenticated owner action:** refresh the isolated Students page and click
**Preview active roster (read-only)**, then reply done. This uses the already
connected Google account and selected existing Tracker; do not reconnect,
reselect, change Google settings or click Apply. The private browser session is
not available to the agent; never retrieve it, fabricate a session or bypass
security. No new owner authorization beyond this read is needed.
Then read the saved roster report from the existing protected readiness workflow's
separate fixed SELECT step and validate unchanged restored Andie/business counts.
Do not expand imports, writes, unattended updates or production scope.

## Completed checkpoint — controlled Andie round trip proven end to end

The owner removed only the temporary marker, saved the lesson and ran Preview.
[Read-only run 37704086813, attempt 4](https://github.com/Amandadsouza77/auxesis-education/actions/runs/37704086813/attempts/4)
completed successfully and verified the fresh Google-source read at
`2026-10-08T00:37:33.368Z` (**20:37 on 7 October in Toronto**).

All final assertions passed:

- The Portal covered/outcome/next hashes exactly match the original baseline;
  the marker is absent and the original lengths are restored.
- Independently and freshly read Google Tracker row 56 covered/next hashes
  exactly match the original baseline and Portal. Cached metadata also agrees.
- Two successful note saves are recorded (temporary write and restoration),
  following the one successful source import. Both writes used the existing
  Google-authorized owner session and one exact changed lesson-note cell.
- The final preview reports **18 Calendar occurrences, zero changes, zero
  conflicts**. Lesson identity, status, start/end/duration, all Calendar facts,
  Tracker lesson links, rate/package/balance values and the existing business
  review safeguard remain identical to the reviewed baseline.
- The isolated database has 18 pilot lessons and **zero non-pilot students or
  lessons**. The deployed application remains `f96deca`; live production is
  unchanged and has no binding to the isolated pilot database.

Hash-only evidence and successful assertions are saved outside the checkout at
`/workspace/auxesis-pilot-evidence/restoration-proof.json`; the prior marker
write and original baseline files remain preserved. No further owner action or
authentication/configuration blocker remains for this completed pilot.
Do not repeat completed writes, tests, builds, apply or authentication.

**Verified scope:** actual Calendar/Tracker-to-Portal import and replay, the
existing cancellation/lesson-status mappings, real Portal-to-Tracker covered-note
save, independent fresh source confirmation, and exact restoration. The 27
passing handler/SQL integration tests also exercise creation, rescheduling,
cancellation, exact-cell writes, restoration and failure/security safeguards.
Live Calendar reschedule/cancel mutations were not performed: Calendar access
remains read-only and the real schedule was preserved.

Portal note saves now write changed Tracker note cells automatically through the
existing authorized path. Source refresh still uses the existing **Preview pilot
sync** / reviewed Apply controls. Unattended scheduling and wider rollout remain
paused under the user's explicit pilot-only scope; passing this pilot does not
authorize enabling them or merging/deploying production. Keep Calendar as the
schedule authority, Tracker as the business authority and Portal as the consuming
interface. The existing downloadable Sheet remains intact.

## Historical checkpoint — live note write verified; restoration pending, superseded

The owner saved the requested marker and ran Preview. [Read-only run
37704086813, attempt 3](https://github.com/Amandadsouza77/auxesis-education/actions/runs/37704086813)
verified the actual Google-authorized Portal-to-Tracker write. The fresh source
read at `2026-10-08T00:01:59.311Z` (**20:01 on 7 October in Toronto**) reports
zero changes and zero conflicts across 18 Calendar occurrences. Tracker row 56's
fresh covered-note hash equals the Portal hash; its original prefix hash equals
the baseline. Outcome and Next Steps hashes are unchanged. Exactly one note-save
audit is present; lesson identity/status/times, every Calendar occurrence,
Tracker links, rates/package/balances and non-pilot isolation remain unchanged.
Hash-only intermediate evidence and successful assertions are saved at
`/workspace/auxesis-pilot-evidence/marker-write-proof.json`.

**Next owner clicks:** reopen the linked 30 September lesson below, remove only
the added `AUXESIS_PILOT_CHECK_20261007` line from What We Covered, leave the
original text and other fields unchanged, click **Save lesson notes**, then
**Preview pilot sync** on Students. Do not repeat Apply or the marker insertion.
Read the changed diagnostics and require exact baseline hashes in both the
Portal and fresh Tracker source, marker absent, two successful note saves,
zero-change replay and unchanged Calendar/business/isolation. Full round-trip
proof remains pending that restoration check. No application change or redeploy
is required for this owner-session step.

### Completed import and write-test preparation

The owner's authenticated apply succeeded at `2026-10-07T23:23:51.667Z`
(19:23 Toronto), followed by a fresh preview at `2026-10-07T23:24:12.331Z`.
[Read-only run 37700101519, attempt 2](https://github.com/Amandadsouza77/auxesis-education/actions/runs/37700101519)
confirmed **18 Calendar occurrences, zero changed records, zero conflicts**.
Protected database evidence confirms one successful source apply, 18 pilot
lessons, zero non-pilot students/lessons, and zero successful Tracker note saves.
The Calendar schedule facts remain identical to the reviewed source facts.
Rate **125 CAD**, Monthly package, purchased **8**, used **0** and the explicit
`balanceVerified=false` review safeguard remain unchanged. No source business
data has been written. Do not repeat the completed apply or authentication.

Revision `a899a92` adds hashes from freshly read Google Tracker notes to saved
preview diagnostics, independently of cached Portal metadata. Deployment
[37703145008](https://github.com/Amandadsouza77/auxesis-education/actions/runs/37703145008)
passed 26 tests and all deployment/security/isolation checks. The existing
Preview deployment and Google connection were preserved.

Revision `f96deca` limits note writes to changed cells: the controlled test edits
only Lesson Focus, leaving unchanged Homework / Next Step untouched. The 27
targeted tests passed locally. The read-only proof also hashes the original
note prefix when the exact temporary marker is appended, so no teaching text
needs to be exposed. [Deployment run 37704086887](https://github.com/Amandadsouza77/auxesis-education/actions/runs/37704086887)
passed all steps, including 27 runner tests, real D1 session rejection,
cross-origin rejection, stable Portal/callback, OAuth PKCE and unchanged live
settings/deployment. The exact deployed commit is
`f96deca5a097e2d1d57c35c433f7b6a1b1f7f036`, at
`https://1cb27a6c.auxesis-migration-preview.pages.dev`.
Use the unchanged stable alias for the owner's browser session.
[Read-only run 37704086813, attempt 2](https://github.com/Amandadsouza77/auxesis-education/actions/runs/37704086813)
then confirmed that exact deployed revision, unchanged baseline hashes,
18 pilot lessons, zero non-pilot records, one successful source apply and zero
Tracker note saves. Its saved preview remains the successful zero-change replay.
Fresh Tracker note evidence will appear after the next authenticated Preview;
do not treat cached source hashes as an independent post-write Sheet read.

Hash-only baseline and import/replay evidence are saved outside the checkout at
`/workspace/auxesis-pilot-evidence/note-baseline.json` and
`/workspace/auxesis-pilot-evidence/import-and-replay.json`. Recover the baseline
from [read-only run 37703145168](https://github.com/Amandadsouza77/auxesis-education/actions/runs/37703145168)
if needed. Do not overwrite the baseline after a temporary write.

**Remaining owner-session step:** the private signed-in browser is still the
only authorized path for the live notes command and fresh Google reads.
No Google reconnect, Tracker reselection, credential change or security change
is needed. Never extract the session or mint an alternate admin session.

After deployment verification, open the isolated completed **30 September
Andie lesson / Tracker row 56**:

<https://codex-cloudflare-backend-mig.auxesis-migration-preview.pages.dev/portal/lesson/?id=calendar-classroom107924035776692772286%2540group.calendar.google.com%257Cc5h36dph71gmabb5c5gj6b9k68sj8bb1cko3gb9n6ssj6c9n70om6opn68_20260930T084500Z>

Keep the existing **What We Covered** text and append, on its own new line,
`AUXESIS_PILOT_CHECK_20261007`. Leave Outcome and Next Steps unchanged.
Click **Save lesson notes**, then **Preview pilot sync** on Students.
Read the protected saved diagnostics before asking the owner to remove the
marker. Require the fresh Tracker covered hash to equal the Portal covered
hash, the prefix hash to equal the original baseline, unchanged other hashes,
zero-change replay, one successful exact-pilot note save, unchanged Calendar
and business facts, and continued non-pilot isolation.

Only after that intermediate write passes, have the owner remove only the added
marker line, Save and Preview again. Require exact baseline note hashes in both
the Portal and fresh Tracker read, no marker, two successful saves, unchanged
business/Calendar/isolation and zero-change replay. The live round trip remains
**unproven** until both saves and independent source reads pass. Full-roster
rollout, unattended updates and production changes remain paused.

## Historical checkpoint — reviewed preview and owner-session apply, superseded

The owner reran Preview and confirmed it with `DONE`. The saved live result at
`2026-10-07T22:56:24.106Z` (18:56 Toronto time) is `preview-ready`,
`canApply=true`, **18 Calendar occurrences, 20 proposed records, zero conflicts**,
and no successful apply yet. Do not repeat the old authentication, Tracker
selection, partial-day or unmatched-cancellation investigations.

The original GitHub annotation was truncated at 4,096 characters. A workflow-only
fix now publishes the bounded pilot facts in ordered chunks without changing
Cloudflare or business records. All chunks from
[readiness run 37699451946](https://github.com/Amandadsouza77/auxesis-education/actions/runs/37699451946)
were reconstructed and validated locally. Only whitelisted pilot diagnostics,
not notes, contacts, tokens or browser session values, were fetched.

Actual source-to-proposal checks passed:

- All 18 Calendar occurrence IDs and proposed lesson IDs are unique and have
  exact one-to-one links inside the full Toronto read window.
- All 17 confirmed lesson start/end times and one-hour durations match Calendar,
  including its supplied offsets across the November DST change.
- All nine in-window Tracker lesson rows link by exact Toronto date and physical
  row number; their Completed, Scheduled and Cancelled statuses agree.
- Tracker roster row 9 and the proposed Portal student retain **125 CAD,
  Monthly, purchased 8, used 0**. Attendance evidence sets `balanceVerified=false`
  rather than silently recalculating or debiting the package.
- The 7 October cancellation matches Tracker row 72 and retains `chargeable=false`.
- The completed **30 September lesson / Tracker row 56** is the candidate for
  the controlled exact-cell note write/restoration after import and zero-change
  replay are confirmed. Its Calendar event ends in `_20260930T084500Z`.

One additional incomplete mapping was found in these live facts: Calendar
supplied both start and end for the cancelled lesson, but its first-sync Portal
proposal retained unknown duration. Revision **`5892b1f`** now preserves the
provided valid start/end and one-hour duration without changing cancellation,
no-charge evidence or balances. Sparse tombstones still retain unknown duration;
invalid supplied intervals and recorded-attendance conflicts still block apply.
The targeted suite passed **25 tests locally and in the deployment runner**.

That revision deployed successfully to
`https://f087e171.auxesis-migration-preview.pages.dev`; the stable pilot alias is
unchanged. The deployment workflow's immediate smoke check caught a transient
404 while the new numbered route propagated. No rebuild/redeploy was repeated.
The stable endpoint subsequently passed its D1 lookup, and fresh
[read-only run 37700101519](https://github.com/Amandadsouza77/auxesis-education/actions/runs/37700101519)
confirmed exact deployed commit `5892b1faa87fb5042d864dff98a630cd5d76ea0d`,
successful deployment stage and 401 from the new numbered deployment's real D1
session lookup. This distinguishes successful publication and later successful
verification from the original workflow's failed immediate smoke step.

The stored source facts still predate that last timing correction. A fresh
authenticated Preview must therefore precede Apply: the old preview digest
must not be reused, bypassed or fabricated. No business records have been applied
or written to the Tracker, and the full real round trip is **not yet proven**.

**Single access blocker:** mutation and fresh Google-source read requests must
use the owner's authenticated Portal session. That session exists only in her
browser; no usable agent browser/session connection is available. The stored
Google refresh token and encryption key remain protected, and no credentials or
cookies were requested or extracted. Do not create an admin session through D1,
bypass authentication, add an alternate privileged route, rotate secrets or
change security controls to avoid the owner-session step.

**Next owner clicks:** in the signed-in isolated `/portal/students/` page,
refresh, click **Preview pilot sync**, then **Apply reviewed changes** for the
controlled Andie pilot, then **Preview pilot sync** again. Apply is now necessary
to exercise the isolated Portal database import, and the source proposal has been
reviewed for safe pilot scope. If fresh Preview reports any conflict or Apply
rejects a stale digest, do not bypass the safeguard; inspect its saved result.
The following replay must report zero changed records before the exact-row note
write/restoration test proceeds.

Resume by reading only the changed saved preview/apply diagnostics. After import
and replay pass, use the existing Google-authorized administrator `notes` command
for row 56, a non-sensitive temporary note and restoration. Verify the real
Tracker read after each save, the final zero-change replay, source Calendar
checksums, unchanged business balances and non-pilot isolation. Those real writes
remain unrun; synthetic tests and clean preview must not be reported as a proven
live write path. Production and Portal design remain untouched.

## Historical checkpoint — first-sync repair, superseded

Google sign-in and selected Tracker access are now working. The owner resolved
Google's Testing/test-user restriction and ran the real Andie-only preview.
No credential replacement, Cloudflare security change or source write was needed.
The preview read 18 Calendar occurrences and proposed 19 records, but correctly
blocked apply with these recorded issues:

- One unlinked cancellation: the approved series occurrence
  `c5h36dph71gmabb5c5gj6b9k68sj8bb1cko3gb9n6ssj6c9n70om6opn68_20261007T084500Z`.
- Tracker dates `2026-09-30` and `2026-10-07` lacked an exact Portal lesson match.

[Read-only diagnostic run 37687650347](https://github.com/Amandadsouza77/auxesis-education/actions/runs/37687650347)
confirmed the saved preview timestamp `2026-10-07T21:09:19.692Z`, its issue codes
and occurrence ID, `canApply=false`, no successful apply, and a present encrypted
administrator Google connection. The encryption key remains opaque to the agent;
it was not retrieved, requested, replaced or exposed. Existing authenticated
source access terminates in the deployed runtime and the owner's browser session.

Two first-sync edge cases were reproduced and corrected:

1. Calendar reads previously began at `now - 7 elapsed days`, while Tracker rows
   were checked by full Toronto date. A 30 September morning lesson was therefore
   excluded from an afternoon read even though its Sheet row was included. Both
   bounds now use whole Toronto calendar days, with DST-aware midnights.
2. A cancelled occurrence could not be imported on first sync because the Portal
   link did not exist yet. It can now link or create a cancelled pilot record
   **only** with a timed Calendar slot and exactly one corroborating cancelled
   Tracker row. A supplied Tracker event ID must match. Duplicate matches,
   missing dates, uncorroborated cancellations and completed-history conflicts
   still block apply. Sparse cancellations retain unknown duration and do not
   invent an end time, chargeability or package debits. Explicit no-charge
   evidence continues to come from the Tracker.

Preview health now retains limited pilot diagnostic facts: read bounds, source
event IDs/times/statuses, Tracker dates/statuses/row numbers, proposed lesson
links and before/proposed rate/package/balance values. It excludes teaching
notes, contacts, tokens, session values, raw provider payloads and other students.
The protected read-only workflow can inspect these saved facts without exposing
credentials or writing business records.

Application revision **`1b5003c`** is deployed successfully at
`https://0b9f1b32.auxesis-migration-preview.pages.dev`. Continue using the unchanged
stable alias:
`https://codex-cloudflare-backend-mig.auxesis-migration-preview.pages.dev`.
[Deployment run 37688388231](https://github.com/Amandadsouza77/auxesis-education/actions/runs/37688388231)
passed all steps: the 23 targeted checks in the runner, existing-site packaging,
isolated deployment, actual D1 session rejection, cross-origin rejection,
Portal availability, callback error handling, OAuth start/PKCE and unchanged
live-site settings/deployment snapshot. The earlier Python-user-agent smoke
failure is resolved; no security controls were changed. Runtime path changes now
trigger this existing isolated deployment workflow, which runs the targeted
checks before publication. No infrastructure or database was recreated.

The 23 local checks passed too, including cancellation bootstrap/replay, retained
ambiguity/history safeguards, first-day morning inclusion, DST transitions,
diagnostic privacy and all prior preview/apply/write-back protections. The new
application was packaged once for these actual changes; completed tests were
not repeated without a new change.

**Pending owner-session action:** refresh the signed-in pilot **Students** page
(`/portal/students/`) and click **Preview pilot sync** once. The controls are on
Students, not Dashboard. Do not click **Apply reviewed changes** yet. No new
Google authorization or Tracker selection is needed while the existing grant
remains valid. The agent cannot submit an authenticated request using the private
browser session; do not request cookies, tokens or replacement secrets. A fresh
preview is necessary to validate the corrected code against live Calendar and
Tracker facts. The owner can reply that the preview ran; another screenshot is
optional because its bounded saved diagnostics are directly readable.

Next resume: read the changed `syncHealth` through the existing protected
readiness workflow, validate each source-to-proposed lesson link and the preserved
business balances, then complete the authorized one-student apply/replay and
exact-row note-write/restoration only when safe. Do not infer corrected live
reconciliation from the 23 synthetic checks or deploy smoke alone. If cancellation
evidence is not corroborated, retain the conflict and inspect the recorded facts.
Full-roster rollout and unattended synchronization remain pending this real pilot.
Google OAuth is still in Testing; its refresh-token lifetime must be addressed
before claiming reliable unattended operation beyond the pilot.

No Calendar, Tracker or existing Portal business record was written during this
repair. The owner's prior OAuth callback initialized the approved isolated pilot
reference seed, and their preview wrote operational health only. Production,
the Portal design and security controls are unchanged. Do not rebuild/redeploy
unchanged code, recheck the full configuration, repeat passed tests, reconnect
Google or reselect the Tracker simply to resume.

## Historical checkpoint — initial owner authorization, superseded

The owner corrected the credential scope without rotating the encryption key or
touching the live project. Fresh
[readiness run 37686212617](https://github.com/Amandadsouza77/auxesis-education/actions/runs/37686212617)
passed. All four Google entries are configured both in project Preview settings
and in the actual deployed preview. The isolated project's Production is empty;
the pilot database remains absent from every binding on `auxesis-education`.

The existing fixes and flow tests were committed at `72bf74c`. The existing
deployment workflow published that application revision successfully to
`https://be178c5c.auxesis-migration-preview.pages.dev`. Its unchanged stable alias
is `https://codex-cloudflare-backend-mig.auxesis-migration-preview.pages.dev`.
The workflow confirmed the live settings/deployment snapshot stayed unchanged.
The necessary deployment packaged the updated code; there was no reconstruction,
database migration, new infrastructure, credential replacement or security edit.

The deployment workflow's last smoke step initially failed with HTTP 403 for
Python's default client identity. An honest explicit
`User-Agent: Auxesis-Pilot-Readiness/1.0` resolves the earlier 1010 response on the
stable alias. No browser impersonation, disabled TLS checks, altered proxy route
or security-control change was used. The deployment helper now retains that
client identity. The application's deployment succeeded even though that
workflow's original verification step failed; the following independent checks
then passed against the deployed stable alias:

- Portal HTML: 200.
- Correctly shaped nonexistent session: 401, exercising the real D1 lookup.
- Cross-origin apply request: 403, rejected before authentication or mutation.
- Invalid OAuth callback: 401 through the repaired error boundary; no Google
  exchange, session creation or business seeding occurs for that request.
- OAuth start: 302 to Google with the exact stable callback, S256 PKCE,
  offline consent, Calendar read-only and selected-file `drive.file` scopes.
- Google authorization endpoint: 302 to Google's sign-in step; no reported
  `redirect_uri_mismatch`, `invalid_client` or `access_denied` at this stage.

OAuth-start probes created only expiring operational auth-flow rows. No Calendar,
Tracker or Portal business record was written. The unchanged 17 passing local
flow tests were retained and not repeated. The new numbered hostname is not in
this task's network allowlist; use the already permitted stable alias for agent
requests rather than requesting a network/security change.

The protected readiness workflow now performs one exact read-only D1 count in
addition to its Cloudflare GET inventory. It confirms **zero administrator Google
connections**. Encrypted tokens and session/account contents were not fetched.
This is a genuine owner-only authorization prerequisite, not a missing
configuration value. The helper/client-identity and checkpoint-only follow-up
uses `[skip ci]` to avoid rebuilding or redeploying unchanged application code.

**Next owner action:** open the stable pilot's `/portal/` page and sign in as
`adsouza35@gmail.com`, complete Google consent, then use **Select Student
Tracker** to choose the existing spreadsheet
`1UrdpPD4AWU1H1Ok7Txb-sL1hIXoIEVN8u--8fZqXwUQ` through Picker. Keep Google
credentials and session values out of chat. The existing callback initializes
only the isolated approved reference seed if absent; it does not overwrite the
Tracker or Calendar. Once connected, **Preview pilot sync** reads Andie's sources
and saves operational health only. Do not click **Apply reviewed changes** until
the real preview has been reconciled and safely validated.

Resume by checking the changed grant/Picker state, not by recreating credentials,
rebuilding, redeploying, repeating unchanged tests or rechecking the entire
configuration. Then read and reconcile the live Andie preview before applying
anything. After safe validation, complete the existing apply/replay, exact-row
note write/restoration and Calendar-preservation checks. Full-roster rollout and
unattended automation remain pending the live pilot; no authenticated real-student
reconciliation or write-back has yet been verified.

## Historical checkpoint before credential-scope correction — superseded

The owner reports that a Google Cloud project has now been created, Calendar,
Sheets, Drive and Picker APIs enabled, and a web OAuth client and the documented
callback configured. No Google credential values were requested or exposed.
The earlier provenance audit below is historical; do not repeat its project-list
check or create another project.

The fresh deployed-project audit found a configuration-scope error:

| Google variable | Isolated project's Production | Isolated project's Preview |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Configured | Missing |
| `GOOGLE_CLIENT_SECRET` | Configured | Missing |
| `GOOGLE_API_KEY` | Configured | Missing |
| `GOOGLE_APP_ID` | Configured | Missing |

Verified by
[read-only run 37682394839](https://github.com/Amandadsouza77/auxesis-education/actions/runs/37682394839),
workflow revision `dafd1d1`. The readiness check failed at its existing isolation
safeguard: the isolated pilot must not have Production bindings or credentials.
The safeguard was not removed or relaxed. Workflow-only updates expose safe
failure reasons and Preview presence statuses through check annotations; they do
not trigger the deployment workflow or mutate Cloudflare.

**Required owner action:** in **Cloudflare Pages → auxesis-migration-preview →
Settings → Variables and Secrets**, select **Preview** and securely enter the
same four existing Google values there. Once Preview is saved, remove those four
mistaken entries from **Production on this same isolated project**. Preserve
`PORTAL_TOKEN_KEY`, other existing Preview mappings and the live
`auxesis-education` project. Do not rotate Google credentials or paste values
into chat. The stored secret is not available for the agent to transfer safely;
this secure credential-entry step requires the owner.

Agent requests to the stable preview still encounter Cloudflare HTTP 403/error
1010 before reaching Portal routes. No security control or TLS verification was
disabled. Google callback behavior, consent, Tracker selection and the real
Andie pilot are not yet validated. They cannot start against the intended
Preview environment while these four entries are absent there.

All existing runtime/source fixes and the 17 passing local checks are retained;
unchanged tests/builds were not repeated. Runtime fixes remain undeployed. No
Google Calendar, Sheet, Portal business record or production configuration was
written. After the owner corrects the credential scope, recheck this changed
configuration, validate the deployed runtime and its callback, then use the
existing Andie-only read-only reconciliation before permitting any pilot writes.

## Historical Google credential provenance audit — 7 October 2026

Earlier instructions assumed that Auxesis-owned Google OAuth/Picker credentials
already existed. **That assumption was not supported by the repository or the
verified deployment inventory.** Do not follow instructions to retrieve an
"existing" Auxesis client until its existence and ownership are established.

The audit inspected the current checkout, the synchronization pilot revision
`b2b240c`, migration foundation `2f349af`, OAuth implementation `d783e26`, runtime
checkpoint `6adb3a0`, later checkpoint `0fa7656`, PR #12 and its available notes.
No concrete Google OAuth client identifier or Google Cloud project ID was found
in those repository snapshots. The inspected history of `.env.example` contains
the four fields only as empty slots, introduced at `6adb3a0`. This does not prove
that no project exists anywhere; it establishes that no project name/ID or owner
was recorded or verified in this work.

| Requirement | What the prior work actually establishes |
| --- | --- |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | The legacy backend delegated Google authorization to its managed provider/SDK. The Cloudflare implementation reads these from its own environment, but no supplied standalone values or owning Google project are recorded. |
| `GOOGLE_API_KEY` | Legacy Picker code called `getGooglePickerConfig()`. Its rollout notes still marked Picker setup pending. No supplied key is recorded in the inspected work; the Cloudflare preview and protected workflow report it missing. |
| `GOOGLE_APP_ID` | This is the Google Cloud project number used by Picker, not a Sheet, Calendar, Cloudflare or legacy platform project ID. No Google project number is recorded; the preview and protected workflow report it missing. |

Reading legacy SDK source is provenance inspection only; no legacy service was
contacted or used. The underlying provider's Google project name, project ID and
owner remain unknown. Its generated OAuth provider and SDK configuration were
not exported into this repository.

The earlier eight-occurrence pilot used the administrator-only
`source_snapshot_POST` import of independently retrieved snapshots. That route
explicitly does not grant Google source access, and the rollout notes still
required direct Google consent and Picker configuration. It is not evidence that
the Cloudflare OAuth credentials were created or stored.

`auxesis-migration-preview` is an existing **Cloudflare** project. It is not a
Google Cloud project. Owning the existing Google Sheet and Calendar also does not
establish ownership of a Google API project.

The standalone Cloudflare OAuth/Picker workflow requires a Google Cloud project
containing an OAuth web client and Picker API configuration. If no suitable
project is accessible to the owner, a new owner-controlled project will be
needed, but none should be created during this provenance check. "No
organization" is normal for a personal Google account and does not by itself
mean that no projects exist.

**Single next action:** while signed in as `adsouza35@gmail.com`, inspect Google
Cloud **Manage Resources → No organization → the full project list** (or the
project selector's **All** tab, rather than **Recent**). This is a read-only
check to establish whether any reusable project is actually accessible. If that
full list is empty, the current evidence provides no project to reuse. Do not
create a project or change Cloudflare security settings as part of this check.

## Resumed access check after environment publication

The reviewed environment settings have been published. The selected cloud
configuration now contains the required allowlist and saved startup instructions;
GitHub Actions metadata reads work. The existing branch, local fixes and test
results were preserved. No build, deployment or business-data test was repeated.

The existing read-only readiness workflow was rerun with its protected Cloudflare
connection. It succeeded. Its external log-download hostname was outside the
allowlist, so the workflow now also publishes its **non-secret** inventory as a
GitHub check annotation and supports manual dispatch. Only this logging workflow
was committed and pushed to the existing migration branch. Its deployment
workflow does not trigger on this path. No hosting, database or production
settings were changed.

Fresh inventory confirms:

- Preview `PORTAL_DB`: present; pilot database is not bound to production.
- Preview `PORTAL_TOKEN_KEY`, `ADMIN_EMAIL`, and preview-only guard: configured.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_API_KEY`, `GOOGLE_APP_ID`:
  **missing in the isolated preview and unavailable in the protected workflow**.
- Pilot identity, Tracker ID, Calendar ID and approved recurring-series mappings:
  configured. The existing deployment remains successful at runtime revision
  `6d067a13cc1520634d355465a73dd30d517d9976`; no redeployment occurred.

Verified inventory:
[read-only run 37666973152](https://github.com/Amandadsouza77/auxesis-education/actions/runs/37666973152),
workflow revision `369b60a07b91d21327b9afebef7be1c071581892`.
Both workflow-only commits are on the existing remote migration branch. The
runtime/source fixes and regression-test file remain intact locally, uncommitted
and undeployed.

Direct requests now reach Cloudflare, which responds with HTTP 403/error 1010
before the Portal handles `/portal/`, `/api/portal/state`, or
`/api/portal/auth/start`. These are not application authorization results. A
sandboxed Chromium attempt could not start because the image's sandbox helper is
misconfigured and user-namespace setup is unavailable. No browser sandbox,
Cloudflare rule or TLS verification was disabled.

**Missing Google configuration is confirmed; an existing Google project's
ownership is not.** Establish the project and credential provenance using the
audit above before configuring the four values in **Cloudflare Pages →
auxesis-migration-preview → Preview variables/secrets**. `GOOGLE_APP_ID` is the
Google Cloud project number. Keep secret values out of chat and do not rotate the
existing encryption key. The intended standalone callback remains:

`https://codex-cloudflare-backend-mig.auxesis-migration-preview.pages.dev/api/portal/auth/callback`

Once those values are active, the owner can sign in at the existing stable pilot
alias as `adsouza35@gmail.com`, authorize Google access, and select the existing
Student Tracker in Picker:

`https://docs.google.com/spreadsheets/d/1UrdpPD4AWU1H1Ok7Txb-sL1hIXoIEVN8u--8fZqXwUQ/edit`

Do not apply sync or edit business notes at this step. Resume with an Andie-only
read-only preview and reconcile it against Calendar, Tracker and Portal before
any business mutation. Broader rollout and automation remain paused. The runtime
fixes still remain local and undeployed.

## Earlier access evidence — superseded by the resumed check above

Native Git read access works and both existing remote branches were recovered.
This session has no Cloudflare token, Google OAuth client settings, access token
or refresh token. `GOOGLE_APPLICATION_CREDENTIALS` points to an empty JSON object;
it is not usable authentication. No secret values were printed or copied.

The last saved remote inventory in `cloudflare/README.md` reports these **four
missing Google values** in the isolated preview and protected workflow:
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_API_KEY`, `GOOGLE_APP_ID`.
Their current remote status could not be reconfirmed: GitHub API, Cloudflare API,
Google source reads and the existing preview were denied by the environment
egress proxy (HTTP 403). This is not evidence that a credential was rejected by
Google or Cloudflare. The saved environment draft adds the required domains;
that save did not apply the network change to this running session.

The account owner needs to:

These earlier steps assumed an existing Google client, which was never verified.
They are retained as historical context; use the provenance audit above to
determine the next action first.

1. Apply the saved network allowlist in environment settings so the current
   configuration and existing preview can be read. Recheck configuration before
   adding anything already supplied.
2. If still missing, enter the four existing Auxesis Google values directly in
   **Cloudflare Pages → auxesis-migration-preview → Preview variables/secrets**.
   `GOOGLE_APP_ID` is the Google Cloud project number. Use the existing OAuth
   client and Picker configuration; never paste values into chat, rotate
   `PORTAL_TOKEN_KEY`, replace credentials or create another service.
3. Register the stable alias callback in that OAuth client:
   `https://codex-cloudflare-backend-mig.auxesis-migration-preview.pages.dev/api/portal/auth/callback`.
   Check that the existing Google project has Calendar, Sheets and Picker enabled
   and permits Amanda to authorize the requested scopes. Then sign in as the
   configured administrator and select the existing Tracker through Picker.

Applying new Pages environment values may require deploying an existing revision
to that same isolated preview; do not repeat provisioning, create a replacement
database or touch production. The local corrections also remain undeployed.
After authentication and access are available, complete the documented real
Andie preview/apply/zero-change replay, compare Calendar checksums, and perform
the exact-row note write/restoration test. Do not enable broader writes or
automation from fixture results alone. Keep the Google Sheet maintained and
downloadable, and retain existing Portal functionality during any later rollout.
