# Programme and form QA evidence

These are local browser renders, using the eight public assets captured from the previously documented production deployment `b55b1719` (commit `ed13220e20d9dc6b37fd8bccf7fcba0880eec876`). They are not screenshots of a deployed candidate. All five programme disclosures are open for comparison. Form availability and delivery are intercepted locally; screenshots do not prove delivery.

- Programme comparison: [390px before](programmes-before-390.png), [390px after](programmes-after-390.png), [1440px before](programmes-before-1440.png), [1440px after](programmes-after-1440.png).
- Enquiry comparison: [390px before](enquire-before-390.png), [390px after](enquire-after-390.png).
- [Browser checks](results.txt). The CI artifact additionally contains screenshots at 320px and 768px.

Reproduce: capture public baseline with `.github/workflows/programme-form-qa.yml`, install `esbuild@0.25` and `playwright@1.56.0`, run `node scripts/prepare-programme-form-qa.mjs`, then `node scripts/programme-form-browser-qa.mjs`. Set `CHROME_PATH` if the installed Chromium executable differs from `/usr/bin/chromium`.

The live public review config on auxedu.com still returns HTTP 403 until a separately approved deployment. Native verification of the corrected candidate is now complete: [protected test-only run 44104772698](https://github.com/Amandadsouza77/auxesis-education/actions/runs/44104772698) passed for candidate `72c7f18332612f856388293d8d6c8a8e031d4e9f`. The permitted source branch contains only a new test workflow, not a merge of the candidate. The environment allowlist remains unchanged. The workflow recovers the pinned package with step-scoped read-only credentials, then uses ephemeral local D1 and mocked providers without credentials. No release workflow was run.

- [Native review evidence](native-results.json): valid review stored pending and excluded publicly, invalid/consent/token/origin cases rejected, replay rejected after delay with unique content, anonymous/non-owner moderation denied, owner approval/publication/rejection verified. Honeypot intentionally returns the native HTTP 200 decoy while storing nothing; too-fast submissions on both approved public hostnames now return HTTP 429 and store nothing.
- [Native assembly hashes](native-assembly.json): private source unchanged; complete candidate assembled without release scripts.
- [Actual assembled enquiry evidence](native-enquiry.json): consent checked before providers, private recipient and Reply-To preserved, mocked success and failure verified, zero real emails and no production D1.

Actual-native testing found that the earlier SITE_URL-only adapter was insufficient. The corrected adapter validates the browser’s custom origin and forwards only the exact public review endpoints through the native legacy hostname, preserving all environment bindings and native request validation. It also enforces the 1000ms minimum age using the authenticated native token’s expiry and pinned 30-minute lifetime. No schema change was needed; native expiry, one-use token consumption, honeypot and moderation remain in place. Any future private-runtime token-contract change must be reconciled and tested with this guard.

The historical `npm run build` fails on the unchanged missing `content/pages/ib-biology-tutoring.json`; production uses the separate protected native assembly. The public fixture assembly passes, but is not a replacement for that production build.

Current auxedu.com assets were compared with the immutable baseline. CSS and scripts match byte-for-byte; the three affected HTML pages differ only by Cloudflare email obfuscation and its decoder script. The QA comparison normalizes that exact reversible transformation; no Cloudflare email-protection setting was changed.

Public regression for the same verified code: [run 44105035928](https://github.com/Amandadsouza77/auxesis-education/actions/runs/44105035928) passed (137 tests, zero failures, one pre-existing skip; browser checks at four widths).

Native runtime package SHA-256: `bccdaba4e8d4af564feddf7e72cb0648092c8ccef86c742db7fd658a89bc371e`. Trusted workflow commit: `d3ea3c955c7f441dbfd8d6a2adfdcabf7be85db2`. Candidate worker SHA-256: `e746f781d6351b9c7ad1d58dead1b0bbb1b413d806b1e94b26f2539587aa9e46`. Private source-tree SHA-256: `8bce3aa7b707e9322d50b54d921ce9fec38f7a4bcbafbe1fcb1db5c28f1f24bc`.

Scope caveat: inherited public QA ran live token-config/empty-validation probes before its removal in commit `6ee70607a14883e2404ab2f941a4416474fe3c8f`. A native token-config GET can issue transient anti-spam records, so zero possible production D1 writes across those earlier CI runs is not claimed. No valid production review, moderation action or real enquiry was submitted. The final public QA no longer calls live review config or submission endpoints; actual native review tests use only ephemeral local D1. No production cleanup or token deletion was attempted.
