# Public visual consistency audit — owner exploration

Baseline: `4e2ba62cc05e3a194b18b905074374b64456e75b`. Scope: all 16 public routes plus 404, excluding administration, private portal and API records. This builds on the completed editorial/navigation audit; it does not repeat or replace its historical native-runtime verification.

## Findings and refinements

- Shared surface-aware tokens replace inconsistent dark-green control accents with a restrained gold/bronze proposal. Aubergine remains unchanged. The owner clarified that all wide bars should use the brighter teal #009D97, matching the approved buttons: this now includes the homepage Less memorising. More understanding. panel as well as SMART goals and every CTA band. Large white statement text remains readable; SMART/body copy uses aubergine.
- Light surfaces: bronze primary controls and outline labels. Dark purple: existing bright-turquoise primary buttons; pale-gold secondary outlines/focus. Turquoise panels: aubergine controls. White forms reset to the light palette.
- Decorative gold `#A67C2E` is not used for ordinary text (approximately 3.51:1 against cream). Bronze `#6B4919` is approximately 7.5:1 on cream and 4.98:1 on taupe. Pale gold `#D0AC66` is approximately 7.1:1 on aubergine. Lowest tested button-text contrast: 4.55:1, including hover states.
- Consistent 3px contextual focus rings, shared button radius/height and card corners. Existing errors remain red. No large gold backgrounds.
- Existing feature/compact typography roles are deliberate and retained. Shared tokens preserve approved scales; process H2 outliers reduce from about 50.4px to 32px on desktop, 404 H1 joins the standard title scale, subsection headings scale fluidly. Exactly one H1 per page; actual heading levels and content nesting are retained, including Ontario H4/H5.
- Fourteen closing callouts have owner-requested contextual headings and wording around the same free Meet & Greet offer. Destinations, form values and layouts are unchanged. Homepage uses Getting started. Review quotations/attribution/dates are unchanged.

## Verification

All 17 pages at 320, 390, 768 and 1440px (68 layouts): no horizontal overflow; preserved sections, true heading levels, form controls/values and brand tokens. Compare `baseline-contract.json` with the generated inventory. Only explicit callout wording and the owner-requested statement-bar colour corrections are permitted authored-content/panel exceptions. Current UTC-offset labels are normalized because they are calculated for today by the browser time-zone database; every time-zone option value remains under exact comparison. Initial CI 44185288060 exposed this cross-browser offset difference; the preservation check was corrected without changing website time-zone behavior.

68 representative desktop/mobile keyboard-focus and hover probes cover light, taupe, dark, turquoise, white-form and native-disclosure contexts. Button text contrast is at least 4.5:1 and targets at least 44px. Error text remains readable. All earlier programme/form/navigation checks pass. Unit suite: 137 passed, one pre-existing skip. Isolated private-preview checks also cover 1024px. No real submissions or provider calls were made by these visual tests.

Reproduce after installing the existing browser tools:

```sh
node scripts/prepare-programme-form-qa.mjs
node scripts/visual-consistency-audit.mjs work/after work/visual-after
node scripts/visual-consistency-qa.mjs
node scripts/programme-form-browser-qa.mjs
npm test
```

The no-deployment public CI uploads all desktop/mobile screenshots and the complete computed-style/heading inventory. Selected before/after evidence is retained here. No formal screen-reader certification or fresh native release-package/inbox verification is claimed. The legacy static-generator missing-content-file limitation remains recorded in the existing development report.

Antique gold/bronze remains an exploration awaiting owner visual review. PR #23 stays draft; production, private records, recipient/provider settings, hosting settings and the audience are untouched.
