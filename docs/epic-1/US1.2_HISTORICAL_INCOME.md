# US1.2 acceptance record: Add historical income

Language: **English** | [Chinese (CN)](US1.2_HISTORICAL_INCOME.cn.md)

- Revalidation date: 2026-09-11
- Status: complete (4/4 AC)
- Requirement: [US1.2 — Add historical income](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md#us12---add-historical-income)

## Acceptance matrix

| Acceptance criterion | Status | Implementation and acceptance evidence |
|---|---|---|
| AC1.2.1 Access past-month entry | Passed | The v22 Income card provides `Per month` and a month/year picker. It defaults to the latest completed month and does not offer the current incomplete month as a historical total. |
| AC1.2.2 Enter a monthly total | Passed | A historical month needs one positive total. It is not split into transactions or assigned falsely to one source; see the [historical monthly total](../../output/playwright/epic-1/evidence/ac1.2.2-3__historical-month-entry.png). |
| AC1.2.3 Include past income in analysis | Passed | After saving one completed month, the authoritative pattern and record APIs both report one recorded month. |
| AC1.2.4 Allow any available history | Passed | The browser and APIs continue with a single recorded month; no six- or twelve-month minimum is imposed. |

## Automated and browser acceptance

- Current backend `finance` suite: 90/90 tests passed, including source-free monthly totals, limited history, recorded-month count, current/future rejection, duplicate-month rejection, and mutual exclusion of monthly conventions.
- Frontend TypeScript check passed.
- Playwright selected `Per month`, chose the previous calendar month, saved RM2,750, and verified the resulting monthly total and one-month record through the real API.
- The final browser console had no product errors; only Expo Web's development animation-driver warning appeared.
- Local acceptance data was cleaned after verification.

## Month convention

- `manual` represents itemised income in a month and requires an income source.
- `historical_total` represents a known monthly total and has no single income source.
- A month uses exactly one convention: itemised income and a monthly total cannot coexist, and a second monthly total is rejected.
- Historical totals apply only before the current month. The v22 picker defaults to the latest completed month; current-month income uses day/week entries.
- A database constraint permits at most one historical total per guest and month.
