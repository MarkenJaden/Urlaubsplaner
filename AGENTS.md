# AGENTS.md (Urlaubsplaner)

## Current architecture

This repository is Next.js 15 / React 19 / TypeScript, not the former .NET app.
- `app/`: pages and server-side API handlers.
- `components/`: consumer UI, calendar, account settings and shared controls.
- `hooks/`: React Query state and device synchronization.
- `lib/`: validation, accounts, holidays and holiday regions, vacation accounting,
  calendar serialization and planning.
- `prisma/`: PostgreSQL schema and versioned additive migrations.
- `scripts/migrate.mjs`: checked legacy baseline and migration startup.

## Commands

Use Node.js 22. Install dependencies with `npm ci`.
- Tests: `npm test`.
- Lint: `npm run lint` (ESLint flat config in `eslint.config.mjs`).
- Type checking: `npm run typecheck`.
- Build: `npm run build`.
- Development: `npm run dev`.
- Apply migrations: `npm run db:migrate` (only to an authorized database).

Do not claim a check passes without running it. Keep diffs focused and follow
existing style.

## Domain rules

Holidays follow OpenHolidays' country → subdivision → holiday group model
(`lib/holiday-regions.ts`); load school holidays with `groupCode` when a group is
known instead of hardcoding countries. Every vacation statistic, the over-budget
marking and the suggestion budget use `lib/vacation-accounting.ts`. Guest
settings (localStorage) and account preferences (JSON column) share the same
validation and merge rules in `lib/preferences.ts`. Imports must stay additive.

## Account and data boundaries

Accounts are local username/password accounts (scrypt, recovery key, no email);
Keycloak is only an optional legacy sign-in. Guests use localStorage.
Authenticated users use PostgreSQL; writes must enforce
session ownership, input validation and same-origin checks. Subscription feeds
use an independently revocable bearer token and must work without a browser
session. Never expose password hashes, recovery hashes or authentication secrets.
Never link accounts through an unverified email. Keep stable existing user IDs.

No destructive migration, database reset, production test data or volume deletion
without explicit authorization. Integration scripts must target disposable local
databases. Keep Prisma migrations in Git. Do not commit .env files, databases,
node_modules, .next, generated graphs, screenshots or test output directories.

## Releases

The main branch is `master`. Pushes trigger Docker image publication; do not infer
live deployment from build success. Verify actual public endpoints after rollout.
