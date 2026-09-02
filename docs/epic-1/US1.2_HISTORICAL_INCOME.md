# US1.2 acceptance record: Add historical income

Language: **English** | [Chinese (CN)](US1.2_HISTORICAL_INCOME.cn.md)

- Acceptance date: 2026-08-25
- Status: complete (4/4 AC)
- Requirement: [US1.2 — Add historical income](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md#us12---add-historical-income)

## Acceptance matrix

| Acceptance criterion | Status | Implementation and acceptance evidence |
|---|---|---|
| AC1.2.1 Access past-month entry | Passed | Income provides `Add a past month`; the sheet accepts any valid past `YYYY-MM`, as shown in the [complete sheet with duplicate-month protection](../../output/playwright/epic-1/evidence/ac1.2.1-2__duplicate-month-warning.png). |
| AC1.2.2 Enter a monthly total | Passed | A historical month needs one positive total. It is not split into transactions or assigned falsely to one source; see the [historical monthly total](../../output/playwright/epic-1/evidence/ac1.2.2-3__historical-month-entry.png). |
| AC1.2.3 Include past income in analysis | Passed | After saving 2019-01, the home count changes from 0 to 1 and remains 1 after refresh in the same guest session; see the [one-month record](../../output/playwright/epic-1/evidence/ac1.2.3-4__one-month-record.png). The API also returns `recorded_month_count`. |
| AC1.2.4 Allow any available history | Passed | The UI states that six or twelve months are not required. The browser continued after adding one historical month, and automated tests accept the distant month 2019-01. |

## Automated and browser acceptance

- Backend `finance` suite: 20 tests passed. US1.2 adds coverage for a source-free monthly total, any limited history, recorded-month count, current/future rejection, duplicate-month rejection, and mutual exclusion of monthly conventions.
- Frontend TypeScript check passed.
- Real Playwright acceptance added a RM2,750 total for 2019-01 to an empty profile; it remained one recorded month after refresh.
- A second 2019-01 submission displays `That month already has income records. Choose another month.` and does not increase the total.
- The final browser console had no product errors; only Expo Web's development animation-driver warning appeared.
- Local acceptance data was cleaned after verification.

## Month convention

- `manual` represents itemised income in a month and requires an income source.
- `historical_total` represents a known monthly total and has no single income source.
- A month uses exactly one convention: itemised income and a monthly total cannot coexist, and a second monthly total is rejected.
- Historical totals apply only before the current month; current-month income uses the itemised entry flow.
- A database constraint permits at most one historical total per guest and month.
