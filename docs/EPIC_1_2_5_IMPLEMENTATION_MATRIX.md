# Epic 1, 2, and 5 implementation matrix

Language: **English** | [Chinese (CN)](EPIC_1_2_5_IMPLEMENTATION_MATRIX.cn.md)

Updated: 2026-08-25

This matrix uses the latest project boundaries to distinguish production-backed behaviour, frontend-only prototypes, and unimplemented work. `Built` is used only when executable code and acceptance evidence exist.

## Foundation

The production-development baseline was completed on 2026-08-24: modular monolith, `/api/v1`, consistent errors, monetary/date conventions, OpenAPI schema, Swagger/ReDoc, a central frontend API client, and pre-commit quality gates. Legacy `/api` paths are temporary compatibility aliases and are not used for new work. A disabled-by-default [12-month Malaysian e-hailing driver scenario](testing/SCENARIO_GIG_DRIVER_12M.md), excluded from public OpenAPI, provides shared deterministic regression input for Epics 1, 2, and 5.

## Epic 1 — Income Builder

| User story | Current status | Code/evidence | Next step |
|---|---|---|---|
| US1.1 Record income from different sources | Complete (10/10 AC) | Income UI; `finance` source/entry APIs; relevant backend regressions; real Playwright flow and refresh persistence; [acceptance record](epic-1/US1.1_RECORD_INCOME.md) | None. Edit/delete are outside formal US1.1 criteria and need a separate requirement if desired. |
| US1.2 Add historical income | Complete (4/4 AC) | Any past month; no minimum history; mutual exclusion of `historical_total` and itemised income; recorded-month count; persistence; [acceptance record](epic-1/US1.2_HISTORICAL_INCOME.md) | None. |
| US1.3 Record direct work-related costs | Complete (6/6 AC) | Default/custom cost APIs; independent amount updates; income-after-cost calculation; persistence; [acceptance record](epic-1/US1.3_WORK_COSTS.md) | None. Historical cost versions and source allocation are outside current criteria. |
| US1.4 Record regular commitments | Complete (6/6 AC) | Living/debt/savings API groups; independent updates; total calculation; persistence; [acceptance record](epic-1/US1.4_COMMITMENTS.md) | None. Treatment of rent in purchase scenarios belongs to the corresponding scenario requirement. |
| US1.5 Record daily expenses | Complete (6/6 AC) | Default/custom `ExpenseCategory` API; positive amount and calendar-date validation; `ExpenseEntry` API; persistence; [acceptance record](epic-1/US1.5_MANUAL_EXPENSES.md) | None. Edit/delete are outside current criteria. |
| US1.6 Review daily expenses | Complete (6/6 AC) | Latest recorded month, total, day count, and entries; manual/receipt/summary entry points; cross-month summary; API and guest isolation; [acceptance record](epic-1/US1.6_EXPENSE_REVIEW.md) | None. The existing 20-day completeness rule does not change the factual recorded-day count. |
| US1.7 Receipt starting point | Complete (10/10 AC) | Photo/file selection; visible reading state; receipt provenance; editable confirmation; retake; confirmed API persistence; [acceptance record](epic-1/US1.7_RECEIPT_STARTING_POINT.md) | Production OCR and source-image storage require a separate package after privacy policy is defined. |
| US1.8 Historical import | Complete (8/8 AC) | UTF-8 CSV upload; row-level amount/date/source preview; invalid rows; transactional import after explicit confirmation; limited history and analysis integration; [acceptance record](epic-1/US1.8_HISTORICAL_IMPORT.md) | None. Other file formats and bank-specific templates need separate requirements. |

### First-loop data boundary

- Guests are isolated by Django session and do not need an account.
- Each guest owns default/custom `IncomeSource`, `FinancialPeriod`, and `IncomeEntry` records.
- `entry_method` distinguishes historical monthly totals from itemised transactions.
- Confirmed imports use `entry_method=import`; batches and rows retain audit relationships, while previews create no income facts.
- Unusually high ordinary income is stored only after user confirmation.
- Production identity, cross-device synchronisation, export, and deletion are not available yet.

## Epic 2 — Income Pattern Analysis

| User story | Current status | Main gap |
|---|---|---|
| US2.1 Month-by-month view | Calculated and charted in the frontend | Pure-function tests are missing; empty-record behaviour needs explicit handling. |
| US2.2 Typical and extreme months | Frontend shows mean, median, high, and low | Insufficient-history behaviour must be defined; never emit `Infinity` or false precision. |
| US2.3 Lower-income months | Conflicts with the latest boundary | The old below-75%-of-average rule remains in code and must be removed. |
| US2.4 Coverage check | Frontend prototype | The `12%` narrow-range threshold is also unsupported and should become an unlabelled, explainable coverage description. |

Epic 2 should stabilise only after Epic 1's persisted income data. The latest boundary prohibits the 75% rule, coefficient-of-variation scoring, and Low/Moderate/High risk bands.

## Epic 5 — Homeownership Preparation

| User story | Current status | Main gap |
|---|---|---|
| US5.1 Review upfront purchase cash | Frontend mock calculation | Amount provenance, effective date, and editable assumptions are not persisted. |
| US5.2 Compare cash on hand with upfront need | Frontend prototype | Savings snapshot is not connected to the API. |
| US5.3 Review cash buffer | Pure calculation and screen exist | Add tests after correcting rent/commitment rules. |
| US5.4 Documents and financing | Frontend checklist prototype | Checklist state is not persisted; SJKP rules and source dates need reverification. |

Official Epic 5 rules may support checklists and information only. They must not produce approval, eligibility, or affordability conclusions.

## Recommended implementation order

1. Foundation and API contract — complete.
2. E1.1 income sources and entries — complete, 10/10 AC.
3. E1.2 historical monthly income — complete, 4/4 AC, with month-level consistency defined.
4. E1.3 persisted work costs — complete, 6/6 AC.
5. E1.4 persisted commitments — complete, 6/6 AC; scenario-specific rent rules remain with scenario work.
6. E1.5/E1.6 daily-expense entry and review — complete, 6/6 AC each.
7. E1.7 receipt starting point — complete, 10/10 AC, with production OCR separated from human confirmation.
8. E1.8 historical CSV import — complete, 8/8 AC, including preview, invalid rows, confirmation, and analysis integration.
9. E2 remove legacy thresholds and add boundary tests for every pure calculation.
10. E5 persist savings, upfront costs, and checklist data before integrating reverified official rules.
