# Prelaunch implementation log: portal availability

Amanda has already decided that the student/parent portal is unavailable and its public availability promises must be removed. This implements that existing decision; no repeat approval is requested.

## Completed in this branch; not deployed

* A01: Removed the header and footer portal sign-in links, including the shared 404 navigation. Portal routes, code and owner review administration remain.
* A03: Removed onboarding step 05, “Your Auxesis Portal”: “Once tutoring is confirmed, the student receives access to their private Auxesis Portal. This becomes their central place for upcoming lessons, lesson information, resources, assignments and progress.” Renumbered Ongoing tutoring from 06 to 05.
* A02, A04–A13 and A15: Replaced unavailable portal promises in Enquire, How Tutoring Works, FAQ and Privacy. Exact original and replacement wording follows. Privacy edits preserve existing data-storage disclosures and collection scope; they do not claim stored private records have disappeared.

Payment and cancellation terms, credentials, rates, inquiry implementation and reviews are not rewritten in this focused change. The audit’s unanswered policy questions do not reverse Amanda’s existing decisions.

## Release path

The verified migration branch is b61403a37831264d3e0ef2e47910ad6579a4fe2a. Its existing reviews workflow downloads a checksum-verified private runtime package and deploys its dist; the ordinary Python build is not a replacement for that package.

`scripts/prelaunch-public-copy.py PATH/TO/VERIFIED-RUNTIME/dist` applies only the logged paragraph changes and shared portal navigation/step removals to that package. It validates all expected copy before writing, is repeatable, and leaves scripts, forms, styles and runtime files intact. It has no network, deployment or database operations. It rejects the repository’s ordinary dist as an input.

This does not complete production source verification: the private runtime package has not been recovered in this workspace and the overlay has not been tested against that exact package. Do not deploy an ordinary repository build. Before release, obtain the existing verified package, apply the overlay, inspect the resulting diff and run the runtime’s existing review tests plus mobile and inquiry checks. Update the existing release assertions that currently require the removed portal paragraph before using that release workflow. No workflow trigger or provider configuration was changed here.

Inquiry PR #18 remains draft; its production credential and delivery checks remain separate. No live inquiry delivery is claimed.

## Validation

* Build passed; link checker passed 28 HTML files and 524 local references.
* Existing tests: 103 total, 102 passed, one private-fixture test skipped, zero failed.
* Overlay checked against the audit checkout’s original generated pages, with additional review markup and worker sentinels: unrelated markup/assets/worker preserved; repeat produces identical output; unexpected paragraph aborts before any writes.
* These are local checks, not a production or actual private-package sign-off.

## Exact paragraph log

### A02: enquire / enquire-016

Status: existing portal-unavailability decision implemented in branch; production pending.

Original: There's no pressure to commit. If you decide to proceed, I'll arrange the first lesson and provide access to the private Auxesis Portal.

Replacement: There's no pressure to commit. If you decide to proceed, I'll arrange the first lesson.

### A04: how-tutoring-works / how-tutoring-works-020

Status: existing portal-unavailability decision implemented in branch; production pending.

Original: The Auxesis Portal is the central place for planning, lesson records and resources. A shared Google Drive folder may also be used for documents we work on together. Students should download or copy any resources they want to keep before access ends.

Replacement: A shared Google Drive folder may be used for documents we work on together.

### A05: how-tutoring-works / how-tutoring-works-021

Status: existing portal-unavailability decision implemented in branch; production pending.

Original: Students contact me through the private Auxesis Portal between sessions. After enrolment, parents may also choose to communicate through WhatsApp; I do not require WhatsApp as part of the tutoring setup. I normally reply within 24 hours on business days, excluding Canadian statutory holidays.

Replacement: Students can contact me by email between sessions. After enrolment, parents may also choose to communicate through WhatsApp; I do not require WhatsApp as part of the tutoring setup. I normally reply within 24 hours on business days, excluding Canadian statutory holidays.

### A06: how-tutoring-works / how-tutoring-works-025

Status: existing portal-unavailability decision implemented in branch; production pending.

Original: Students can send me a quick question through the private Auxesis Portal if they get stuck. I can answer a brief question outside a session. Questions requiring a fuller explanation, substantial review or extended support are best addressed during a scheduled session. Extra support can be booked in 30-minute increments when I have availability, and detailed marking or extended feedback can be handled during a session or arranged separately.

Replacement: Students can email a quick question if they get stuck. I can answer a brief question outside a session. Questions requiring a fuller explanation, substantial review or extended support are best addressed during a scheduled session. Extra support can be booked in 30-minute increments when I have availability, and detailed marking or extended feedback can be handled during a session or arranged separately.

### A07: faq / faq-007

Status: existing portal-unavailability decision implemented in branch; production pending.

Original: Sessions are live and one-to-one. The student will be answering questions, explaining their thinking and working through problems rather than just listening. I adjust the explanation and level of support as needed. Lesson information and resources are kept together in the private Auxesis Portal.

Replacement: Sessions are live and one-to-one. The student will be answering questions, explaining their thinking and working through problems rather than just listening. I adjust the explanation and level of support as needed.

### A08: faq / faq-013

Status: existing portal-unavailability decision implemented in branch; production pending.

Original: Whenever possible, tell me at least 48 hours before the session what you want to focus on. Add your questions and any school materials you want to use to the lesson’s planning record in the private Auxesis Portal in advance. If you have nothing specific to send, I can prepare suitable resources.

Replacement: Whenever possible, tell me at least 48 hours before the session what you want to focus on. Email your questions and any school materials you want to use in advance. If you have nothing specific to send, I can prepare suitable resources.

### A09: faq / faq-015

Status: existing portal-unavailability decision implemented in branch; production pending.

Original: Lesson notes and next steps are available in the private Auxesis Portal. I can also publish monthly progress reports for parents and guardians there. Updates are adapted to the family rather than following a fixed schedule. Parents are welcome to contact me with questions, and I normally reply within 24 hours on business days, excluding Canadian statutory holidays.

Replacement: I keep parents informed about what we are working on, how things are progressing and anything I think they should know. Updates are adapted to the family rather than following a fixed schedule. Parents are welcome to contact me with questions, and I normally reply within 24 hours on business days, excluding Canadian statutory holidays.

### A10: privacy-consent / privacy-consent-003

Status: existing portal-unavailability decision implemented in branch; production pending.

Original: Auxesis Education collects only the information needed to respond to an enquiry, arrange tutoring and manage the tutoring relationship. Depending on the situation, this may include a parent or guardian’s name, email address and phone number; the student’s first name and personal Gmail address; country, optional nationality and pronouns, and time zone; grade or year level; curriculum or programme; subject; learning goals or challenges; scheduling information; and whether tutoring is being requested for more than one student. During tutoring, this also includes lesson planning, lesson notes, resource links, messages, progress reports, invoices and payment records held in the private Auxesis Portal.

Replacement: Auxesis Education collects only the information needed to respond to an enquiry, arrange tutoring and manage the tutoring relationship. Depending on the situation, this may include a parent or guardian’s name, email address and phone number; the student’s first name and personal Gmail address; country, optional nationality and pronouns, and time zone; grade or year level; curriculum or programme; subject; learning goals or challenges; scheduling information; and whether tutoring is being requested for more than one student. During tutoring, this also includes lesson planning, lesson notes, resource links, messages, progress reports, invoices and payment records.

### A11: privacy-consent / privacy-consent-004

Status: existing portal-unavailability decision implemented in branch; production pending.

Original: Student phone numbers are not normally collected or used. Students communicate with me through their private message thread in the Auxesis Portal. Parents may choose to create a WhatsApp group after enrolment, and I am happy to participate, but WhatsApp is not a required student communication channel.

Replacement: Student phone numbers are not normally collected or used. Students can contact me by email. Parents may choose to create a WhatsApp group after enrolment, and I am happy to participate, but WhatsApp is not a required student communication channel.

### A12: privacy-consent / privacy-consent-007

Status: existing portal-unavailability decision implemented in branch; production pending.

Original: The Auxesis Education website and live private Portal run on Cloudflare Pages and Workers. Cloudflare D1 stores Portal accounts, lesson records, messages, progress reports, invoices and payment records, as well as submitted reviews and their consent and moderation status. This describes record storage; it does not mean Cloudflare collects payments or stores every document used for tutoring. The live Portal no longer runs on Floot.

Replacement: The Auxesis Education website runs on Cloudflare Pages and Workers. The student and parent portal is still in development and is not currently available to families. Cloudflare D1 stores existing private Portal accounts and tutoring records, as well as submitted reviews and their consent and moderation status. This describes record storage; it does not mean Cloudflare collects payments or stores every document used for tutoring.

### A13: privacy-consent / privacy-consent-008

Status: existing portal-unavailability decision implemented in branch; production pending.

Original: Google provides Portal sign-in and processes the account information used to identify authorised users. Google Meet is used for live tutoring sessions. Google Calendar holds scheduling information, and the Google Sheets Student Tracker remains the authoritative billing record. Google Drive is used for shared lesson documents and privately stored recovery packages; these files are separate from the Cloudflare Portal database.

Replacement: Google processes account information used for authorised sign-in. Google Meet is used for live tutoring sessions. Google Calendar holds scheduling information, and the Google Sheets Student Tracker remains the authoritative billing record. Google Drive is used for shared lesson documents and privately stored recovery packages; these files are separate from the Cloudflare Portal database.

### A15: privacy-consent / privacy-consent-011

Status: existing portal-unavailability decision implemented in branch; production pending.

Original: The Portal uses necessary sign-in and session cookies. Cloudflare processes technical request information to deliver the website and its services, and Google processes information needed for its sign-in and other services. These functions are separate from advertising or marketing tracking.

Replacement: Necessary sign-in and session cookies are used for authorised access. Cloudflare processes technical request information to deliver the website and its services, and Google processes information needed for its sign-in and other services. These functions are separate from advertising or marketing tracking.


## Recovery work started

GitHub Actions run 38049880574 (10 October 2026) successfully retrieved the checksum-verified runtime and completed release verification. The runtime is therefore retrievable through that established access path, subject to current credentials and environment permission. Connected Drive search and the development folder did not expose the archive.

Added a dedicated branch-only workflow, `prelaunch-runtime-check.yml`, using the existing protected environment and credential bindings. `prelaunch-runtime-recover.mjs` restricts Cloudflare requests to project reads and three exact metadata/authorization SELECT queries, downloads and verifies the private package with the existing privacy/size/extraction checks, then runs the private review tests and validates the public copy overlay. It performs no provider configuration/database writes or deployment and uploads no private artifacts. Existing environment protection remains in force; if this branch is disallowed, the run must fail rather than bypassing it.
