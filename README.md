# RuMampu

Language: **English** | [Chinese (CN)](README.cn.md)

RuMampu helps Malaysians with irregular income understand housing-payment pressure using their actual monthly financial records. It explains the result; it is not a lender, credit-scoring tool, or predictor of loan approval.

## Current status

Epic 1 and Epic 2 are complete across the full stack: 56/56 Epic 1 acceptance criteria and 18/18 Epic 2 acceptance criteria are covered.

Epic 1 provides:

- guest-session-isolated income profiles;
- default and custom income sources;
- individual income entries and historical monthly income;
- explicit confirmation for unusually high income;
- default and custom work costs, independent amount updates, and persistence;
- calculated monthly income after work costs, with provenance labels;
- grouped living-cost, debt-repayment, and savings commitments with persistence;
- calculated total monthly commitments, with provenance labels;
- predefined and custom daily-expense categories, amount/date validation, and persistent manual entry;
- latest expense month, recorded-day count, itemised entries, and cross-month summaries;
- receipt photo/file starting point, reading preview, human review, confirmation, and provenance persistence;
- historical-income CSV selection, row-by-row preview, error reporting, confirmation, and analysis integration;
- Expo frontend synchronisation with the Django API; and
- versioned `/api/v1` endpoints, a consistent error response, and an OpenAPI contract.

Epic 2 adds:

- backend-authoritative month-by-month usable-income analysis;
- average, median, highest, lowest, range, and population standard deviation as two-decimal calculated values;
- explicit empty, one-month, two-month, and three-or-more history states;
- recorded-minimum month identification without unsupported thresholds or risk labels;
- guest-isolated, persistent slower-month coverage answers; and
- represented/unrepresented month results plus factual No/Not sure observations;
- a single backend calculation authority with stale-response protection and failed-save recovery; and
- repeatable backend, TypeScript, OpenAPI, migration, and Playwright quality gates in GitHub Actions.

The team's existing US3.1–US3.3 housing work is preserved and integration-hardened, but this does not declare all of Epic 3 complete. Housing scenarios now share the finance guest-session boundary, the pre-housing check reads the backend financial record instead of a client copy, and CI runs the full backend suite on both SQLite and PostgreSQL.

See the [Epic 1 implementation and acceptance index](docs/epic-1/README.md) for criterion-level evidence and the [project changelog](docs/CHANGELOG.md) for the delivery record.

See the [Epic 2 implementation and acceptance index](docs/epic-2/README.md) for all 18 criteria, calculation boundaries, and browser evidence.

The [Epic 1 completion report](docs/epic-1/EPIC_1_COMPLETION_REPORT.md) summarises that release. Production-grade OCR, user accounts, cross-device synchronisation, income prediction, risk scoring, and formal delivery of Epic 5 remain outside the current milestone; see the [Epic 1/2/5 implementation matrix](docs/EPIC_1_2_5_IMPLEMENTATION_MATRIX.md) for the boundary.

The formal requirements are available as searchable Markdown: [all user stories and acceptance criteria](docs/requirements/USER_STORIES_AND_ACCEPTANCE_CRITERIA.md), [Epic 1](docs/requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md), and [Epic 2](docs/requirements/EPIC_2_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md). Delivery is organised by user story and verified by acceptance criterion.

## Technical structure

```text
RuMampu/
├─ backend/                 Django + Django REST Framework
│  ├─ config/               Runtime configuration, API routing, errors, and OpenAPI baseline
│  ├─ finance/              Finance domain models, services, APIs, and tests
│  └─ apps/housing/         Housing scenarios and backend-authoritative pre-check integration
├─ frontend/                Expo + React Native + TypeScript
│  └─ src/rumampu/          Screens, state, calculations, localisation, and API client
└─ docs/                    Architecture, API contract, ADRs, and Epic evidence
```

The project uses a modular monolith so that domain boundaries remain explicit without introducing premature microservices. See the [architecture baseline](docs/ARCHITECTURE.md).

## Run locally

### Backend

```powershell
Set-Location backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py runserver localhost:8000
```

Leave `PGHOST` empty in `backend/.env` for local SQLite. To use Neon/PostgreSQL, set all documented `PG*` values; TLS defaults to `require`. Once `PGHOST` is set, incomplete credentials, invalid ports, and unsupported TLS modes fail during startup instead of silently falling back.

Available endpoints:

- health check: `http://localhost:8000/api/v1/health/`
- Swagger UI: `http://localhost:8000/api/docs/`
- ReDoc: `http://localhost:8000/api/redoc/`
- OpenAPI schema: `http://localhost:8000/api/schema/`

### Frontend

```powershell
Set-Location frontend
npm ci
Copy-Item .env.example .env
npm start
```

Expo Web and Django should use the same hostname, such as `localhost`, so the guest-session cookie is retained consistently. Formal builds use API mode and fall back to the local API URL when `EXPO_PUBLIC_API_URL` is absent. In-memory demonstration data requires the explicit `EXPO_PUBLIC_APP_MODE=prototype` setting.

### Fast simulation profile

Development builds provide a disabled-by-default `my-gig-driver-12m` scenario. One API request creates 12 months, 60 income entries, and 240 expense entries for immediate use in income analysis and housing tests. Setup, financial assumptions, safeguards, and Playwright flows are documented in the [12-month Malaysian e-hailing driver scenario](docs/testing/SCENARIO_GIG_DRIVER_12M.md). This endpoint is not part of the production API and is excluded from OpenAPI.

## API conventions

Production business endpoints begin at `/api/v1/`. Monetary values are returned as two-decimal strings, dates use `YYYY-MM-DD`, and every API error uses a consistent `error` object. See the [API contract](docs/API_CONTRACT.md) for rules, examples, and compatibility policy.

`/api/income/` and `/api/health/` are temporary compatibility paths from the initial prototype. They are not part of the public OpenAPI contract and must not be used by new code.

## Quality gates

Run at least the following before committing:

```powershell
# Backend tests, migration drift, and OpenAPI validation
.\backend\.venv\Scripts\python.exe backend\manage.py test --noinput
.\backend\.venv\Scripts\python.exe backend\manage.py makemigrations --check --dry-run
.\backend\.venv\Scripts\python.exe backend\manage.py spectacular --validate --file docs\openapi.yaml

# Frontend type checking
Set-Location frontend
npm run typecheck
npm run test:e2e:epic2
```

A work package is complete only when its code, tests, API schema, and affected documentation agree. Foundational decisions are recorded in [ADR 0001](docs/adr/0001-foundation-and-api-contract.md); the Epic 2 calculation boundary is recorded in [ADR 0002](docs/adr/0002-backend-authoritative-income-pattern.md); housing-record ownership and PostgreSQL compatibility are recorded in [ADR 0003](docs/adr/0003-housing-record-and-database-compatibility.md).
