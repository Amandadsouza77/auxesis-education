# Programme and form QA evidence

These are local browser renders, using the eight public assets captured from the previously documented production deployment `b55b1719` (commit `ed13220e20d9dc6b37fd8bccf7fcba0880eec876`). They are not screenshots of a deployed candidate. All five programme disclosures are open for comparison. Form availability and delivery are intercepted locally; screenshots do not prove delivery.

- Programme comparison: [390px before](programmes-before-390.png), [390px after](programmes-after-390.png), [1440px before](programmes-before-1440.png), [1440px after](programmes-after-1440.png).
- Enquiry comparison: [390px before](enquire-before-390.png), [390px after](enquire-after-390.png).
- [Browser checks](results.txt). The CI artifact additionally contains screenshots at 320px and 768px.

Reproduce: capture public baseline with `.github/workflows/programme-form-qa.yml`, install `esbuild@0.25` and `playwright@1.56.0`, run `node scripts/prepare-programme-form-qa.mjs`, then `node scripts/programme-form-browser-qa.mjs`. Set `CHROME_PATH` if the installed Chromium executable differs from `/usr/bin/chromium`.

The active public review config on auxedu.com returns HTTP 403 `Unauthorized hostname`; the legacy hostname returns a JSON token config and useful HTTP 422 validation. The candidate adapter and browser feedback pass isolated tests. A valid review stored as pending, native token/replay protections, and moderation must still be verified with the protected private runtime. That environment rejected this branch; no release/security setting was changed to bypass it.

The historical `npm run build` fails on the unchanged missing `content/pages/ib-biology-tutoring.json`; production uses the separate protected native assembly. The public fixture assembly passes, but is not a replacement for that production build.

Current auxedu.com assets were compared with the immutable baseline. CSS and scripts match byte-for-byte; the three affected HTML pages differ only by Cloudflare email obfuscation and its decoder script. The QA comparison normalizes that exact reversible transformation; no Cloudflare email-protection setting was changed.
