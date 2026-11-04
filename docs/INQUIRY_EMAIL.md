# Inquiry email delivery — native Cloudflare release

## Current live failure (checked 4 November 2026)

The public `/enquire/` page contains the enquiry form. Its JavaScript still
requests `/api/enquiry?delivery=portal&kind=enquiry`. Both that URL and
`/api/enquiry` return an HTML 404 with `X-Auxesis-Runtime: cloudflare-native`.
This is a missing route in the current native Worker, not proof of an email
provider failure. The site is no longer served by the old Floot form backend.

The ordinary repository build and the deployed native release have different
source histories. Do not deploy an ordinary Python `dist` over the native site,
merge an old branch as a release shortcut, or republish the obsolete Floot app.
The existing native review system and private Portal must be retained.

## Prepared fix

The Inquiry form posts to `/api/enquiry`. It uses the existing Resend HTTPS API
integration, with no new dependencies. `functions/api/enquiry.js` supports Pages
Functions builds. **The deployed advanced-mode Worker also needs the native
wrapper below**: adding a Pages Function alone does not repair that deployment.
The recipient is fixed server-side to **adsouza35@gmail.com**; visitor input and
the older `ENQUIRY_TO` setting cannot redirect inquiries. The visitor's email is
used as Reply-To. All existing inquiry fields and the form layout are retained.

`cloudflare/inquiry-worker.js` wraps the native Worker and handles enquiry GET
and POST requests. All other requests, native reviews, bindings, execution
context and other Worker handlers are forwarded unchanged. No calendar,
booking, Google connection or database configuration changes are needed.

## Required Cloudflare setup

The current workspace has working repository access but no Cloudflare or email
provider credential. The most recent private-runtime recovery job, GitHub
Actions run `40458712475`, failed with `Runtime recovery provider HTTP 401`.
Renew `CLOUDFLARE_API_TOKEN` in the repository's existing protected
`auxesis-migration-preview` environment. Preserve its branch restrictions.
The established recovery also requires the existing `GOOGLE_CLIENT_SECRET`
and private Drive artifact authorization; their current readiness is unknown.

In the **auxesis-education** Pages project, open **Settings → Variables and
Secrets** for **Production**. Preserve all existing settings. Configure:

| Name | Type | Value |
| --- | --- | --- |
| `SITE_URL` | Variable | `https://auxesis-education.pages.dev` (the exact public origin) |
| `EMAIL_FROM` | Variable | `Auxesis Education <forms@YOUR-VERIFIED-DOMAIN>` |
| `RESEND_API_KEY` | Secret | A Resend API key with sending access for that verified domain |
| `TURNSTILE_SITE_KEY` | Variable | Public Turnstile widget site key |
| `TURNSTILE_SECRET_KEY` | Secret | The matching Turnstile secret key |

Reuse an existing verified Resend sender and Turnstile widget if available.
Otherwise, verify a domain in Resend and create a Cloudflare Turnstile widget
allowing `auxesis-education.pages.dev`. A Gmail address cannot serve as a verified
domain sender; Gmail is the destination. Resend test senders can have recipient
restrictions, so use a verified sender for production.

Enter secrets directly in Cloudflare, never in chat, frontend files, or Git.
`ENQUIRY_TO` is not required for inquiries and should be left unchanged for any
other consumers. The public widget key is fetched at runtime; it does not need to
be copied into `content/settings.json`. Production settings must be applied to a
new native deployment; changing them does not repair the existing release by itself.

## Integrate with the existing native release

1. Recover the checksum-verified private runtime through the existing protected
   release path. Its package checksum is
   `bccdaba4e8d4af564feddf7e72cb0648092c8ccef86c742db7fd658a89bc371e`.
   Keep the archive and extracted private source out of Git and public artifacts.
   Retain the existing production configuration, deployment rollback ID, database
   bindings and disabled synchronization/automation flags.
2. Against the recovered runtime, run:

   ```sh
   node scripts/prepare-native-inquiry.mjs work/staging-deployment/runtime
   ```

   The helper has no network or deployment operations. It creates a separate
   `inquiry-entry.js` importing the existing `staging-entry.js`, copies the
   inquiry handler and server helper, and replaces only the recognised `dist/app.js`.
   It preserves the native app's absence of the legacy review-form bootstrap.
   It rejects unknown frontend revisions before writing; compare newer changes
   rather than weakening that check. It leaves native runtime source, review
   assets, compiled Worker and all other pages unchanged.
3. Run the private runtime's existing review tests. Bundle `inquiry-entry.js`
   instead of `staging-entry.js` into `dist/_worker.js` using the existing esbuild
   release tooling. Verify `/api/enquiry` reports readiness on an isolated native
   preview with matching sender, Turnstile hostname and origin configuration.
   The helper itself does not verify the private runtime or deploy anything.
4. As part of the completed release, update only the enquiry paragraph in the
   deployed Privacy & Consent page to explain that Cloudflare Turnstile checks
   submissions, Resend delivers enquiries to Amanda's Gmail, and Google handles
   the receiving mailbox. Retain the accurate native review/other processor text.
   Do not publish a claim of active email delivery before provider validation.
5. Deploy the prepared native package to the existing `auxesis-education`
   production project through its controlled release path. Run the retained
   native review/access checks and confirm configuration and private business
   records are unchanged. Restore the prior deployment if these checks fail.
6. Perform the real delivery checks below. Keep synthetic QA enquiries clearly
   identified, and do not send to students or families.

## Validation and spam protection

The server enforces the exact origin, JSON input and payload limits, required
fields, consent, email syntax, UTC offsets, conditional Other fields and phone
details. The existing hidden honeypot discards automated submissions. Cloudflare
Turnstile tokens must pass server-side verification for the exact hostname and
`enquiry` action; Turnstile rejects expired/reused tokens. No email or spam-check
secret is returned to the browser.

The form shows loading, success and error states, prevents concurrent submissions,
and retains entries on failure. It resets only after a successful API response.
If configuration or spam protection cannot load, it displays the direct email
alternative and disables submission.

## Checks and live verification

Local checks: `npm test` (all seven test files passed), `npm run build`, `python3 scripts/check_site.py`, and
`git diff --check`. Tests cover fixed-recipient delivery with Reply-To and all
fields using mocked provider responses, required credentials, invalid form data,
honeypot handling, Turnstile hostname/action rejection, provider errors, frontend
success/failure, and unchanged review delivery behavior. Native tests also cover
the previously missing route and preservation of existing handlers and context.
The preparation helper was exercised against the downloaded public native
`app.js` in a synthetic runtime fixture: the review bootstrap stayed absent,
other files were retained, repeat application was unchanged, the generated
wrapper imported successfully, and an unknown frontend revision was rejected.
That fixture is not the recovered private runtime.

Live verification remains required after configuration and deployment:

1. Visit `/api/enquiry`. It should return `ready: true` and only the public
   `siteKey`; no credentials. A false value means required configuration is absent.
2. Submit a clearly marked **QA inquiry** through `/enquire/`, completing the
   Turnstile check. Check the success message and receipt at adsouza35@gmail.com,
   including all supplied details and Reply-To. Provider acceptance alone does
   not establish inbox delivery; check Resend delivery events too.
3. Try invalid email, missing consent and an Other choice without details. These
   must show validation errors without sending mail.
4. Check a failed request retains entered values and shows an error. Do not alter
   production credentials to force a failure; use local mocks for provider errors.

Current status: the native fix is prepared and local checks pass. Live HTTP
inspection established the missing route. The private runtime could not be
recovered with the expired/rejected deployment credential, and email/Turnstile
configuration is unverified. Production deployment, browser interaction and
actual Gmail delivery are not complete. No test email has been sent in this work.
