# Epic 1 completion report

Language: **English** | [Chinese (CN)](EPIC_1_COMPLETION_REPORT.cn.md)

- Revalidation date: 2026-09-11
- Conclusion: v3/new-UI adaptation passed for 8/8 active stories and all 61 executable criteria. AC1.1.8 (`Your Data`) is explicitly deferred from this adaptation.

## Delivery overview

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

The [Epic 1 US/AC snapshot](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md) is reconciled with Drive v3 and the 2026-09-07 Iteration 2 amendment. The current baseline contains 62 criteria: 61 executable and the explicitly deferred AC1.1.8.

## Local delivery baseline

- The Expo/React Native/TypeScript frontend communicates with Django REST Framework through `/api/v1`.
- Django sessions isolate anonymous guests; income, work costs, commitments, expenses, and import batches are persisted.
- Income has three traceable sources: ordinary entries, historical monthly totals, and confirmed CSV imports.
- Expenses support manual entry and the receipt starting point; receipt-derived values require human confirmation before persistence.
- OpenAPI, consistent error responses, migrations, three-language UI copy, per-story acceptance documents, and Playwright evidence are archived.

## Final quality evidence

- Full backend `manage.py test` on 2026-09-03: 106 tests passed, including 7 new work-cost boundary regressions.
- `makemigrations --check --dry-run`: no model/migration drift.
- OpenAPI generation with `--validate`: passed.
- Frontend `npm run typecheck`: passed.
- Current finance regression on 2026-09-11: 90/90 tests passed.
- Current Epic 1+2 Playwright acceptance, amendment and UI hardening regressions, and comprehensive 12-month CSV import on 2026-09-11: 24/24 tests passed.
- Full `npm run test:e2e -- --reporter=line` on 2026-09-03: 32 tests passed (2.3 minutes), covering existing Epic 1/2, housing/record flows, and new work-cost failure regressions. Identifier mapping alone is not evidence of passing acceptance.
- Finance migrations cover `0001` through `0010`; `0010` adds dated work-cost records without fabricating dates for old monthly estimates.
- The [12-month Malaysian e-hailing driver scenario](../testing/SCENARIO_GIG_DRIVER_12M.md) was added after Epic 1: approximately 114 ms creates 12 months, 60 income entries, and 240 expenses, then a real browser verifies income, expenses, housing tests, and the Epic 5 reuse entry point.

## Explicit boundaries

- LeanKit was inspected read-only and was not updated. The local adaptation remains uncommitted and unpushed pending owner acceptance.
- The former v1 contract has breaking changes; versioning and migration remain production-release gates. Legacy monthly estimates remain available for review. Without idempotency keys, a lost POST response still requires list reconciliation before retry. See the [US1.3 audit (Chinese)](US1.3_AUDIT_2026-09-03.cn.md).

- Receipt reading remains a prototype starting point. It does not claim production OCR and does not upload or retain the source image.
- CSV is the current historical import format. The proposed US1.9 bank e-statement flow depends on an undecided processor and remains outside this implementation baseline.
- Production accounts, cross-device synchronisation, data export/deletion UI, and retention policies are not implemented.
- Epic 2 was revalidated with Epic 1 in the same 2026-09-11 run. Epic 5 remains a separate delivery scope.

## Release conclusion

Epic 1 implementation, acceptance evidence, and English-default documentation form a reviewable release baseline. The owner should still review the final diff and product boundaries before updating `main`.
