# US1.3 acceptance record: Record direct work-related costs

Language: **English** | [Chinese (CN)](US1.3_WORK_COSTS.cn.md)

- Acceptance date: 2026-08-25
- Status: complete (6/6 AC)
- Requirement: [US1.3 — Record direct work-related costs](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md#us13---record-direct-work-related-costs)

## Acceptance matrix

| Acceptance criterion | Status | Implementation and acceptance evidence |
|---|---|---|
| AC1.3.1 View work-cost categories | Passed | Work costs loads Petrol, Servicing, Platform fees, Phone data, and Road tax & insurance from the API. |
| AC1.3.2 Edit work-cost amounts | Passed | A real browser changed Petrol to RM400 and Servicing to RM100; leaving each field persisted it through `PATCH /api/v1/work-costs/{id}/`. |
| AC1.3.3 Record different work costs separately | Passed | Each cost is an independent resource and input with a `YOUR DATA` label; updating one never overwrites another. |
| AC1.3.4 Add my own work cost | Passed | Created `Equipment rental` at RM200; it remained the sixth item after refresh. |
| AC1.3.5 Show income after work costs | Passed | RM3,000 monthly income minus RM700 work costs displays `Income after work costs RM 2,300`. |
| AC1.3.6 Identify calculated income | Passed | The result carries a `CALCULATED` provenance label; see the [reloaded Work costs screen](../../output/playwright/epic-1/evidence/ac1.3.1-6__work-costs-after-reload.png). |

## Automated and browser acceptance

- Backend `finance` suite: 25 tests passed. US1.3 covers defaults, resource separation, amount updates, custom items, negative/duplicate rejection, cross-guest update rejection, and OpenAPI paths.
- Frontend TypeScript check passed.
- Real Playwright acceptance edited two defaults, added one custom item, and verified RM3,000 − RM700 = RM2,300.
- After refresh, RM400, RM100, RM200, the custom name, and the RM2,300 calculation all remained.
- The final browser console had no product errors; only Expo Web's development animation-driver warning appeared.
- Local acceptance data was cleaned after verification.

## Calculation convention

- Work-cost amounts represent current monthly direct costs. Zero is allowed; negative amounts are not.
- `Income after work costs` for each recorded month equals that month's total income minus all current active work-cost items.
- With multiple months, the screen shows the mean of these monthly results and marks it as calculated; source income and work costs remain user data.
- This story does not store different cost versions by income source or month. Historical cost changes require a separate effective-month requirement.
