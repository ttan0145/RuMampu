# US1.5 acceptance record: Record daily expenses manually

Language: **English** | [Chinese (CN)](US1.5_MANUAL_EXPENSES.cn.md)

- Acceptance date: 2026-10-08
- Status: all 8 v7 criteria are included in executable browser acceptance; the final run result is recorded below.
- Requirement: [US1.5 — Record daily expenses manually](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md#us15---record-daily-expenses-manually)

## Acceptance matrix

| Acceptance criterion | Status | Implementation and acceptance evidence |
|---|---|---|
| AC1.5.1 Enter an expense amount | Passed | Add expense provides `Amount (RM)` and requests a decimal keyboard on mobile. A browser preserves a decimal amount through saving and display; empty, zero, and negative amounts remain invalid. |
| AC1.5.2 Select an expense category | Passed | Categories are selectable chips. A real browser saved expenses under Groceries and the new Pet supplies category. |
| AC1.5.3 Use predefined categories | Passed | The API creates Meals, Groceries, Tolls & parking, Family, and Other for each guest; see the [form after reload](../../output/playwright/epic-1/evidence/ac1.5.1-5__add-expense-form-after-reload.png). |
| AC1.5.4 Add a custom category | Passed | `+ Your own category` creates `Pet supplies`, selects it immediately, and keeps it after refresh. |
| AC1.5.5 Enter expense date | Passed | The form accepts `YYYY-MM-DD` and validates real calendar dates. Acceptance saved 2026-08-24 and 2026-08-25. |
| AC1.5.6 Add the expense | Passed | Groceries RM18.40 and Pet supplies RM36.60 were saved for the current guest. The list and RM55 total remain after refresh; see the [expense record](../../output/playwright/epic-1/evidence/ac1.5.6__manual-expenses-after-reload.png). |
| AC1.5.7 Show the month a table is reporting | Passed | A month control names the month immediately above Recent expenses; the browser test checks both its label and position. |
| AC1.5.8 Offer an example without filling the field | Passed | The empty amount field shows a `0` placeholder while its value remains empty, so the user does not have to delete a preset amount. |

## Automated and browser acceptance

- Backend `finance` suite: 60 tests passed, including US1.5 category/default validation and related expense/work-cost editing and move cases.
- Frontend TypeScript check, Epic 1 traceability check, and migration-drift check passed.
- The full v7 Epic 1 Playwright browser suite passed 13/13; it exercises the manual-expense amount/category/date flow and v7 month-label and empty-field-placeholder criteria.
- Browser log and retained test artifacts: [full run log](../../output/playwright/epic1-supervised/full-final/run.log) and [test results](../../output/playwright/epic1-supervised/full-final/test-results).

## Data convention and boundaries

- Expense amounts use fixed-point decimals and must be greater than zero; dates must be real `YYYY-MM-DD` calendar dates.
- Every expense belongs to an active category owned by the current guest. Another guest's category ID is invalid.
- This story stores only the `manual` source. Receipt provenance, confirmation, and import batches are defined separately in US1.7 and US1.8.
- Editing, deletion, merchant, and notes are outside formal US1.5 criteria and need separate requirements if desired.
