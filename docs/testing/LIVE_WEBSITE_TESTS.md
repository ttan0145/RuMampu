# Real production website checks

Language: **English** | [中文](LIVE_WEBSITE_TESTS.cn.md)

These scripts drive Chromium against the actual deployed frontend at
`https://rumampu-frontend.vercel.app/` and verify responses from
`https://rumampu.vercel.app/api/v1`. They do not run localhost servers, seed through
development endpoints, mock API responses, change LeanKit, or execute migrations.
The scripts run without an AI agent; send the failure report for diagnosis only when needed.

## Run

From `RuMampu/frontend`, with Node.js/npm installed:

```sh
# First setup only, or after pulling dependency changes:
npm ci
npx playwright install chromium

# Routine check: no financial records or housing scenarios saved.
npm run test:live

# Explicitly allow new synthetic records and run the full UI workflow.
npm run test:live -- --allow-writes

# Watch the same scripted workflow in a Chromium window.
npm run test:live -- --allow-writes --headed

# Open the most recent report.
npm run test:live:report
```

Use `npm run test:live -- --help` for help, or `--list` to list the selected test
without launching a browser. Exit code 0 means the selected test passed; a nonzero
code means the check or setup failed. Unexpected CLI options are rejected.

## Safety and evidence

- Each run gets a fresh browser context and a random `live-smoke-...` visitor ID.
  No existing browser profile, user storage state or login is imported. The script
  checks that the new guest has no income, work-cost entries or housing scenarios
  before proceeding. Observed browser API responses must use the expected origin
  and that same visitor ID.
- **Read-only means no financial-data writes**, not zero database activity:
  RuMampu creates an anonymous guest and default categories when first visited.
  The housing preview uses the non-persisting calculation POST. The read-only
  check verifies that no income, work costs or housing scenarios were saved.
- `--allow-writes` saves one RM 3,000 income, two Petrol costs and one housing
  scenario through the actual UI. Dates use the backend's current month and the
  previous month, both on day 1. The first cost changes from RM 50 to RM 60 and
  moves to the previous month; RM 25 remains in the current month.
- Synthetic records **remain on production in that isolated guest**. A failed
  run can leave fewer records. There is no reset/delete cleanup, no migration,
  and no reuse of previous visitor IDs. Use read-only mode for routine checks;
  avoid repeatedly running the writing flow unnecessarily.
- Automatic retries are disabled and there is one worker. Do not blindly rerun
  a failed write flow: inspect its failed step and retained-data note first.
- The latest HTML report is `output/playwright/live/report/index.html`; its
  machine-readable result is `output/playwright/live/report/results.json`.
  Screenshots and a compact API-status/guest manifest are attached to the report.
  Failure screenshots/traces are under `output/playwright/live/test-results/`.
  These directories are ignored by Git and replaced on the next run. Copy the
  report elsewhere if it needs to be retained before running again.
- Treat reports/traces as private: they contain the synthetic visitor identifier,
  which identifies its records. Do not publish raw traces or guest IDs to a public issue.
- `npm run test:e2e` and existing CI remain **local-only**; live tests have a
  separate directory/config and are never picked up by the default suite.

## Scope and AC relationship

These are `TECH-LIVE` engineering checks, not additional AC registrations or proof
that every Epic is closed. Formal AC registration remains in the existing suites.

| Existing AC / scope | Executable live step | Boundary |
| --- | --- | --- |
| AC1.3.1 | TECH-LIVE-01/02: five default category choices visible | Normal-path loading, not injected partial failure |
| AC1.1.6, AC1.3.2/3/5/6 | TECH-LIVE-02: save income; reject zero; append two costs | One synthetic guest; no custom-category coverage |
| AC1.3.7/8/9/10 | TECH-LIVE-02: single-record edit, cross-month move, unavailable prior-month net, reload, calculated RM 2,975 | No exhaustive date/boundary matrix |
| AC2.1.1/2/3 | TECH-LIVE-02: one-month chart and API both show RM 2,975 | One-month integration smoke, not full Epic 2 acceptance |
| AC3.2.4/5, AC3.3.1, AC3.4.1/2/3 | TECH-LIVE-02: real pre-check and housing results at RM 1,230 and RM 3,030; latter gap RM 55 | Uses Home → Re-test the house; not all navigation routes |
| Partial-load recovery | Local TECH-WC-05/06/07 in `e2e/work-costs-hardening.spec.ts` | Faults are injected locally, never into the production script |

The separate observed Result/Back navigation loop, production Debug configuration,
UI redesign, native-device compatibility and exhaustive Epic coverage are not
certified by these checks. A Git push is not proof that Vercel has deployed that
exact commit; live results describe the version actually served at execution time.

## Verified 2026-09-03

- Production read-only: **1/1 passed, 14.4 seconds**.
- Production full UI flow: **1/1 passed, 31.9 seconds**, including persistence,
  RM 2,975 net income, and the RM 55 housing gap. No API failure, page exception,
  guest mismatch or unexpected API origin was observed.
- Frontend/application and E2E TypeScript checks passed.
- Backend: **106/106 passed** on local SQLite; no migration drift detected.
- Full local browser regression: **35/35 passed, 2.5 minutes**. Traceability
  remained Epic 1 60/60 and Epic 2 18/18, each formal identifier mapped once.
- Live checks did not alter UI design, requirements, ACs or LeanKit.

Each future run is a new measurement, not a guarantee that production stays healthy.
