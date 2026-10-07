# Personal planner design

Approved scope: consumer-oriented personal vacation planning, local accounts,
cross-device synchronization, correct German school holidays and all 16 states,
consistent controls, and a working Outlook/Apple Calendar subscription.

Guests continue planning locally. Optional username/password accounts use Auth.js
and Node's scrypt. A high-entropy recovery key provides account recovery without
SMTP. Existing Keycloak accounts retain their IDs and vacation entries and can
add local credentials while authenticated through the legacy provider. No account
is linked by an unverified email address. Sessions are revocable after recovery
or password changes. Persistent throttling limits authentication attempts.

PostgreSQL remains the shared source for authenticated entries and preferences.
Guest import is explicit, additive and idempotent. Authenticated devices refetch
on focus and periodically while active. Preference writes merge supplied fields;
per-date entry upserts prevent duplicates. Failed writes remain visible.

Calendar subscriptions use a revocable, high-entropy bearer token and require no
browser session. Events have stable UIDs, escaped text and exclusive next-day
end dates. Optional public and school holidays follow the selected home state.
Calendar apps control refresh latency; this is one-way subscription, not instant
two-way synchronization.

Holiday failures are distinct from empty results. School holiday intervals include
their final day and are clipped by the requested year. Comparison retains region
identity and counts each state at most once per date. Selection supports all 16
German states without mixing comparison holidays into the personal vacation budget.

Changes to the account schema are additive. Existing databases initialized through
db push get a checked baseline before versioned migrations. No production database
or existing Docker volume is accessed during local verification. Pushes to master
and their deployment side effects are explicitly authorized by the user.

Shared editing, invitations, social login and six-digit device pairing are future
features; personal cross-device synchronization does not depend on them.
