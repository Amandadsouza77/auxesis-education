# Inquiry email delivery

The Inquiry form posts to the existing `/api/enquiry` Cloudflare Pages Function.
It uses the existing Resend HTTPS API integration, with no new dependencies.
The recipient is fixed server-side to **adsouza35@gmail.com**; visitor input and
the older `ENQUIRY_TO` setting cannot redirect inquiries. The visitor's email is
used as Reply-To. All existing inquiry fields and the form layout are retained.

Review forms retain their existing delivery path. No calendar, portal, booking,
Google connection, or database configuration changes are needed.

## Required Cloudflare setup

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
be copied into `content/settings.json`. Redeploy through the existing Git-connected
Pages build after configuring the values. Build command and output remain
`python3 scripts/build.py` and `dist`; retain the root `functions/` directory.

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

Local checks: `npm test`, `npm run build`, `python3 scripts/check_site.py`, and
`git diff --check`. Tests cover fixed-recipient delivery with Reply-To and all
fields using mocked provider responses, required credentials, invalid form data,
honeypot handling, Turnstile hostname/action rejection, provider errors, frontend
success/failure, and unchanged review delivery behavior.

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

At implementation time, no email/Turnstile secrets or Cloudflare account access
were available in the managed workspace. Its outbound proxy also refused
connections. Local checks passed, but deployment, browser interaction and actual
inbox delivery could not be verified from this environment.
