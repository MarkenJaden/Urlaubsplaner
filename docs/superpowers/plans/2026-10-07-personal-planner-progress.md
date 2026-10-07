# Implementation ledger — plan: 2026-10-07-personal-planner.md

- Baseline: master at 2d4f6ad; initial working tree clean.
- Authorization: user approved the presented plan and all implementation, commits, pushes and automatic deployment. No additional planning approval round is needed.
- Graphify: 336 structural nodes / 685 edges in a temporary output directory. Code-review-graph impact analysis: account/calendar/settings changes span the app; implement coherent releases.
- Ruling: retain legacy Keycloak only as an authenticated transition path, rather than orphan existing stored vacations. New accounts use in-app credentials.
- Ruling: six-digit pairing and social login remain future scope, as agreed; the implemented synchronization uses the personal account.
- Ruling: work directly in the authorized master checkout; no worktree is required for this clean, explicitly approved checkout.

- Baseline checks: 41 tests passed; original production build passed with network access for Inter font. Original lint is interactive because no ESLint config exists; not used as a gate.
- Tasks 1–4 implemented. Unit suite: 57 passing. Typecheck and production build passed.
- Fresh and legacy PostgreSQL migration verified in isolated Docker container. Synthetic legacy user ID and vacation entry preserved (1/1 each).
- Integration: 44 checks passed, including both devices, concurrent settings, recovery/session revocation, anonymous feed, token rotation and all 16 states.
- Ruling: coherent account/schema/UI changes ship together after verification instead of deploying partially integrated intermediate commits.
- Review correction: retain standalone legacy compose services and original credential fallbacks so existing accounts remain accessible on unchanged upgrades. Local accounts do not depend on the provider. Existing volume names are unchanged.
- Ruling: retain the existing unconfigured lint script and document its limitation; no unrelated lint-driven rewrite.

- Final independent review: two Important and three Minor findings corrected. Regression tests first failed for vacation loading and duplicate regions, then passed.
- Final checks: 59 tests / 7 suites; typecheck; production build; 44 isolated API integration checks; compose syntax and legacy-environment compatibility; git diff whitespace check.
- Responsive visual check: all 16 states selected, 325px effective mobile viewport, document client/scroll width both 312px; desktop inspected after restoring normal viewport.
- Docker context excludes local builds, analysis outputs, environment variants and Git metadata.

- Post-push dependency check found existing Auth.js advisories. Updated only Auth.js and its authentication dependencies to the official compatible patched release, retaining platform metadata in the lockfile. Remaining audit: 18 findings (15 high, 3 moderate), no critical findings. Broader dependency upgrades are outside this feature release.
