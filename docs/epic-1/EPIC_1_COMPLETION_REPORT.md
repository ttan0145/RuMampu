# Epic 1 completion report

Language: **English** | [Chinese (CN)](EPIC_1_COMPLETION_REPORT.cn.md)

## 2026-10-08 v7 repair addendum

The latest acceptance baseline is v7: 9 Epic 1 stories and 72 criteria. The earlier 13/13 Playwright run covered the first 67 criteria before this turn's US1.9 changes; see its [browser log](../../output/playwright/epic1-supervised/full-final/run.log) and [test artifacts](../../output/playwright/epic1-supervised/full-final/test-results). This turn implemented US1.9's five criteria on the Groq path confirmed by the user and added focused acceptance coverage. Earlier Epic 1 work also restored the savings group on Commitments, added editing and bidirectional movement between daily expenses and work costs, preserved merchant details, applied edited amount/date values during a move, and covered v7's separate-entry, month-label, and empty-field-placeholder criteria. The coordinator will finish the integrated Epic 1/2 regression.

### US1.9 implementation and limits

Finory appears in the historical v7 Amendment 1 context. The user confirmed that the current image-reading path uses Groq, so this implementation uses Groq rather than treating a Finory integration as a prerequisite. The versioned disclosure and codebase supplements to the Iteration 2 Security Risk & Privacy Plan and Data Management Plan state the processor, geography, retention exceptions, and current account's ZDR status; browser behavior remains unverified. Groq inference inputs/outputs are not retained by default; troubleshooting or abuse investigations may retain them for up to 30 days, longer if legally required. Retained customer data is stored on US GCP, while the DPA permits processing in the US and other operating countries; we do not claim US-only processing or promise zero retention.

The feature reads income/earnings rows only; model output and API responses use a field allow-list and are capped at 20 rows. Missing dates are not replaced with today, and missing-date or low-confidence results start unselected. Only valid rows selected and confirmed by the user are saved. Failures state that nothing was saved and offer manual entry. The implementation and controlled tests were added, but Playwright did not reach test execution: the backend health check returned 200, the frontend test server did not become ready, and the run was stopped under the narrowed scope. Twenty focused backend tests passed; browser verification remains unrun. No live Groq call or real financial data was used, so there is no evidence yet for real statement-recognition accuracy or production availability. The feature does not claim PDF parsing or import of every income and outflow line.

See the [US1.9 acceptance record](US1.9_BANK_STATEMENT_SCAN.md), [Security Plan supplement](../privacy/ITERATION_2_SECURITY_RISK_PRIVACY_PLAN.cn.md), and [Data Management Plan supplement](../privacy/ITERATION_2_DATA_MANAGEMENT_PLAN.cn.md).

## Current v7 acceptance overview

| User story | ACs | Current result | Evidence |
|---|---:|---|---|
| US1.1 Record income from different sources | 12 | Passed (12/12) | [US1.1 record](US1.1_RECORD_INCOME.md) |
| US1.2 Add historical income | 4 | Passed (4/4) | [US1.2 record](US1.2_HISTORICAL_INCOME.md) |
| US1.3 Record direct work-related costs | 13 | Passed (13/13; includes editing and bidirectional moves) | [US1.3 record](US1.3_WORK_COSTS.md) |
| US1.4 Record regular financial commitments | 6 | Passed (6/6; includes savings) | [US1.4 record](US1.4_COMMITMENTS.md) |
| US1.5 Record daily expenses manually | 8 | Passed (8/8) | [US1.5 record](US1.5_MANUAL_EXPENSES.md) |
| US1.6 Review recorded daily expenses | 6 | Passed (6/6) | [US1.6 record](US1.6_EXPENSE_REVIEW.md) |
| US1.7 Use a receipt as the starting point | 10 | Passed (10/10) | [US1.7 record](US1.7_RECEIPT_STARTING_POINT.md) |
| US1.8 Import historical financial records | 8 | Passed (8/8) | [US1.8 record](US1.8_HISTORICAL_IMPORT.md) |
| US1.9 Read a bank statement or e-statement into entries | 5 | Implemented; 20 focused backend tests passed; browser acceptance not run | [US1.9 record](US1.9_BANK_STATEMENT_SCAN.md) |

Traceability maps all 72 criteria exactly once and no longer marks US1.9 deferred. The earlier 13/13 browser suite and 60/60 finance tests predate this turn's US1.9 implementation. Current typecheck passed and 20 focused US1.9 backend tests passed; its browser tests were not run because the frontend test server did not become ready. The coordinator can decide whether to run integrated regression so the old suite and new behavior are not conflated.

## Historical baseline (v3, 2026-09-11; not the v7 result)

- Revalidation date: 2026-09-11
- Conclusion: v3/new-UI adaptation passed for 8/8 active stories and all 61 executable criteria. AC1.1.8 (`Your Data`) is explicitly deferred from this adaptation.

## Historical delivery overview (v3)

| User story | AC | Result | Detailed evidence |
|---|---:|---|---|
| US1.1 Record income from different sources | 12 | 11 passed; AC1.1.8 deferred | [Acceptance record](US1.1_RECORD_INCOME.md) |
| US1.2 Add historical income | 4 | 4/4 passed | [Acceptance record](US1.2_HISTORICAL_INCOME.md) |
| US1.3 Record direct work-related costs | 10 | 10/10 passed | [Acceptance record](US1.3_WORK_COSTS.md) |
| US1.4 Record regular financial commitments | 6 | 6/6 passed | [Acceptance record](US1.4_COMMITMENTS.md) |
| US1.5 Record daily expenses manually | 6 | 6/6 passed | [Acceptance record](US1.5_MANUAL_EXPENSES.md) |
| US1.6 Review recorded daily expenses | 6 | 6/6 passed | [Acceptance record](US1.6_EXPENSE_REVIEW.md) |
| US1.7 Use a receipt as the starting point | 10 | 10/10 passed | [Acceptance record](US1.7_RECEIPT_STARTING_POINT.md) |
| US1.8 Import historical financial records | 8 | 8/8 passed | [Acceptance record](US1.8_HISTORICAL_IMPORT.md) |

The historical v3 [Epic 1 US/AC snapshot](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md) contained 62 criteria: 61 executable and the explicitly deferred AC1.1.8. The current formal v7 baseline has 72 criteria.

## Historical implementation baseline (v3)

- The Expo/React Native/TypeScript frontend communicates with Django REST Framework through `/api/v1`.
- Django sessions isolate anonymous guests; income, work costs, commitments, expenses, and import batches are persisted.
- Income has three traceable sources: ordinary entries, historical monthly totals, and confirmed CSV imports.
- Expenses support manual entry and the receipt starting point; receipt-derived values require human confirmation before persistence.
- OpenAPI, consistent error responses, migrations, three-language UI copy, per-story acceptance documents, and Playwright evidence are archived.

## Historical quality evidence (through v3)

- Full backend `manage.py test` on 2026-09-03: 106 tests passed, including 7 new work-cost boundary regressions.
- `makemigrations --check --dry-run`: no model/migration drift.
- OpenAPI generation with `--validate`: passed.
- Frontend `npm run typecheck`: passed.
- Current finance regression on 2026-09-11: 90/90 tests passed.
- Current Epic 1+2 Playwright acceptance, amendment and UI hardening regressions, and comprehensive 12-month CSV import on 2026-09-11: 24/24 tests passed.
- Full `npm run test:e2e -- --reporter=line` on 2026-09-03: 32 tests passed (2.3 minutes), covering existing Epic 1/2, housing/record flows, and new work-cost failure regressions. Identifier mapping alone is not evidence of passing acceptance.
- Finance migrations cover `0001` through `0010`; `0010` adds dated work-cost records without fabricating dates for old monthly estimates.
- The [12-month Malaysian e-hailing driver scenario](../testing/SCENARIO_GIG_DRIVER_12M.md) was added after Epic 1: approximately 114 ms creates 12 months, 60 income entries, and 240 expenses, then a real browser verifies income, expenses, housing tests, and the Epic 5 reuse entry point.

## Historical boundaries (through v3; use the v7 boundaries above)

- LeanKit was inspected read-only and was not updated. The local adaptation remains uncommitted and unpushed pending owner acceptance.
- The former v1 contract has breaking changes; versioning and migration remain production-release gates. Legacy monthly estimates remain available for review. Without idempotency keys, a lost POST response still requires list reconciliation before retry. See the [US1.3 audit (Chinese)](US1.3_AUDIT_2026-09-03.cn.md).

- Receipt reading remains a prototype starting point. It does not claim production OCR and does not upload or retain the source image.
- CSV was the historical import format at that point. US1.9 became formal scope in v7; its current implementation and validation boundaries are described above.
- Production accounts, cross-device synchronisation, data export/deletion UI, and retention policies are not implemented.
- Epic 2 was revalidated with Epic 1 in the same 2026-09-11 run. Epic 5 remains a separate delivery scope.

## Current v7 conclusion

Epic 1's current acceptance scope is 9 stories and 72 mapped executable criteria. This turn implemented US1.9 and passed focused backend tests, while its browser acceptance remains unrun; the full suite for the first 67 criteria predates that change. The final integrated Epic 1/2 regression remains with the coordinator. Traceability alone does not establish acceptance.
