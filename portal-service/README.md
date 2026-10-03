# Auxesis Portal Service

Production backend for the Auxesis Cloudflare Pages portal. The public website stays at its existing address. Floot provides managed PostgreSQL, private object storage and brokered Google identity; Cloudflare Pages Functions own the first-party session cookie and proxy authenticated requests. The prototype remains separate.

Only explicitly invited accounts are admitted. All records and file requests are authorized server-side; snapshots are filtered by family and role before leaving the service. No sample families or preview account controls are deployed.

Live service: https://auxesis-portal-service.floot.app
Floot project: 8ccfb85d-97a5-4359-b701-9f9a48672fab

The executable endpoint and helper copies here match the managed service. The managed project also supplies the generated schema/db helper, Google OAuth provider and service SDKs; they are not built by the static website. Changes to the service must be applied and published in that project. Website deployment runs `python3 scripts/build.py`, including the portal route builder.

Run local checks with `node --test tests/*.test.mjs` and `python3 scripts/check_site.py` after building. The backend workflow test runs through Floot's project VM and uses explicitly marked temporary QA records. Remove those fixtures and test sessions before release. Do not run destructive QA cleanup against populated production data.

The portal uses Google identity for invited emails, rather than the prototype's demonstration email-link flow. Invitations are prepared for Amanda to copy and send. Notifications are saved in the portal and delivered live while it is open; automatic notification email requires a verified sender domain. Transfers and PayPal are external payment methods; the portal does not connect to bank accounts.
