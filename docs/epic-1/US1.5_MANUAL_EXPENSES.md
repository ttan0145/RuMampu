# US1.5 acceptance record: Record daily expenses manually

Language: **English** | [Chinese (CN)](US1.5_MANUAL_EXPENSES.cn.md)

- Acceptance date: 2026-08-25
- Status: complete (6/6 AC)
- Requirement: [US1.5 — Record daily expenses manually](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md#us15---record-daily-expenses-manually)

## Acceptance matrix

| Acceptance criterion | Status | Implementation and acceptance evidence |
|---|---|---|
| AC1.5.1 Enter an expense amount | Passed | Add expense provides `Amount (RM)`. An empty submission shows a positive-amount message, and the API rejects zero and negative values. |
| AC1.5.2 Select an expense category | Passed | Categories are selectable chips. A real browser saved expenses under Groceries and the new Pet supplies category. |
| AC1.5.3 Use predefined categories | Passed | The API creates Meals, Groceries, Tolls & parking, Family, and Other for each guest; see the [form after reload](../../output/playwright/us1.5/add-expense-form-after-reload.png). |
| AC1.5.4 Add a custom category | Passed | `+ Your own category` creates `Pet supplies`, selects it immediately, and keeps it after refresh. |
| AC1.5.5 Enter expense date | Passed | The form accepts `YYYY-MM-DD` and validates real calendar dates. Acceptance saved 2026-08-24 and 2026-08-25. |
| AC1.5.6 Add the expense | Passed | Groceries RM18.40 and Pet supplies RM36.60 were saved for the current guest. The list and RM55 total remain after refresh; see the [expense record](../../output/playwright/us1.5/manual-expenses-after-reload.png). |

## Automated and browser acceptance

- Backend `finance` suite: 38 tests passed. US1.5 covers defaults, guest isolation, category separation, custom categories, positive amounts, valid dates, cross-guest category rejection, duplicate-name rejection, and full-profile cascade deletion.
- Frontend TypeScript check passed.
- Real Playwright acceptance first verified empty-amount prevention, then saved one predefined-category and one custom-category expense.
- After refresh, both amounts, dates, categories, the custom category, and the RM55 monthly total remained.
- The final browser console had no product errors; only Expo Web's development animation-driver warning appeared.
- Local acceptance data was cleaned after verification.

## Data convention and boundaries

- Expense amounts use fixed-point decimals and must be greater than zero; dates must be real `YYYY-MM-DD` calendar dates.
- Every expense belongs to an active category owned by the current guest. Another guest's category ID is invalid.
- This story stores only the `manual` source. Receipt provenance, confirmation, and import batches are defined separately in US1.7 and US1.8.
- Editing, deletion, merchant, and notes are outside formal US1.5 criteria and need separate requirements if desired.
