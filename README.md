# Auxesis Education website

The complete approved website, taken directly from prototype version 6. Includes ten public pages, a 404 page, the approved logo, locally hosted Fraunces and Figtree fonts, responsive styling, menus, recommendation cards, enquiry/review forms, Decap editing and Cloudflare Pages API functions.

The existing design and wording are preserved. This is a deployment package, not an already launched public website. Account configuration and live integration checks remain necessary.

## Framework and dependencies

Static HTML/CSS/browser JavaScript, generated with Python 3.10+ standard library. No frontend framework or build packages are required. Shared header, footer, call-to-action and recommendation renderers avoid copying those components into every source page. Page content is JSON, separate from the layout. Decap CMS 3 is loaded from its official documented jsDelivr distribution; it is only loaded on `/admin/`. Cloudflare API functions use native Web APIs. Node 22+ runs the API tests. Playwright is optional for browser QA.

## Run locally

```sh
python3 scripts/build.py
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080/`. A plain static server previews the website only; it does not execute Cloudflare Functions. For local API work, use Wrangler Pages dev with `dist` and the root `functions` directory, and add local secrets in an ignored `.dev.vars` file. GitHub OAuth is intended to be tested on the configured HTTPS origin, not localhost.

```sh
node --test tests/api.test.mjs
python3 scripts/check_site.py
```

## Connect accounts and launch

1. Create a **private GitHub repository** in Amanda's own account. Upload this project at the repository root, excluding `.env`, `.dev.vars` and any real keys. Do not put it inside an extra ZIP-name folder. Use `main` as the production branch.
2. In Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**. Connect that repository. Build command: `python3 scripts/build.py`. Output directory: `dist`. Root directory: repository root. The root `functions/` folder is essential; uploading only `dist` omits the API.
3. Configure a site address and repository. Start with the Cloudflare-assigned HTTPS address, or the final domain once connected. Run this one-time command in the source checkout, with the actual values, and commit the changed JSON:

```sh
python3 scripts/configure.py --site-url https://YOUR-ACTUAL-SITE --github-repository YOUR-USERNAME/YOUR-REPO --email YOUR-PUBLIC-EMAIL
```

4. In GitHub **Settings → Developer settings → OAuth Apps → New OAuth App**, use the same site origin as the homepage and `https://YOUR-ACTUAL-SITE/api/callback` as the authorization callback. Add the Client ID and Client Secret to Cloudflare. The editor uses GitHub's `repo` OAuth scope for private repository editing. Restrict `GITHUB_ALLOWED_LOGIN` to Amanda's GitHub username; the server also checks write access to the configured repository.
5. In Resend, verify a sender domain and create a sending API key. Add `RESEND_API_KEY`, `EMAIL_FROM` and `ENQUIRY_TO` to Cloudflare. Resend sends website notifications; it does not provide Amanda's business mailbox. Reviews are sent to Amanda for approval and are never automatically published.
6. In Cloudflare Turnstile, create a widget allowing the exact site hostname. Add its secret key to Cloudflare as `TURNSTILE_SECRET_KEY`. Run the configure command again with `--turnstile-site-key YOUR-PUBLIC-SITE-KEY`. Both forms require a valid Turnstile token for live delivery.
7. Set Cloudflare's `SITE_URL`, `GITHUB_REPOSITORY`, `GITHUB_ALLOWED_LOGIN`, `GITHUB_CLIENT_ID` and the secrets described above. See `.env.example`. **These are runtime variables**; the public settings JSON holds only the origin, repository, images, email and public Turnstile key.
8. Open `/admin/`, sign in with GitHub and check page editing, image uploads, previews, draft workflow and Publish. A published content change commits to GitHub and triggers a Cloudflare deployment. Enable Cloudflare preview deployments for CMS workflow branches. Test a real enquiry and a real review, confirm inbox delivery, and then remove the test submissions from the mailbox if desired.
9. Purchase the chosen domain from the registrar Amanda prefers. In Cloudflare Pages, use **Custom domains → Set up a custom domain**. For an apex domain such as `auxedu.com`, add the domain to Cloudflare and change its nameservers at the registrar. Preserve and re-create existing mail/DNS records when moving DNS. Do not buy a registrar website-builder or hosting package for this route. Mailbox hosting is separate.
10. If the site origin changes from `pages.dev` to the final domain, update the public settings, Cloudflare `SITE_URL`, GitHub OAuth homepage/callback and Turnstile hostname together. Confirm login and form delivery on the final origin. Run the configure command with `--launch` to remove the private-prototype banner, permit search indexing and add canonical links, sitemap and robots.txt. Until then, the package deliberately keeps the existing prototype banner and noindex metadata.

## Everyday editing

Open your website's `/admin/` page. Choose **Website pages**, **Shared content** or **Recommendations**. Text blocks have labels identifying their headings and paragraphs. Save a draft, inspect its preview, mark it Ready and Publish. Allow time for Cloudflare to rebuild before checking the public page. Use **Contact details and images** to change the public email, upload Amanda's photograph or replace the logo with another approved asset. Images stay in the repository. Existing recommendation IDs must remain unchanged; the three approved homepage excerpts use `macel`, `lynne` and `vy`. Add further recommendations to their appropriate parents/students/colleagues section.

The editor supports content and images. Layout, navigation destinations, form fields and visual design remain controlled by the templates/CSS. It is not a free-form drag-and-drop page builder.

## Existing unfinished prototype items

- A public business email and professional photograph were not supplied in the prototype. Their existing placeholders are preserved until configured.
- **Portal / Sign in** was a noninteractive reserved label in the original. It remains so; no student portal or authentication workflow has been invented.
- All approved wording, including the prototype's current 12-hour cancellation policy, is retained. This export does not substitute older conversation rules for current website content.
- Before public launch, review the Privacy & Consent text against the configured email provider and spam-protection service. No analytics or advertising trackers have been added.

## Validation and handoff

See `docs/TESTING.md` for completed checks and outstanding live/browser checks. Account sign-in, provider provisioning, domain purchase and real credentials cannot be completed from this package alone. Local/mock tests do not establish end-to-end production delivery.

For Floot or another developer: the static frontend is portable; the four API routes are Cloudflare Pages Functions. If hosting on a different service, adapt their request handlers to that service and preserve the same URLs. There is no subscription dependency on Floot.

## Sources

- Prototype provenance: `docs/SOURCE.md`
- Cloudflare Pages: https://developers.cloudflare.com/pages/
- Decap setup: https://decapcms.org/docs/install-decap-cms/
- Decap GitHub backend: https://decapcms.org/docs/github-backend/
- Resend send API: https://resend.com/docs/api-reference/emails/send-email
- Turnstile server validation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
