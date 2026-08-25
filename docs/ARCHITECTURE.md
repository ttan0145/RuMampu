# RuMampu architecture baseline

Language: **English** | [Chinese (CN)](ARCHITECTURE.cn.md)

## 1. Goal

RuMampu helps people with irregular income understand housing-payment pressure without making a credit decision. The architecture prioritises traceable financial conventions, clear privacy boundaries, explainable behaviour on unreliable mobile networks, and a shared data foundation for Epics 1, 2, and 5.

## 2. System shape

The project is a modular monolith:

- Expo/React Native provides interaction, local drafts, and multilingual presentation;
- Django REST Framework provides validation, business rules, and persistence;
- SQLite is used for local development; the production database will be selected with the deployment design; and
- OpenAPI is the machine-readable contract between frontend and backend.

Microservices are not currently justified. Reconsider them only when independent deployment, scaling, or permission boundaries become real requirements.

## 3. Domain boundaries

| Domain | Responsibility | Current status |
| --- | --- | --- |
| Income | Sources, entries, historical monthly totals, and historical CSV import | US1.1–US1.2 and US1.8 persisted and accepted |
| Work costs | Monthly costs incurred to earn income | US1.3 persisted and accepted |
| Commitments | Monthly living costs, debts, and savings commitments | US1.4 persisted and accepted |
| Expenses | Daily expenses, categories, and receipt-confirmation provenance | US1.5–US1.7 persisted and accepted; production OCR pending |
| Income analysis | Monthly usable income, descriptive statistics, recorded minima, and slower-period coverage | Epic 2 backend-authoritative and accepted |
| Housing readiness | Housing scenarios, cash flow, and explanations of payment pressure | UI prototype; Epic 3 rules pending |
| Preparation | Cash buffer, upfront costs, document checklist, and comparisons | UI prototype |

Domain logic belongs in the service layer. API views orchestrate input and output only. Do not duplicate business calculations in screen components or serializers.

## 4. Data flow

1. The frontend API client sends requests according to the OpenAPI contract.
2. A Django session maps an anonymous visitor to an isolated `GuestProfile`.
3. Serializers validate transport data; services execute financial rules and transactions.
4. Models store source facts; aggregates should be calculated or carry explicit provenance.
5. The API returns stable resource shapes or the consistent error shape; the frontend localises presentation.

For Epic 2, the service recalculates analysis from `IncomeEntry` and active `WorkCostItem` facts. Only the user's explicit `IncomeCoverage` answer is persisted; calculated response snapshots are not stored.

## 5. Data and privacy rules

- A guest may access only the data associated with the current session.
- The database uses `Decimal`; API responses use two-decimal monetary strings.
- Dates represent calendar days in the user's locale; timestamps are timezone-aware ISO 8601 values.
- Import and OCR results retain provenance and confirmation status and must not become untraceable facts.
- Historical-income import follows preview/confirm: a preview may persist parsed rows, but only explicit confirmation creates `IncomeEntry` records.
- Readiness results must not use credit scores, loan-approval probabilities, or unapproved risk labels.
- Before production deployment, define guest-data retention and deletion, cookie security, and database backup policies.

## 6. Frontend state principles

- API data is the source of truth for connected domains; screen state stores drafts, navigation, and transient UI state only.
- Formal builds default to connected API mode. Prototype mode is demonstration-only and requires `EXPO_PUBLIC_APP_MODE=prototype`; a missing API URL does not silently change the calculation authority.
- Epic 2 has no client-side fallback algorithm. Pattern and coverage responses come from the versioned API, while downstream clients consume the confirmed `unrepresented_slower_months` field.
- When a domain is connected to the API, remove the corresponding mock data incrementally; one field must not be controlled by both mock and API data.
- Income-pattern and coverage screens treat the last successful server response as authoritative. Draft coverage selections do not become conclusions until an explicit save succeeds.

## 7. Definition of done

Every work package must include at least:

- explicit acceptance scenarios and non-goals;
- tests for the data model and cross-guest isolation;
- API changes reflected in OpenAPI and `API_CONTRACT.md`;
- passing strict TypeScript checks;
- no ungenerated migration drift;
- no credit judgement, 75% low-income threshold, or unconfirmed financial conclusion; and
- updated README, Epic matrix, and relevant ADRs.

## 8. Test-scenario interface

- Deterministic financial scenarios are test infrastructure, not production business APIs.
- Scenario endpoints require explicit `ENABLE_TEST_SCENARIOS`, explicit reset confirmation, current-session isolation, and exclusion from public OpenAPI.
- Responses expose stable IDs, monthly conditions, and load summaries so Epic 1 regression tests and later Epic 2/5 algorithms share one input baseline.
- Scenario amounts are assumed test data and must not be presented as user facts, market statistics, or forecasts.

See the [12-month Malaysian e-hailing driver scenario](testing/SCENARIO_GIG_DRIVER_12M.md).
