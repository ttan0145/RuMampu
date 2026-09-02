# US1.6 acceptance record: Review recorded daily expenses

Language: **English** | [Chinese (CN)](US1.6_EXPENSE_REVIEW.cn.md)

- Acceptance date: 2026-08-25
- Status: complete (6/6 AC)
- Requirement: [US1.6 — Review recorded daily expenses](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md#us16---review-recorded-daily-expenses)

## Acceptance matrix

| Acceptance criterion | Status | Implementation and acceptance evidence |
|---|---|---|
| AC1.6.1 Display current monthly spending | Passed | The latest recorded month is 2026-08. The page totals only RM18.40 and RM36.60 from August as `Aug so far · RM55`; the RM10 from 2026-07 is excluded. |
| AC1.6.2 Display recorded days | Passed | The two August expenses occur on the 24th and 25th, so the page shows `2 days recorded`; see the [latest-month review](../../output/playwright/epic-1/evidence/ac1.6.1-5__latest-month-review.png). |
| AC1.6.3 Display individual expenses | Passed | All latest-month entries appear newest first: 25 Aug · Meals · RM36.60 and 24 Aug · Groceries · RM18.40. |
| AC1.6.4 Access manual expense entry | Passed | `Add expense` opens the manual screen with Amount, Category, and Date; Back returns to the review. |
| AC1.6.5 Access receipt-entry flow | Passed | `Scan a receipt` opens the receipt flow and shows `Use a sample receipt`; Back returns to the review. |
| AC1.6.6 Access monthly expense summary | Passed | `Monthly summary` shows Aug 2026 · RM55 · 2 days and Jul 2026 · RM10 · 1 day; see the [monthly summary](../../output/playwright/epic-1/evidence/ac1.6.6__monthly-summary.png). |

## Automated and browser acceptance

- Backend `finance` suite: 40 tests passed. US1.6 adds ordering and cross-guest read-isolation coverage.
- Frontend TypeScript check passed.
- Real Playwright acceptance used one guest session with July and August data to verify the latest-month total, day count, entry list, and all three navigation targets.
- Monthly summary shows both months and retains explicit text for incomplete months; singular and plural day copy is correct.
- Narrow-screen review found and fixed horizontal overflow in long explanatory copy and provenance labels.
- The final browser console had no product errors; only Expo Web's development animation-driver warning appeared.
- Local acceptance data was cleaned after verification.

## Display convention and boundaries

- “Current month” means the month containing the latest recorded expense, not necessarily the device's current month.
- Daily expenses shows that month's total, distinct recorded-day count, and all related entries. Earlier months are available in Monthly summary.
- A recorded day is a distinct calendar date with at least one expense, not the number of expense entries.
- Entering the receipt flow is part of US1.6; receipt reading, confirmation, and persistence are accepted under US1.7.
