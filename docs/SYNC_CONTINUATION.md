# Synchronization continuation — 7 October 2026

Continue the existing Cloudflare pilot. Do not recreate its project or database,
rebuild completed artifacts, use Floot, or change the production Portal.
The checkout is on `codex/auxesis-sync-continuation`, based on
`origin/codex/cloudflare-backend-migration` at `0fa7656`.

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
node --test tests/cloudflare-sync-flow.test.mjs tests/cloudflare-pilot-runtime.test.mjs
git diff --check
```

Result: **17 passed, 0 failed, 0 skipped**. The new flow tests execute the actual
Pages handler and SQL against an in-memory SQLite database, with synthetic
students and Google HTTP fixtures. They cover delayed preview/apply, zero-change
replay, Portal state, stale-source and window-change rejection, physical row
numbers, Calendar creation/rescheduling/cancellation, preserved balances,
exact-cell note write and restoration, failed-read visibility, invalid OAuth
callbacks, non-pilot rejection and concurrent Tracker-note conflicts.

These are local integration tests, not an authenticated live Andie test. Earlier
unchanged build/deployment checks were not repeated. Full-roster synchronization
and unattended automation remain paused until the real pilot passes.

## Current checkpoint — owner authentication required, 7 October 2026

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
