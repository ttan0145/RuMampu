# US1.3 acceptance record: Record direct work-related costs

Language: **English** | [Chinese (CN)](US1.3_WORK_COSTS.cn.md)

- Acceptance date: 2026-09-03
- Status: local implementation and acceptance passed (10/10 AC); not a LeanKit closure, IT2 scheduling decision, or production release.
- Requirement: [US1.3 — Record direct work-related costs](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md#us13---record-direct-work-related-costs)

## Acceptance matrix

| Acceptance criterion | Status | Implementation and acceptance evidence |
|---|---|---|
| AC1.3.1 Select a work-cost category | Passed | The screen loads the profile-owned default and custom categories; a category must be selected before saving. |
| AC1.3.2 Enter a work-cost amount | Passed | The form and API require a monetary amount greater than zero. |
| AC1.3.3 Enter a work-cost date | Passed | The form uses a date picker; the API stores `date` and rejects future dates. |
| AC1.3.4 Add a custom category | Passed | `POST /api/v1/work-costs/` adds a unique custom category without assigning a recurring amount. |
| AC1.3.5 Save a work-cost entry | Passed | `POST /api/v1/work-costs/entries/` appends one separate category, amount, and date record. |
| AC1.3.6 Display recorded entries | Passed | The screen lists every saved record with business date, category, amount, and user-data provenance. |
| AC1.3.7 Edit a work-cost record | Passed | `PATCH /api/v1/work-costs/entries/{id}/` changes only the selected entry and refreshes affected monthly results. |
| AC1.3.8 Apply work costs to the correct month | Passed | The finance service groups costs by `cost_date` month/year and never applies an entry to another month. |
| AC1.3.9 Show income after work costs | Passed | The selected-month summary calculates gross income minus that month's costs; a no-income month keeps costs visible and marks the net figure unavailable. |
| AC1.3.10 Identify calculated income | Passed | The displayed monthly net uses the `CALCULATED` provenance label and explicitly states it uses the selected month's records, not an average. |

## Automated and browser acceptance

- Full backend `manage.py test`: 106 tests passed, including 7 new work-cost boundary tests for cross-year edits, strict months, date/precision validation, guest isolation, zero/negative values, and legacy preservation.
- Frontend TypeScript and acceptance traceability checks passed; all 60 Epic 1 AC identifiers are mapped exactly once.
- Full `npm run test:e2e -- --reporter=line` on 2026-09-03: 32 tests passed (2.3 minutes), including Epic 1/2, existing housing/record flows, and 4 new work-cost failure regressions.
- US1.3 in `e2e/epic1.spec.ts` derives relative dates from the server's current month. It checks reload persistence, one-entry editing, same-month deductions, a cost-only month, and calculated provenance.

The acceptance skill separates identifier coverage from actual acceptance. The full regression supplies fresh execution evidence; engineering mappings and release gates are in the [critical audit (Chinese)](US1.3_AUDIT_2026-09-03.cn.md).

## Calculation convention

- A work-cost category is only a label. A monetary fact exists only as a separate entry with a positive amount and business date.
- `Income after work costs` for `YYYY-MM` is that month's recorded gross income minus entries whose `cost_date` is in the same `YYYY-MM`.
- If the selected month has no income, RuMampu does not substitute an average or another month. It displays the recorded costs and says the calculated income is unavailable.
- Legacy `WorkCostItem.monthly_amount` values remain stored for migration safety but are not read by calculation services; no historical dates are fabricated from them.
- Positive legacy values are exposed through read-only `legacy_monthly_amount` as excluded estimates, with a duplicate-entry warning. Production migration and versioning of the changed v1 contract remain release gates; nothing was deployed.
