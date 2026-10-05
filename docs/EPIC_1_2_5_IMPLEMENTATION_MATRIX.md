# Epic 1, 2, and 5 implementation matrix

Language: **English** | [Chinese (CN)](EPIC_1_2_5_IMPLEMENTATION_MATRIX.cn.md)

Updated: 2026-10-03

This matrix uses the latest project boundaries to distinguish production-backed behaviour, frontend-only prototypes, and unimplemented work. `Built` is used only when executable code and acceptance evidence exist.

## Foundation

The production-development baseline was completed on 2026-08-24: modular monolith, `/api/v1`, consistent errors, monetary/date conventions, OpenAPI schema, Swagger/ReDoc, a central frontend API client, and pre-commit quality gates. Legacy `/api` paths are temporary compatibility aliases and are not used for new work. A disabled-by-default [12-month Malaysian e-hailing driver scenario](testing/SCENARIO_GIG_DRIVER_12M.md), excluded from public OpenAPI, provides shared deterministic regression input for Epics 1, 2, and 5.

## Epic 1 — Income Builder

Re-verified on 2026-10-03 against the v24/v25 screens: 58 of the 62 criteria pass in `epic1.spec.ts`, and 4 are recorded as explicitly deferred with their reason (the traceability gate allows exactly these). The per-story acceptance records linked below were written for the v22 screens.

| User story | Current status | Code/evidence | Next step |
|---|---|---|---|
| US1.1 Record income from different sources | 11/12 AC; AC1.1.8 deferred | One amount and one date picker (v24); sources and a custom source; amount validation; the high-entry warning; editing with the date-change confirmation; [acceptance record](epic-1/US1.1_RECORD_INCOME.md) | AC1.1.8 (`Your Data` on each entry) stays deferred, as before. |
| US1.2 Add historical income | Complete (4/4 AC) | "Add a month I did not record" opens the past-month sheet; the current month cannot be picked; recorded-month count; [acceptance record](epic-1/US1.2_HISTORICAL_INCOME.md) | None. |
| US1.3 Record direct work-related costs | 9/10 AC; AC1.3.7 deferred | Work costs are recorded on Daily expenses with "This was for work" (v24, v5 Amendments 2 and 3) and listed in their own table; "+ Your own cost" restored on 2026-10-03; income after work costs per month on Income pattern; [acceptance record](epic-1/US1.3_WORK_COSTS.md) | AC1.3.7 (edit a work cost): the v24 table has no edit action and the old Work costs screen is no longer reachable. Needs a decision and an app change. |
| US1.4 Record regular commitments | 4/6 AC; AC1.4.3 and AC1.4.4 deferred | Living costs and debt repayments on Bills; total tagged `CALCULATED`; one provenance tag per group; [acceptance record](epic-1/US1.4_COMMITMENTS.md) | The v24 Bills screen keeps living costs and debts only (commit a1e6fbf), while AC1.4.3 and AC1.4.4 ask for a savings section. The product owner decides whether to bring it back or amend the criteria. |
| US1.5 Record daily expenses | Complete (6/6 AC) | One amount and one date picker; default and custom categories; [acceptance record](epic-1/US1.5_MANUAL_EXPENSES.md) | None. |
| US1.6 Review daily expenses | Complete (6/6 AC) | Month total, recorded days and entries; Manual, Scan and Import tabs; monthly summary; [acceptance record](epic-1/US1.6_EXPENSE_REVIEW.md) | None. |
| US1.7 Receipt starting point | Complete (10/10 AC) | The receipt tab on Daily expenses: photo area, camera, sample, reading state, editable confirmation tagged "from receipt", retake; [acceptance record](epic-1/US1.7_RECEIPT_STARTING_POINT.md) | Production OCR and source-image storage require a separate package after privacy policy is defined. |
| US1.8 Historical import | Complete (8/8 AC) | UTF-8 CSV upload; row-level preview; invalid rows; import only after confirmation; analysis integration; [acceptance record](epic-1/US1.8_HISTORICAL_IMPORT.md) | None. Other file formats and bank-specific templates need separate requirements. |

### First-loop data boundary

- Guests are isolated by Django session and do not need an account.
- Each guest owns default/custom `IncomeSource`, `FinancialPeriod`, and `IncomeEntry` records.
- `entry_method` distinguishes historical monthly totals from itemised transactions.
- Confirmed imports use `entry_method=import`; batches and rows retain audit relationships, while previews create no income facts.
- Unusually high ordinary income is stored only after user confirmation.
- Production identity, cross-device synchronisation, export, and deletion are not available yet.

## Epic 2 — Income Pattern Analysis

| User story | Current status | Code/evidence | Next step |
|---|---|---|---|
| US2.1 Month-by-month view | Complete (3/3 AC) | Backend aggregation; versioned pattern API; one labelled bar per recorded month; [acceptance record](epic-2/US2.1_MONTH_BY_MONTH.md) | v24 dropped the horizontal-scroll hint; the criteria do not need it. |
| US2.2 Typical and extreme months | Complete (6/6 AC) | Average, median, highest, lowest and the recorded range; limited-history note; [acceptance record](epic-2/US2.2_TYPICAL_AND_EXTREMES.md) | v24 no longer shows the standard deviation (the API still returns it); AC2.2.6 is met by the recorded range. |
| US2.3 Lower-income months | Complete (2/2 AC) | The quietest recorded month, named after work costs; the rule ("not a financial standard or a prediction") behind its (i), restored on 2026-10-03; [acceptance record](epic-2/US2.3_LOWER_INCOME.md) | Epic 3 actual-shortfall reasons remain a future extension. |
| US2.4 Coverage check | Complete (7/7 AC) | Answers and month cells save as they are made (v24, no Check button); gap, covered and info callouts from the saved answer; month cells expose their checked state (2026-10-03); [acceptance record](epic-2/US2.4_COVERAGE_CHECK.md) | Account-level declarations wait for an identity requirement. |

Epic 2 is backend-authoritative and re-verified at 18/18 AC on 2026-10-03. It returns descriptive facts without unsupported thresholds, stability conclusions, forecasts, or risk bands. See the [Epic 2 index](epic-2/README.md).

## Epic 5 — Homeownership Preparation

| User story | Current status | Code/evidence | Open point |
|---|---|---|---|
| US5.1 Access homeownership preparation tools | Built (5/5 AC) | Prepare lists Upfront cash, Cash buffer, and Documents & financing; entry points reopened from House and Money; the House card states what is set aside; [acceptance index](epic-5/README.md) | None. |
| US5.2 Check upfront cash readiness | Built (17/17 AC) | Dated cash entry saved to the account (`cash_on_hand_date`, migration 0018); "You have" is one pot shared with Home and the House card, less what the cash buffer holds first (US5.8, 2026-10-05); fee engine pinned by band-edge tests; chart geometry, colours, grouping, sources, and the first-home switch checked in the browser | The amended AC5.1.5, AC5.2.9 and AC5.2.17 await the product owner; the figures are calculated in the frontend although ADR 0004 names Django as the authority. |
| US5.3 Estimate a cash buffer from recorded short months | Built (9/9 AC, with the amendments) | Server-calculated buffer, now the deepest fall whichever month the record starts in ([ADR 0005](adr/0005-cash-buffer-deepest-fall.md)); the months of that fall named and shaded; backend regressions on the 12-month fixture; zero line where zero falls | The product owner should confirm the amended AC5.3.2 and the new AC5.3.8 and AC5.3.9 (RM 680 became RM 1,940 on the fixture). |
| US5.4 Review financing preparation documents | Built (7/7 AC) | Five-item checklist; SJKP criteria with source and date; "needs review" instead of a verdict; disclaimer | SJKP criteria and the Aug 2026 reference date need reverification before release. |
| US5.8 Count my savings once (team amendment) | Built (8/8 AC) | One pot (cash had + plan + moved in), the buffer held first; Upfront cash, House, the pot's working, the Saving plan and Home read the same split; Cash buffer shows the cover and links to the plan; Epic 10's buffer phase and monthly target follow it | Product owner and Epic 10 owner sign-off; then the v5 document and LeanKit. |

The 46 criteria are the 36 of the [v5 baseline](requirements/EPIC_5_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md) plus the team amendments of 2026-10-05. User stories 5.5 to 5.7 (Learn explanations, added for Iteration 3) came with the v27b3 merge and have no acceptance checks yet. Official Epic 5 rules may support checklists and information only. They must not produce approval, eligibility, or affordability conclusions. See the [Epic 5 index](epic-5/README.md) for the acceptance record and open points.

## Recommended implementation order

1. Foundation and API contract — complete.
2. E1.1 income sources and entries — 11/12 AC, AC1.1.8 deferred.
3. E1.2 historical monthly income — complete, 4/4 AC.
4. E1.3 work costs — 9/10 AC; editing a work cost (AC1.3.7) needs restoring.
5. E1.4 commitments — 4/6 AC; the savings section (AC1.4.3, AC1.4.4) needs a product-owner decision.
6. E1.5/E1.6 daily-expense entry and review — complete, 6/6 AC each.
7. E1.7 receipt starting point — complete, 10/10 AC, with production OCR separated from human confirmation.
8. E1.8 historical CSV import — complete, 8/8 AC.
9. E2 backend-authoritative income pattern and coverage — complete, 18/18 AC.
10. E5 preparation tools — built, 46/46 AC (v5 plus team amendments) with executable evidence. Remaining: sign-off for US5.8 and the amended criteria, move the upfront fee scales into the backend, reverify the published sources, and add acceptance checks (and account-saved progress) for the Learn stories 5.5 to 5.7.
