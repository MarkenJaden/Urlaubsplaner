# AGENTS.md (Urlaubsplaner)

## Current architecture

This repository is Next.js 15 / React 19 / TypeScript, not the former .NET app.
- `app/`: pages and server-side API handlers.
- `components/`: consumer UI, calendar, account settings and shared controls.
- `hooks/`: React Query state and device synchronization.
- `lib/`: validation, accounts, holidays, calendar serialization and planning.
- `prisma/`: PostgreSQL schema and versioned additive migrations.
- `scripts/migrate.mjs`: checked legacy baseline and migration startup.

## Commands

Use Node.js 22. Install dependencies with `npm ci`.
- Tests: `npm test`.
- Type checking: `npm run typecheck`.
- Build: `npm run build`.
- Development: `npm run dev`.
- Apply migrations: `npm run db:migrate` (only to an authorized database).

The current lint script requires an ESLint configuration; do not claim lint passes
without running a configured linter. Keep diffs focused and follow existing style.

## Account and data boundaries

Guests use localStorage. Authenticated users use PostgreSQL; writes must enforce
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
