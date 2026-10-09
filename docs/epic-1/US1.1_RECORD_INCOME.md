# US1.1 acceptance record: Record income from different sources

Language: **English** | [Chinese (CN)](US1.1_RECORD_INCOME.cn.md)

- Revalidation date: 2026-10-08
- Status: all 12 criteria have executable acceptance under v7; AC1.1.8's YOUR DATA label is restored as a formal check.
- Requirement: [US1.1 — Record income from different sources](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md#us11---record-income-from-different-sources)

## Acceptance matrix

| Acceptance criterion | Status | Implementation and acceptance evidence |
|---|---|---|
| AC1.1.1 Enter income amount | Passed | The Income form provides an RM amount field, requests a decimal keyboard on mobile, and preserves a decimal amount through saving and display. |
| AC1.1.2 Enter income date | Passed | The form selects the income date; choosing any date in week mode selects the whole week. |
| AC1.1.3 Select an income source | Passed | A real browser selected E-hailing, Freelance, and Part-time (fixed) and could enter the custom-source flow. |
| AC1.1.4 Use multiple income sources | Passed | Automated tests retain date, amount, and source per record; the browser saved entries using three sources. |
| AC1.1.5 Add a custom income source | Passed | Created and used `Weekend market`; see the [custom-source screenshot](../../output/playwright/epic-1/evidence/ac1.1.1-3_ac1.1.5-8__custom-source-entry.png). |
| AC1.1.6 Save an income entry | Passed | `POST /api/v1/income/entries/` persists a valid entry; the page reloads the same guest-session data after refresh. |
| AC1.1.7 Display existing entries | Passed | Income displays the date, source, and amount of every existing entry; see the [saved and reloaded entries](../../output/playwright/epic-1/evidence/ac1.1.4_ac1.1.6-8_ac1.1.10__outlier-kept.png). |
| AC1.1.8 Identify user-entered values | Passed | The income-record section displays the `YOUR DATA` provenance label; the Epic 1 browser test asserts it is visible. |
| AC1.1.9 Prevent negative income entry | Passed | Entering `-10` shows a warning and creates no record; see the [negative-amount warning](../../output/playwright/epic-1/evidence/ac1.1.9__negative-warning.png). The API also rejects negative values while allowing a genuine zero-income period. |
| AC1.1.10 Warn about an unusually high income entry | Passed | After a RM100/RM120/RM140 baseline, RM1,000 first requires confirmation. The UI offers Keep and saves only after confirmation. See the [outlier warning](../../output/playwright/epic-1/evidence/ac1.1.10__outlier-warning.png) and [confirmed entry](../../output/playwright/epic-1/evidence/ac1.1.4_ac1.1.6-8_ac1.1.10__outlier-kept.png). |
| AC1.1.11 Edit a recorded income entry | Passed | The new edit sheet updates the selected record's amount, date, and source through the real PATCH endpoint and displays the result. |
| AC1.1.12 Validate income amount format | Passed | Partially numeric input such as `3oops` is rejected before POST and the page asks for a valid cash amount. |

## Automated and browser acceptance

- Current backend `finance.tests`: 60/60 tests passed on 2026-10-08.
- Frontend TypeScript check passed.
- Full Epic 1 Playwright browser suite passed 13/13 on 2026-10-08, including AC1.1.8 `YOUR DATA`; see the [isolated run log](../../output/playwright/epic1-supervised/full-final/run.log).
- The final page had no product-code console errors; only Expo Web's development warning about unavailable native animation drivers appeared.
- Local browser-acceptance data was cleaned after verification, leaving no sample income in the development database.

## Boundaries

- Editing is now AC1.1.11 and is part of the accepted flow. Deletion remains outside the current US1.1 criteria.
- The current identity boundary is anonymous guest-session isolation, not a production account, login, or cross-device synchronisation.
- Once at least three manual entries exist, unusually high income is flagged at three times the median of existing manual entries. Historical monthly totals do not affect this baseline. RM0 remains valid; negative and malformed amounts are rejected.
