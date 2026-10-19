# Urlaubsplaner

Personal vacation planning with public holidays, school holidays (all countries
supported by OpenHolidays, including holiday regions such as the Dutch
Noord/Midden/Zuid), bridge days and optional synchronization between your own
devices.

Live application: https://urlaubsplaner.me/

## Stack

Next.js 15 (App Router), React 19, TypeScript, Auth.js (next-auth v5),
Prisma/PostgreSQL, React Query, Tailwind/Radix UI and Lucide icons. Holiday data
comes from [OpenHolidays API](https://openholidaysapi.org). The former
.NET/Blazor application was replaced in commit 44164dd; ignore older
documentation that describes it.

| Path | Purpose |
| --- | --- |
| `app/` | Pages and API route handlers |
| `components/` | Planner, calendar, settings and account UI |
| `hooks/` | React Query data hooks |
| `lib/` | Validation, accounts, holidays/regions, vacation accounting, iCalendar |
| `prisma/` | Schema and versioned additive migrations |
| `scripts/migrate.mjs` | Startup migration incl. baseline of old `db push` databases |

## Local development

Use Node.js 22 and PostgreSQL. Install with `npm ci`, copy `.env.example` to
`.env` and fill in local values, then run:

```sh
npm run db:migrate
npm run dev
```

### Environment variables

| Variable | Required | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | yes | Auth.js secret (`openssl rand -base64 32`) |
| `AUTH_URL` / `NEXTAUTH_URL` | yes in production | Public origin, e.g. `https://urlaubsplaner.me` |
| `ALLOWED_ORIGINS` | behind a proxy | Comma-separated trusted public hostnames for writes |
| `AUTH_KEYCLOAK_ID`, `AUTH_KEYCLOAK_SECRET`, `AUTH_KEYCLOAK_ISSUER` | no | Legacy Keycloak sign-in; offered only when all three are set |

Reverse proxies must replace incoming forwarded-host and forwarded-IP headers.
Never commit environment files or secrets.

## Personal accounts and synchronization

Guests can plan immediately; their plan stays in localStorage on that device.
Optional local accounts use a username (3–32 characters) and a password (12–128
characters). Registration needs no email address, no email verification and no
SMTP server. Passwords use salted scrypt; no external identity service is
required. Save the recovery key in a password manager: it is displayed once.
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
local credentials under **Mein Konto**. Keycloak is only this transition path:
it needs no self-registration (`registrationAllowed` may stay off) and no email
verification or SMTP. Its client must allow the redirect URI
`<AUTH_URL>/api/auth/callback/keycloak`, and `AUTH_KEYCLOAK_ISSUER` must be the
public realm URL (`https://<keycloak-host>/realms/<realm>`) because browsers are
redirected to it; the compose default `http://keycloak:8080/...` is only
reachable inside the Docker network. This keeps their existing user ID, entries
and calendar token. Accounts are never linked automatically by email.
The legacy provider is only offered while all three `AUTH_KEYCLOAK_ID`,
`AUTH_KEYCLOAK_SECRET` and `AUTH_KEYCLOAK_ISSUER` variables are configured.
Once every existing account has local credentials, those optional variables can
be removed by the deployment administrator. Existing identity-service volumes
must be retained according to the administrator's backup policy.

## Holidays and controls

Choose your home country, region (e.g. Bundesland or Dutch province) and, where
OpenHolidays defines them, a holiday group. Groups split school holidays inside
a country: the Netherlands use the regions Noord (`NL-NO`), Midden (`NL-MI`) and
Zuid (`NL-ZU`); Mecklenburg-Vorpommern distinguishes general and vocational
schools. A region in exactly one group selects it automatically; provinces such
as Utrecht or Zuid-Holland span several and ask for a choice. School holidays
are then loaded with `groupCode`, because the provider's subdivision filter
returns the holidays of every group of that region. Public holidays use the
subdivision filter. Countries without subdivisions need no region.

The comparison heatmap supports the regions of the home country (all 16 German
states, or the Dutch holiday regions). Comparison and additional countries never
change your personal vacation budget. Holiday intervals include their final day
and are clipped to the selected year. Unknown countries, regions or groups are
rejected (the provider would answer them with an empty list), and provider
failures are shown separately from "no holidays".

A planned vacation day costs 1 day, 0.5 on 24 and 31 December when enabled, and
nothing on public holidays of the home region or on weekends, unless
**Wochenende als Urlaubstage zählen** treats weekends as working days. "Verplant",
"Verbleibend", the red over-budget days and the suggestion budget all use this
rule (`lib/vacation-accounting.ts`). Imports only add missing entries and never
remove or overwrite existing ones; **Planung zurücksetzen** deletes all entries.

## Outlook and Apple Calendar subscriptions

Settings provide a private ICS subscription URL and an Apple Calendar shortcut.
In Outlook on the web, use **Add calendar → Subscribe from web**. On iPhone, use
**Calendar → Calendars → Add calendar → Add Subscription Calendar**.
Importing a downloaded ICS file is a snapshot, not ongoing synchronization.

The subscription requires no browser login. Anyone holding the private URL can
read the included entries; do not share it publicly. Notes are excluded by
default. Public/school holidays of the home region (incl. its holiday group) can be
enabled and cover the previous, current and next year; each holiday is one
multi-day event. Revoking the link invalidates the old URL; set
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

### Coolify

Use `docker-compose.external.yaml` with an existing PostgreSQL database (set
`DATABASE_URL`, optional `AUTH_KEYCLOAK_*`), or the standalone
`docker-compose.yaml`, which creates PostgreSQL and the legacy Keycloak.
Coolify generates `SERVICE_URL_URLAUBSPLANER`, `SERVICE_BASE64_URLAUBSPLANER`
and the `SERVICE_USER_*`/`SERVICE_PASSWORD_*` values. Magic variable names must
not contain `-`: Compose reads `${SERVICE_PASSWORD_KEYCLOAK-DB}` as variable
`SERVICE_PASSWORD_KEYCLOAK` with the default `DB`. Earlier versions of the
standalone file therefore resolved the Keycloak database user and password to
`DB`, the Keycloak admin password to `ADMIN` and the client secret to `CLIENT`.
The file now uses `SERVICE_USER_KEYCLOAKDB`, `SERVICE_PASSWORD_KEYCLOAKDB`,
`SERVICE_PASSWORD_KEYCLOAKADMIN` and `SERVICE_PASSWORD_KEYCLOAKCLIENT`.

For an existing standalone deployment, before redeploying: PostgreSQL keeps the
credentials a volume was created with, so set `KEYCLOAK_DB_USER` and
`KEYCLOAK_DB_PASSWORD` in Coolify to the values the running `keycloak-db`
container uses (`docker exec <keycloak-db> env | grep POSTGRES_`), or change the
password inside that database first. `KEYCLOAK_ADMIN_PASSWORD` only applies when
Keycloak creates its first admin; change an existing `ADMIN` password in the
Keycloak admin console. If the legacy sign-in is used, set
`AUTH_KEYCLOAK_SECRET` to the client secret configured in Keycloak.

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

Unit/regression checks: `npm test`; lint: `npm run lint` (ESLint flat config
with `next/core-web-vitals` and `next/typescript`); type checking:
`npm run typecheck`; production compilation: `npm run build`. The Docker build
also runs the tests.

`scripts/verify-integration.mjs` exercises registration, recovery, session
revocation, two independent devices, concurrent preferences, idempotent guest
imports, all-state holiday loading, Dutch holiday groups, region validation,
reset and unauthenticated calendar subscriptions.
Run it only against an isolated local production build with a disposable database:
`TEST_BASE_URL=http://127.0.0.1:3107 node scripts/verify-integration.mjs`.
The script refuses non-loopback destinations and never prints credential values.

The release pins `next-auth` 5.0.0-beta.32 / `@auth/core` 0.41.3, including
[the Auth.js security fixes](https://github.com/nextauthjs/next-auth/security/advisories/GHSA-8fpg-xm3f-6cx3).
The dependency audit still reports 18 findings (15 high, 3 moderate) elsewhere
in the existing dependency tree; no critical findings remain in the audited lockfile.
A separate dependency maintenance pass is required. This release does not claim
a complete security audit or upgrade the application to a new framework major.
