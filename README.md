# Urlaubsplaner

Personal vacation planning with German public holidays, school holidays, bridge
days and optional synchronization between your own devices.

Live application: https://urlaubsplaner.me/

## Stack

Next.js 15, React 19, TypeScript, Auth.js, Prisma/PostgreSQL, React Query,
Tailwind/Radix UI and Lucide icons. Holiday data comes from OpenHolidays API.

## Local development

Use Node.js 22 and PostgreSQL. Install with `npm ci`, configure the database and
an authentication secret in your local environment, then run:

```sh
npm run db:migrate
npm run dev
npm test
npm run typecheck
npm run build
```

`DATABASE_URL` selects PostgreSQL. `AUTH_SECRET` (or the existing
`NEXTAUTH_SECRET`) must be a securely generated secret. Configure `AUTH_URL`
(or the existing `NEXTAUTH_URL`) with the public application origin.
`ALLOWED_ORIGINS` lists trusted proxy hostnames for server actions and writes.
Reverse proxies must replace incoming forwarded-host and forwarded-IP headers.
Do not commit environment files or secrets.

## Personal accounts and synchronization

Guests can plan immediately; their plan stays in localStorage on that device.
Optional local accounts use a username (3–32 characters) and a password (12–128
characters). Passwords use salted scrypt; no external identity or email service
is required. Save the recovery key in a password manager: it is displayed once.
Recovery rotates that key and revokes all previous device sessions.

Settings provide credential changes, sign-out on every device and explicit
account deletion. There is no administrator role or shared editing in this release.
Accounts synchronize vacations, notes and settings. Active devices refresh every
15 seconds and on returning to the app. Concurrent preference changes merge;
entry changes to the same date/type follow the latest committed write.

After logging in, choose **Lokalen Plan übernehmen** to import guest entries and
settings. Existing server entries are preserved and repeated imports do not
create duplicates. The local source remains available. Existing server settings
win over conflicting imported settings.

Existing Keycloak users can use **Bestehendes Konto übernehmen**, then configure
local credentials under **Mein Konto**. This keeps their existing user ID, entries
and calendar token. Accounts are never linked automatically by email.
The legacy provider is only offered while all three `AUTH_KEYCLOAK_ID`,
`AUTH_KEYCLOAK_SECRET` and `AUTH_KEYCLOAK_ISSUER` variables are configured.
Once every existing account has local credentials, those optional variables can
be removed by the deployment administrator. Existing identity-service volumes
must be retained according to the administrator's backup policy.

## Holidays and controls

Choose a home state for personal holiday calculations. The comparison supports
all 16 German states and highlights overlapping school holidays. Each state is
counted once per date; comparison holidays do not change your personal vacation
budget. Holiday intervals include their final day and are clipped to the selected
year. Missing data and provider failures are shown separately.

## Outlook and Apple Calendar subscriptions

Settings provide a private ICS subscription URL and an Apple Calendar shortcut.
In Outlook on the web, use **Add calendar → Subscribe from web**. On iPhone, use
**Calendar → Calendars → Add calendar → Add Subscription Calendar**.
Importing a downloaded ICS file is a snapshot, not ongoing synchronization.

The subscription requires no browser login. Anyone holding the private URL can
read the included entries; do not share it publicly. Notes are excluded by
default. Public/school holidays for the home state can be enabled and cover the
previous, current and next year. Revoking the link invalidates the old URL; set
up a new subscription on your devices afterward. Events retain stable UIDs and
use date-only, exclusive next-day ends. If holiday fetching fails, the entire feed
returns 503 rather than serving incomplete data that could appear as deletions.

This is a read-only, one-way subscription. Make changes in Urlaubsplaner.
Calendar apps control refresh timing; Outlook can take more than 24 hours.
References: [Microsoft](https://support.microsoft.com/en-us/outlook/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web?ad=us&rs=en-us&ui=en-us),
[Apple](https://support.apple.com/en-lamr/guide/iphone/iph3d1110d4/ios).

## Deployment and migrations

Pushes to `master` trigger the Docker publication workflow in
`.github/workflows/docker-publish.yml`. That publishes a tested image; activation
by the hosting platform is a separate step and must be verified on the live site.
The container listens on port 3000. `/api/health` is a liveness endpoint and does
not prove database or login readiness.

Container startup runs `scripts/migrate.mjs` and starts the app only after
migration success. Empty databases receive the baseline and local-account
migrations. Existing databases created with the previous `db push` startup are
checked against the legacy column layout, types and nullability before baselining.
Migration adds optional credentials and a session version; it keeps existing IDs,
entries and calendar tokens. No data-loss flags or destructive resets are used.
`npm run db:push` remains available only for deliberate disposable development.

Take a database backup through your normal deployment process before rollout.
For rollback, redeploy the previous application/image commit. The account
migration is additive, so the old app can continue using its existing columns;
new local-only accounts cannot sign into the old Keycloak-only app. Do not reverse
migrations or remove database volumes as part of an application rollback.

`docker-compose.yaml` retains the former Keycloak services and credential
fallbacks so unchanged standalone deployments can migrate existing accounts.
After migrating every account, administrators can remove those services and
provider variables while retaining their backups. The external
compose file uses an existing PostgreSQL database and optionally an existing
legacy identity provider. Compose volume names are unchanged.

## Verification

Unit/regression checks: `npm test`; type checking: `npm run typecheck`;
production compilation: `npm run build`. The pre-existing `npm run lint` command
requires an ESLint configuration and is not a verified lint gate in this checkout.

`scripts/verify-integration.mjs` exercises registration, recovery, session
revocation, two independent devices, concurrent preferences, idempotent guest
imports, all-state holiday loading and unauthenticated calendar subscriptions.
Run it only against an isolated local production build with a disposable database:
`TEST_BASE_URL=http://127.0.0.1:3107 node scripts/verify-integration.mjs`.
The script refuses non-loopback destinations and never prints credential values.

The release pins `next-auth` 5.0.0-beta.32 / `@auth/core` 0.41.3, including
[the Auth.js security fixes](https://github.com/nextauthjs/next-auth/security/advisories/GHSA-8fpg-xm3f-6cx3).
The dependency audit still reports 18 findings (15 high, 3 moderate) elsewhere
in the existing dependency tree; no critical findings remain in the audited lockfile.
A separate dependency maintenance pass is required. This release does not claim
a complete security audit or upgrade the application to a new framework major.
