# US1.1 acceptance record: Record income from different sources

Language: **English** | [Chinese (CN)](US1.1_RECORD_INCOME.cn.md)

- Acceptance date: 2026-08-24
- Status: complete (10/10 AC)
- Requirement: [US1.1 — Record income from different sources](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md#us11---record-income-from-different-sources)

## Acceptance matrix

| Acceptance criterion | Status | Implementation and acceptance evidence |
|---|---|---|
| AC1.1.1 Enter income amount | Passed | The Income form provides an RM amount field, requests a decimal keyboard on mobile, and preserves a decimal amount through saving and display. |
| AC1.1.2 Enter income date | Passed | The form accepts `YYYY-MM-DD`; frontend and backend both validate real calendar dates. |
| AC1.1.3 Select an income source | Passed | A real browser selected E-hailing, Freelance, and Part-time (fixed) and could enter the custom-source flow. |
| AC1.1.4 Use multiple income sources | Passed | Automated tests retain date, amount, and source per record; the browser saved entries using three sources. |
| AC1.1.5 Add a custom income source | Passed | Created and used `Weekend market`; see the [custom-source screenshot](../../output/playwright/epic-1/evidence/ac1.1.1-3_ac1.1.5-8__custom-source-entry.png). |
| AC1.1.6 Save an income entry | Passed | `POST /api/v1/income/entries/` persists a valid entry; the page reloads the same guest-session data after refresh. |
| AC1.1.7 Display existing entries | Passed | Income displays the date, source, and amount of every existing entry; see the [saved and reloaded entries](../../output/playwright/epic-1/evidence/ac1.1.4_ac1.1.6-8_ac1.1.10__outlier-kept.png). |
| AC1.1.8 Identify user-entered values | Passed | Every manually entered value carries the `YOUR DATA` label, visible in both linked entry screenshots. |
| AC1.1.9 Prevent negative income entry | Passed | Entering `-10` shows a warning and creates no record; see the [negative-amount warning](../../output/playwright/epic-1/evidence/ac1.1.9__negative-warning.png). The API also rejects non-positive values. |
| AC1.1.10 Warn about an unusually high income entry | Passed | After a RM100/RM120/RM140 baseline, RM1,000 first requires confirmation. The UI offers Keep and saves only after confirmation. See the [outlier warning](../../output/playwright/epic-1/evidence/ac1.1.10__outlier-warning.png) and [confirmed entry](../../output/playwright/epic-1/evidence/ac1.1.4_ac1.1.6-8_ac1.1.10__outlier-kept.png). |

## Automated and browser acceptance

- Backend `finance` suite: 16 tests passed, covering guest isolation, default/custom sources, cross-source records, amount/date validation, outlier confirmation, historical-total boundaries, API versioning, and OpenAPI pages.
- Frontend TypeScript check passed.
- Real Playwright acceptance passed: after four saves, a refresh and return to Income preserved all entries in the same guest session.
- The final page had no product-code console errors; only Expo Web's development warning about unavailable native animation drivers appeared.
- Local browser-acceptance data was cleaned after verification, leaving no sample income in the development database.

## Boundaries

- Formal US1.1 does not require editing or deleting income entries. Those capabilities need separate requirements and acceptance criteria.
- The current identity boundary is anonymous guest-session isolation, not a production account, login, or cross-device synchronisation.
- Once at least three manual entries exist, unusually high income is flagged at three times the median of existing manual entries. Historical monthly totals do not affect this baseline.
