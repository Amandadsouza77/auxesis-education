# Validation status — 2 October 2026

## Completed

- Exported the saved source of approved prototype version 6, commit `37bf399753873775d10374bae049200454624dc8`.
- Build passes for all ten public pages and the custom 404 page.
- Static validation passes for 12 generated HTML files, 363 local links, assets and fragments, and every CMS source path.
- Text extracted from every original HTML page matches the exported page, excluding the invisible added bot-trap label. No approved text was replaced or rewritten.
- All four original binary assets match the prototype byte for byte. The original CSS is retained intact; a small appended rule set handles conditional hidden fields, a bot trap, disabled submission buttons and an optional supplied portrait.
- Seven Node tests pass: cross-origin rejection, consent and email validation, missing-configuration errors, mocked enquiry and review delivery, spam-check and delivery failure handling, honeypot handling, OAuth nonce/cookie validation, and repository-write permission checks.
- Browser JavaScript, editor preview script and API handlers pass syntax checks.

## Not yet verified

- Browser rendering and screenshot comparison at mobile/desktop widths. The execution workspace has no usable Chromium/Firefox binary; the discovered Chromium path is an empty file. These checks have **not** been claimed as passed. The original responsive CSS and logo aspect-ratio rules are preserved. `tests/browser.mjs` supplies route, responsive overflow, logo ratio, menu, prefill, conditional-field and mocked enquiry checks for a browser-enabled environment.
- Live Decap CDN loading, authenticated GitHub editing, preview, image uploads, draft publication and automatic Cloudflare rebuilds. Requires the user's GitHub repository, OAuth application and configured hosting origin.
- Real Turnstile checks and inbox delivery. API tests use mocked external responses and send no messages.
- Domain DNS, TLS on the final domain, mailbox configuration and final live smoke test. No public production launch has occurred.

The package is ready for account configuration and further verification. It must not be represented as a fully verified production deployment until these checks pass.
