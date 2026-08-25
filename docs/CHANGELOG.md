# Project changelog

Language: **English** | [Chinese (CN)](CHANGELOG.cn.md)

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
