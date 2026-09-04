# Project changelog

Language: **English** | [Chinese (CN)](CHANGELOG.cn.md)

## 2026-09-04 — Income deletion and Work costs regression protection

- Removed a legacy Work costs notice and duplicated row provenance that returned in the income-deletion commit; restored the responsive row layout.
- Removed repeated `YOUR DATA` labels from editable Commitment rows while retaining `CALCULATED` on the derived total.
- Enabled decimal keyboards and decimal-value persistence for Commitment amounts on mobile.
- Standardised mobile decimal input for new income, manual expenses, and custom income-shock percentages.
- Added an end-to-end regression for deleting the last monthly income while preserving dated work costs and recalculating the month as having no income.
- Added API coverage for ownership isolation, repeated deletion, empty-period cleanup, sibling preservation, and work-cost preservation; regenerated OpenAPI with the DELETE operation.

## 2026-08-28 — I1 backend-authoritative housing calculations

Status: complete and verified for main delivery

### Delivered

- Changed the formal housing flow to create or update a guest-owned scenario, request the independent pre-housing check, and run the historical test by scenario ID.
- Reused `/housing/test-result/` for payment comparisons and income-drop scenarios through non-persisted overrides; the formal frontend no longer calls the stateless `/housing/test/` endpoint or submits client-derived finance months.
- Removed frontend housing formulas and the `preHousingOk()` navigation decision from `calc.ts` and `state.tsx`.
- Added backend-authoritative upfront gaps and starting-liquidity paths, then changed Home and Preparation screens to render retained server responses.
- Added serializer/service/API coverage, regenerated OpenAPI, and recorded the decision in ADR 0004.

### Verification

- Full backend suite: 98 tests passed, including 18 housing tests.
- TypeScript and OpenAPI validation passed; Django system checks and migration-drift checks passed.
- The complete Playwright suite passed 28/28 scenarios; the traceability gate confirmed Epic 1 at 56/56 ACs and Epic 2 at 18/18 ACs.
- Fixed profile bootstrap when an income-entry request is the first request in a session, so historical totals cannot leave the profile without default sources, work costs, commitments, or expense categories.

## 2026-08-26 — Playwright acceptance-test standardisation

Status: implemented locally; not committed or pushed

### Delivered

- Standardised browser acceptance as `Epic → US → AC`, with formal ACs exposed as named report steps and non-requirement regressions separated as `TECH-*` hardening tests.
- Added an executable Epic 1 suite with 8 US scenarios and exact 56/56 AC mapping; reorganised Epic 2 into 4 US scenarios with exact 18/18 AC mapping while retaining its failure, race, and boundary regressions.
- Added a static traceability gate that rejects missing, unknown, or duplicated criteria before browser execution.
- Added shared app, evidence, and acceptance helpers; normal regression runs no longer rewrite reviewed evidence screenshots.
- Moved shared Playwright reports and failure artefacts out of the Epic 2 evidence tree and documented English-primary/CN-mirror rules and commands.

### Verification

- Traceability gate: Epic 1 `56/56`; Epic 2 `18/18`.
- TypeScript passed.
- All 27 repository Playwright scenarios passed in the bundled Chromium, including Epic 1, Epic 2, Epic 3, Epic 4, Epic 8, and the housing integration flow.
- The acceptance run exposed and fixed a first-load guest-session race by waiting for the income bootstrap before requesting coverage.

## 2026-08-25 — Epic 3 / Neon integration compatibility

Status: integration-hardened; this does not declare all of Epic 3 complete

### Delivered

- Bound anonymous `HousingScenario` rows to the same session-owned `GuestProfile` as finance data and added an exactly-one-owner database constraint.
- Added a preserving data migration that moves existing unowned scenarios to an inaccessible legacy profile rather than exposing them to a current guest.
- Changed the pre-housing check to read the backend record and reuse Epic 2 month/work-cost calculations; legacy client finance fields remain accepted but cannot override persisted facts.
- Changed housing calculations to `Decimal`, added half-up response rounding, duplicate-cost validation, and transactional nested-cost updates.
- Added credentialed housing requests so the finance and housing API clients retain one guest session.
- Made `PGHOST` an explicit PostgreSQL switch with startup validation and TLS `require` by default for Neon.
- Added a PostgreSQL 16 CI job alongside SQLite, without storing hosted Neon credentials.
- Recorded the compatibility boundary in ADR 0003 and updated the architecture, API contract, OpenAPI, and English/CN documentation.

### Tests

- Full Django suite: 94 tests passed locally, including 14 new housing/database compatibility cases and a preserving migration test.
- All 7 Playwright flows passed, including the real-browser housing/session integration; browser workers are serialised for the SQLite acceptance server.
- Django checks, migration drift, OpenAPI validation, and TypeScript checks passed.

## 2026-08-25 — Epic 2 backend-authoritative income patterns

Status: complete and hardened; main delivery authorised

### Delivered

- Completed US2.1–US2.4 and 18/18 acceptance criteria.
- Added versioned `GET /api/v1/income-pattern/` and `GET/PUT /api/v1/income-coverage/` without legacy aliases.
- Moved monthly aggregation, current work-cost subtraction, descriptive statistics, recorded-minimum identification, and coverage evaluation into application services.
- Added guest-isolated one-to-one coverage persistence while keeping derived analysis ephemeral.
- Replaced unsupported frontend thresholds with typed authoritative responses, explicit empty/limited/loading/saving/error/retry states, and a horizontally scrolling accessible chart.
- Added English primary documentation with `.cn.md` mirrors: requirement snapshot, ADR 0002, API contract, per-US acceptance records, implementation matrix, and index.
- Removed the Epic 2 client-side fallback algorithm, made API mode the formal default, and linked downstream coverage warnings to the authoritative response.
- Added stale-response rejection and request de-duplication; failed coverage saves preserve the last confirmed result and the user's retryable draft.
- Added model/service coverage invariants, fail-safe legacy-row reads, aggregate-safe monetary response fields, accessible selection state, and repository CI gates.
- Rebased onto the team's US3.1–US3.3 and Neon work, preserved the housing flows, restored a documented local SQLite fallback, and completed housing OpenAPI response schemas so the combined main branch remains testable.

### Tests and acceptance

- Backend `finance` suite: 80 tests passed, including 22 dedicated Epic 2 cases.
- The 12-month scenario verifies average `4437.50`, median `4385.00`, highest `5870.00`, lowest `3160.00`, range `2710.00`, population standard deviation `699.16`, and minimum month `2026-02`.
- TypeScript, migration drift, Django system check, OpenAPI generation/validation, and all 6 executable Playwright Epic 2 flows passed.

### Boundaries

- Current active monthly work costs are applied to every recorded month and identified as a current-snapshot basis; historical cost versioning is not implied.
- The API returns descriptive facts only. It does not return forecasts, stability classifications, risk bands, housing shortfall reasons, or unsupported thresholds.
- Coverage persistence belongs to the current guest session, not a permanent account-level declaration.

## 2026-08-25 — Epic 1 full-stack completion

Status: complete; delivered on main

### Delivered

- Established a Django REST Framework modular backend with `/api/v1`, consistent errors, OpenAPI, Swagger/ReDoc, and eight database migrations.
- Completed all eight Epic 1 user stories and 56/56 acceptance criteria:
  - multi-source income, outlier confirmation, and guest persistence;
  - historical monthly income and month-level consistency rules;
  - work costs and three groups of regular financial commitments;
  - manual expenses, expense review, and monthly summaries;
  - receipt starting point, human review, and confirmed saving; and
  - historical-income CSV preview, invalid rows, and confirmed import.
- Connected the Expo frontend to income, work-cost, commitment, expense, and import APIs while retaining English, Bahasa Melayu, and Chinese localisation. English remains the default.
- Extracted and archived searchable requirement snapshots for all 8 Epics/35 user stories/219 acceptance criteria and Epic 1's 8 user stories/56 acceptance criteria.
- Adopted an English-default documentation policy. Chinese documentation is retained under explicit `.cn.md` filenames.

### Tests and acceptance

- Backend `finance` suite: 58 tests passed.
- Frontend TypeScript check passed.
- Migration drift check, OpenAPI generation and validation, and `git diff --check` passed.
- US1.1–US1.8 each have real Playwright browser-acceptance evidence.
- Added the disabled-by-default `my-gig-driver-12m` scenario: approximately 114 ms to create 12 months, 60 income entries, and 240 expenses; income patterns, complete expense months, housing tests, and Epic 5 reuse were verified.

### Notable fixes

- Fixed a session-initialisation race during frontend startup that could create multiple guest profiles for the initial parallel requests.
- Income sources and expense categories prevent isolated accidental deletion while still allowing a guest profile to be deleted as a complete cascade.
- Income imports and receipt-based saves require explicit confirmation; unconfirmed data never becomes a financial fact.

### Current boundaries

- Receipt reading remains a prototype starting point. It does not claim production OCR and does not upload or retain the source image.
- CSV is the only historical import format. XLSX, PDF, bank connections, and automatic column mapping are not implemented.
- User accounts, cross-device synchronisation, and production retention/deletion policies remain future work.
- Epics 2 and 5 can reuse the financial model and deterministic scenario, but their business rules still require delivery against their formal user stories and acceptance criteria.
