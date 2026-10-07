# Personal Planner Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans in this session. Track verification and decisions in the implementation ledger.

**Goal:** Deliver app-owned accounts, synchronized personal plans, reliable holidays and calendar subscriptions.
**Architecture:** Retain Next.js, Auth.js, Prisma/PostgreSQL, React Query and the existing UI primitives. Add local credentials alongside a temporary legacy account migration path; centralize calendar serialization and profile validation.
**Tech Stack:** Existing package-lock dependencies plus Node built-in crypto.
**Spec:** `docs/superpowers/specs/2026-10-07-personal-planner-design.md`

## Global Constraints
- Preserve user IDs, vacation entries, guest data and unrelated files.
- No .env changes, production database access or destructive schema operations.
- Local accounts need no external identity or email service.
- Build and tests must pass before each release is pushed to master.
- Calendar subscriptions are read-only and provider refresh latency is disclosed.

## Review Focus
- Legacy accounts must not be taken over through email matching or unauthenticated linking.
- Recovery and password changes must invalidate stale sessions and old recovery keys.
- Foreign origins, duplicate requests and invalid dates must not mutate account data.
- Signed-in preference changes and guest import must survive refresh on another device.
- Subscription updates must keep stable UIDs and dates around DST and year boundaries.

### Task 1: Repair calendar subscriptions
Files: `lib/calendar.ts`, `lib/calendar.test.ts`, `lib/export.ts`, `middleware.ts`, `app/api/calendar/[token]/feed.ics/route.ts`.
- [ ] Write failing tests for stable UIDs, next-day ends, escaping, Unicode folding and middleware-free token feed access.
- [ ] Implement shared ICS serialization, token-only feed access and optional regional holidays.
- [ ] Verify targeted tests and full build; commit.

### Task 2: Local accounts and additive migration
Files: `auth.ts`, `lib/user.ts`, `lib/password.ts`, `lib/rate-limit.ts`, `lib/account.ts`, account API routes, Prisma migrations, `start.sh`, account forms.
- [ ] Test password validation, scrypt verification, recovery validation, throttling, authorization and safe legacy linking.
- [ ] Add nullable credentials and sessionVersion to User, persistent rate limits, registration/recovery/account management and revocable sessions.
- [ ] Add baseline-aware startup migrations and exercise them against an isolated PostgreSQL database.
- [ ] Verify tests, typecheck, build and account flows; commit.

### Task 3: Persistent preferences, synchronization and holiday selection
Files: profile/vacation APIs, hooks, CalendarClient, SettingsClient, holiday normalization/helpers, settings/combobox/year view.
- [ ] Test input validation, per-year preferences, additive imports, interval clipping and unique state counts.
- [ ] Persist signed-in settings, show write/load errors, refetch active devices and add explicit guest-plan transfer.
- [ ] Support all-state selection, named comparison states and independently retryable school holiday requests.
- [ ] Verify regression tests and build; commit.

### Task 4: Consumer UI and subscription setup
Files: header, toolbar, settings panels, day details, shared button and styles.
- [ ] Use consistent Lucide icons, clear action hierarchy, accessible names and touch targets.
- [ ] Add account settings, recovery-key handling, subscription filters, token rotation and Outlook/iPhone instructions.
- [ ] Verify desktop/mobile flows and screenshots; commit.

### Task 5: Release verification
Files: README, AGENTS.md, package scripts, Docker/workflow as required by verified failures.
- [ ] Document actual Next.js commands, account migration, recovery, subscription privacy and deployment rollback.
- [ ] Run suite, typecheck, production build, isolated DB migration and browser/API smoke tests.
- [ ] Obtain final independent code review; fix material findings and rerun affected checks.
- [ ] Inspect exact staged paths, commit and push master; inspect Docker workflow and public application health/features.
