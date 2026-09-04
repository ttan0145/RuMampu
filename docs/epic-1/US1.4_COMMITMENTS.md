# US1.4 acceptance record: Record regular financial commitments

Language: **English** | [Chinese (CN)](US1.4_COMMITMENTS.cn.md)

- Acceptance date: 2026-08-25
- Status: complete (6/6 AC)
- Requirement: [US1.4 — Record regular financial commitments](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md#us14---record-regular-financial-commitments)

## Acceptance matrix

| Acceptance criterion | Status | Implementation and acceptance evidence |
|---|---|---|
| AC1.4.1 Record regular living costs | Passed | Commitments loads Rent, Food, Utilities, and Family support from the API and saves Rent as RM700. |
| AC1.4.2 Record debt repayments | Passed | Debt repayments independently lists Motor loan and PTPTN and saves Motor loan as RM420. |
| AC1.4.3 Record savings contributions | Passed | Savings lists Monthly savings and saves RM100. |
| AC1.4.4 Separate commitment groups visually | Passed | Living costs, Debt repayments, and Savings use three titled visual sections; see the [reloaded commitments screen](../../output/playwright/epic-1/evidence/ac1.4.1-6__commitments-after-reload.png). |
| AC1.4.5 Show total commitments | Passed | The screen calculates `Total commitments RM 1,220` as RM700 + RM420 + RM100. |
| AC1.4.6 Identify calculated total | Passed | The total carries a `CALCULATED` label. Editable source fields are already self-evident controls, so they do not repeat a `YOUR DATA` label on every row. |

## Automated and browser acceptance

- Backend `finance` suite: 29 tests passed. US1.4 covers default groups, independent updates within a group, negative rejection, and cross-guest update rejection.
- Frontend TypeScript check passed.
- Real Playwright acceptance entered living, debt, and savings values and verified RM700 + RM420 + RM100 = RM1,220.
- All values, groups, and the RM1,220 result remained after refresh.
- The final browser console had no product errors; only Expo Web's development animation-driver warning appeared.
- Acceptance fixed an initial-request race: the frontend now establishes a session cookie through the income-profile request before loading work costs and commitments in parallel.
- Local acceptance data was cleaned after verification.

## 2026-09-04 follow-up: provenance cleanup

The Commitments screen no longer repeats `YOUR DATA` beneath every editable item. This changes presentation only: each amount is still persisted as guest-owned source data, while `Total commitments` retains `CALCULATED` because it is derived from the items. `TECH-CM-01` protects that distinction in a real browser.

Commitment inputs now request a decimal keyboard on mobile and retain decimal values rather than truncating them on blur. `TECH-CM-02` enters RM700.55, verifies the confirmed API amount and total, reloads the app, and verifies the decimal value remains visible.

## Data convention and boundaries

- A commitment amount represents its current monthly amount. Zero is allowed; negative amounts are not.
- Every item belongs to `living`, `debt`, or `savings`; total commitments equal the sum of every active item's monthly amount.
- This story does not require custom commitment items or define historical versions/effective dates, so they are not added here.
- Whether rent stops after a home purchase is a later housing-scenario rule and does not alter the user's original commitment. Any automatic switch needs an explicit effective date and scenario requirement.
