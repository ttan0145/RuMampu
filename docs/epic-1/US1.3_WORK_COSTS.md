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
| AC1.3.6 Display recorded entries | Passed | The screen lists every saved record with business date, category, and amount. Rows omit repeated YOUR DATA labels; the net-income result retains CALCULATED. Amount and edit controls can wrap together on narrow screens. |
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
- Legacy values remain preserved in the database and read-only `legacy_monthly_amount` API field, excluded from calculations and never converted automatically into dated entries. On 2026-09-03, the user requested removal of the previous-monthly-estimates notice and legacy amount list from Work costs. This presentation decision supersedes the earlier audit recommendation to show the notice; historical data is neither cleared nor migrated.

## 2026-09-03 follow-up: production incident and partial-load recovery

This follow-up updates the historical release-status note above. The deployed backend initially returned HTTP 500 with `relation "finance_workcostentry" does not exist` for work-cost entries, monthly summaries, income analysis, and the housing pre-check. The category endpoint still returned HTTP 200. This was a missing production schema dependency, amplified by the frontend waiting for all three work-cost reads before displaying any categories or entries.

Timzz subsequently reported applying `finance.0010_work_cost_entry`. A fresh production probe then received HTTP 200 from the category, entry, selected-month summary, income-pattern, and housing pre-check endpoints. The probe used an isolated guest and did not save financial entries or housing scenarios. This confirms recovery of these endpoints, not a complete production browser/write-path acceptance. No production migration was performed by Codex in this follow-up.

The separate local bug fix now publishes successful category and entry reads independently, including responses arriving after another read fails. Every update retains the latest-request guard. The calculated summary remains unavailable until the complete current refresh succeeds; failures must not imply zero costs or missing income. If category loading fails, confirmed records use their API-provided category names rather than bare IDs. Retry keeps the draft and does not submit another entry.

| Existing AC | Additional engineering regression | Result / remaining gap |
|---|---|---|
| AC1.3.1 | TECH-WC-05: categories arriving after failed entry/summary reads remain selectable | Passed locally; production delivery of the frontend fix is still pending. |
| AC1.3.6 | TECH-WC-06/07: loaded entries remain visible when the summary or category endpoint fails | Passed locally; records retain their saved category names. |
| AC1.3.9, AC1.3.10 | TECH-WC-05/06/07 plus the existing US1.3 acceptance flow | Passed locally; no unavailable result is presented as a confirmed zero or net figure. |

- Red/green evidence: TECH-WC-05 first failed on the unchanged application because `Petrol` was absent, then passed after the fix.
- Fresh validation: 106 backend tests passed; no migration drift; frontend TypeScript passed; Epic 1 60/60 and Epic 2 18/18 AC identifiers remain mapped exactly once.
- Full local browser suite: **35/35 passed (2.4 minutes)** using Chromium and SQLite, including existing Epic 3/4 housing flows and three new partial-load regressions. No new PostgreSQL CI or real-device acceptance is claimed.
- Scope: bug recovery only. No font, colour, layout, editing-flow, delete-action, or requirement changes. Existing AC3.2.5 and AC3.3.1 describe the affected housing behaviour; handing over migration execution does not create new Epic 3 ACs.
- A subsequent real-browser check on `https://rumampu-frontend.vercel.app/` used a new, initially empty guest without request mocks. It verified category loading, zero-amount rejection, adding two costs in one category, editing one record, moving it to the previous month, and reload persistence. With RM 3,000 income, the remaining current-month cost of RM 25 produced RM 2,975 net income in both Work costs and Income pattern. A cost-only prior month did not fabricate income.
- The same live session completed housing tests at RM 1,230 and RM 3,030 total monthly cost. The latter correctly reported one short month and an RM 55 gap against RM 2,975 net income. Synthetic records remain in that isolated visitor: one income, two work-cost entries, and one housing scenario. No existing user's records were changed.
- Live normal-path recovery does not prove the new partial-failure fix has deployed; the fault-injection regressions above ran locally. One Result/Back navigation loop was observed; Home → Re-test the house worked. Navigation investigation, production Debug settings, and any UI redesign remain separate work.
- This follow-up is included with the frontend bug-fix delivery. LeanKit and formal ACs were not changed; pushing a commit alone does not verify its production deployment.

## 2026-09-04 follow-up: income-deletion regression

The income-deletion commit `f054241` was based on the prior UI fix but restored an older Work costs fragment. It reintroduced both the retired legacy-estimate notice and the duplicated per-row `YOUR DATA` labels while the translation key remained deleted, which rendered `[wc_legacy_note]`. Deleting income refreshes Work costs and exposed the restored fragment; deletion did not create the legacy value.

The repaired frontend removes the restored fragment again and keeps the responsive recorded-row layout. `TECH-WC-08` now executes the reported path: create income and a dated work cost in one month, delete that month's last income, reopen Work costs, and verify that the cost remains, net income is unavailable, and neither retired legacy text nor row-level `YOUR DATA` appears. Two API tests cover guest isolation, repeated deletion, empty-period cleanup, sibling-entry retention, and work-cost preservation.
