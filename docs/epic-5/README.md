# Epic 5 implementation and acceptance index

Language: **English** | [Chinese (CN)](README.cn.md)

- Status: Built and covered by executable checks; awaiting owner acceptance
- Scope: 5 user stories, 48 acceptance criteria: the 36 of v5 plus the team amendments of 2026-10-05 and 2026-10-06 (US5.8 with AC5.8.9 and AC5.8.10, AC5.3.8, AC5.3.9) ([baseline](../requirements/EPIC_5_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md), Drive `TM16_RuMampu_User_Stories_and_Acceptance_Criteria_v5.docx`)
- Entry points: House → **Prepare for a house**, and Money → **Cash buffer**
- Not in this index: user stories 5.5 to 5.7 (Learn explanations, added for Iteration 3 in the Drive document "Added User Stories to Epics for Iteration 3"). They came with the v27b3 merge and have no acceptance checks yet (open point 6).
- Decisions: [ADR 0004](../adr/0004-backend-authoritative-housing-calculations.md), see open point 2; [ADR 0005](../adr/0005-cash-buffer-deepest-fall.md) for how the cash buffer is measured

| User story | Acceptance | Evidence |
| --- | ---: | --- |
| US5.1 — Access homeownership preparation tools | 5/5 | Prepare lists Upfront cash, Cash buffer and Documents & financing; each opens its own screen and returns to Prepare; the House card says what is set aside |
| US5.2 — Check upfront cash readiness | 17/17 | You have / You need / Gap, the water-line chart, the itemised list grouped by when costs fall due, a dated cash entry, published-scale fees with sources, and the first-home switch |
| US5.3 — Estimate a cash buffer from recorded short months | 9/9 | Server-calculated buffer (the deepest fall, ADR 0005), the months it ran between shaded on the 12-month running-balance chart, the zero line where zero falls, the record basis and the RM 0 explanation |
| US5.4 — Review financing preparation documents | 7/7 | Five-item checklist, SJKP criteria with source and date, "needs review" instead of a verdict, and the disclaimer |
| US5.8 — Count my savings once across the cash buffer and the upfront costs (team amendment) | 10/10 | The buffer is held from the pot first; Upfront cash, House, the Saving plan and Home read the same split; Cash buffer says how much is covered and links to the plan |

## Acceptance record

| Acceptance criterion | Result | What is checked |
| --- | --- | --- |
| AC5.1.1 Show Upfront cash | Passed | The option is visible on Prepare |
| AC5.1.2 Show Cash buffer | Passed | The option is visible on Prepare |
| AC5.1.3 Show Documents & financing | Passed | The option is visible on Prepare |
| AC5.1.4 Navigate to preparation tools | Passed | Each option opens a screen recognised by content only it shows, and Back returns to Prepare |
| AC5.1.5 Show what is set aside so far | Passed | The House card reads "RM 8,000 of RM 44,125 set aside", and "Nothing set aside yet" once the cash is cleared |
| AC5.2.1 Display cash available | Passed | *You have* shows RM 8,000 for an account that holds RM 8,000 |
| AC5.2.2 Identify cash available as user data | Passed | The *You have* row carries the `YOUR DATA` tag |
| AC5.2.3 Display cash required | Passed | RM 300,000 with 10% down shows *You need* RM 44,125, tagged `CALCULATED` |
| AC5.2.4 Display upfront gap | Passed | *Gap* shows RM 36,125, tagged `CALCULATED` |
| AC5.2.5 Visualise available versus required | Passed | The chart has an accessible summary and the cash bar is drawn at 8,000 / (44,125 × 1.12) of the plot height |
| AC5.2.6 Highlight an upfront shortfall | Passed | The gap segment is `#F1592A`, the cash bar `#3C5152`, the segment's height matches the gap and it sits on the cash bar |
| AC5.2.7 Display upfront cost components | Passed | Six listed items with their amounts and `OFFICIAL` / `CALCULATED` / `ASSUMPTION` tags; they add up to *You need* |
| AC5.2.8 Handle a zero deposit | Passed | With 0% down the screen says upfront cash is fees and setting up, and still shows RM 14,650 needed |
| AC5.2.9 Enter available upfront cash | Passed | The *Cash I already have* field starts empty; typing RM 12,000 saves it to the account (checked in the PATCH response and the account) and moves *You have* and *Gap* |
| AC5.2.10 Record the cash snapshot date | Passed | *Reported on* today's date shows beside the amount, the account stores that date, and both survive a reload |
| AC5.2.11 Group the costs by when they fall due | Passed | Headings and the rows under them run To sign, To complete, To move in, in that order |
| AC5.2.12 Treat the earnest deposit as part of the deposit | Passed | An earnest deposit of RM 5,000 turns the balance of the down payment from RM 30,000 into RM 25,000, and the total does not move |
| AC5.2.13 Work out the legal fees from the published scale | Passed | RM 3,750 and RM 3,375, both `OFFICIAL`, and the info sheet names the Solicitors' Remuneration Order 2023 |
| AC5.2.14 Work out stamp duty from the published scale | Passed | RM 5,000 and RM 1,350, both `OFFICIAL`, and the info sheet names the Stamp Act 1949 items 32(a) and 27(a) |
| AC5.2.15 Apply the first-home exemption as a switch I control | Passed | On at RM 300,000 both duties are RM 0 with the reason; at RM 600,000 they show RM 12,000 and RM 2,700 and say the exemption does not apply |
| AC5.2.16 Ask for the figures that have no published scale | Passed | Earnest deposit, mortgage insurance, utility deposits, maintenance deposit and furnishing start empty with RM 5,000 / 12,000 / 900 / 1,200 / 6,000 as placeholders, and the need stays at the published-scale items |
| AC5.2.17 State the pot once | Passed | *You have* appears once and equals the pot; its working shows RM 1,000 already had, one saved plan day and RM 0 moved in summing to the pot; *Gap* and Home both use need less the pot. What the safety buffer already holds is left out and named (TECH-5.4) |
| AC5.3.1 Display cash-buffer amount | Passed | RM 1,940 on screen and the same RM 1,940 from `/housing/test-result/`, with the fall running from December 2025 to February 2026 (counted only from August it would have been RM 680) |
| AC5.3.2 Explain what the buffer represents | Passed | The definition sits under the amount and says it holds whichever month you had started in |
| AC5.3.3 Display running balance by month | Passed | Twelve labelled bars with the exact balances; negatives `#F1592A`, positives `#3C5152`; one-line month abbreviations; `CALCULATED` tags |
| AC5.3.4 State record basis | Passed | The info sheet says *From your own record, Aug to Jul* |
| AC5.3.5 State that it is not a general rule | Passed | The same sheet says *Not a general rule*; no rule-of-thumb benchmark appears |
| AC5.3.6 Explain the displayed buffer result | Passed | The explanation accompanies RM 1,940, and RM 0 (an RM 80,000 home every month carries) gets its own explanation with no drop named or shaded |
| AC5.3.7 Place the zero line where zero falls | Passed | Checked for balances all above zero, all below zero and on both sides: the line sits at the floor, the top and in between, no bar leaves the plot, and the extreme bars reach its edges |
| AC5.3.8 Mark where the deepest fall starts and ends | Passed | *The biggest drop ran from Dec 2025 to Feb 2026* names the months, and only January and February are shaded on the chart |
| AC5.3.9 Say when the months do not catch up | Passed | At RM 2,300 a month the year ends RM 4,650 down and the screen says so in ringgit, with no verdict; at RM 1,900 it ends RM 150 up and nothing is said |
| AC5.4.1 Display document checklist | Passed | Five unchecked items |
| AC5.4.2 Include visible document types | Passed | Bank statements, e-hailing earnings summary, statutory declaration of income, EPF statement, list of existing commitments |
| AC5.4.3 Toggle checklist items | Passed | Selecting an item flips ☐ to ☑ and back; other items are unaffected |
| AC5.4.4 Display SJKP published criteria | Passed | The three criteria are listed |
| AC5.4.5 Display source and date | Passed | The info sheet shows *Source: sjkp.com.my, Aug 2026* |
| AC5.4.6 Avoid displaying unsupported approval status | Passed | *65% check: needs review* with its reason; no pass, fail, approved or eligible wording |
| AC5.4.7 Display financing disclaimer | Passed | The info sheet says RuMampu does not apply for the user and cannot tell whether a bank will say yes |
| AC5.8.1 Hold the buffer first | Passed | With RM 1,000 in the pot and a RM 905 buffer from the kept RM 250,000 test, *You have* is RM 95 and the gap is the need less RM 95 |
| AC5.8.2 One reading on every screen | Passed | Upfront cash, the House card ("RM 95 of … set aside · RM 905 held as your safety buffer") and the Saving plan ("Safety buffer RM 905 · Upfront cash RM 95", pot RM 1,000) agree; Home states what is still to go for both goals |
| AC5.8.3 Say what is held | Passed | "RM 905 of your pot is held as your safety buffer, so it is not counted here", and the pot's working lists the held amount |
| AC5.8.4 Show how much of the buffer is covered | Passed | Cash buffer reads "covers all of this" at RM 1,000, and "covers RM 500 of this. RM 404.74 is still to set aside" at RM 500 |
| AC5.8.5 Nothing is held without a buffer | Passed | Before any test is kept, *You have* is the whole RM 1,000 and no held note appears |
| AC5.8.6 Amounts, not a verdict | Passed | With RM 500 the shortfall on Home and Upfront cash is in ringgit only; no "afford", "qualify" or similar wording appears |
| AC5.8.7 Say when the held amount changes | Passed | Keeping a RM 300,000 test after the RM 250,000 one shows "moved the safety buffer from RM 905 to RM …"; the pot stays RM 500 |
| AC5.8.8 Go on to the saving plan | Passed | "Open the saving plan" on Cash buffer opens the plan with the same RM 500 split |
| AC5.8.9 Using the buffer takes it off the pot | Passed | On Cash buffer, "I used some of my safety money" records RM 500 (more than the RM 905 held is refused); the calm Epic 10 line confirms it, the buffer stays full, the pot drops from RM 10,000 to RM 9,500 and *You have* from RM 9,095 to RM 8,595. Placement chosen by the developer (no v27b4 design) and shared with the team |
| AC5.8.10 Name my safety money | Passed | The pencil beside the name on Cash buffer opens a sheet; "Rainy day fund" (spaces tidied, 30 characters at most) then appears on Cash buffer, Upfront cash, the pot's working and Home; the name is kept with the plan; "Use the default name" goes back to "safety money" |

## Evidence map

- Screens: [`prepare.tsx`](../../frontend/src/rumampu/screens/prepare.tsx); entry points in [`test.tsx`](../../frontend/src/rumampu/screens/test.tsx) and [`money.tsx`](../../frontend/src/rumampu/screens/money.tsx)
- The one pot behind *You have*, the House card, Home and the Saving plan, and the part of it the safety buffer holds: [`pot.ts`](../../frontend/src/rumampu/pot.ts)
- Fee scales behind *You need*: [`fees.ts`](../../frontend/src/rumampu/fees.ts)
- Cash entered and its date: `cash_on_hand` and `cash_on_hand_date` on `UserAppState` ([`models.py`](../../backend/finance/models.py), [migration 0018](../../backend/finance/migrations/0018_userappstate_cash_on_hand_date.py)), validated in [`auth_views.py`](../../backend/config/auth_views.py) and covered in [`test_auth.py`](../../backend/config/test_auth.py)
- Money moved in from finished months: `pot_moved` beside `pot_moved_months` ([migration 0019](../../backend/finance/migrations/0019_userappstate_pot_moved.py)) and in the local snapshot
- Cash-buffer calculation: `_starting_liquidity` in [`services.py`](../../backend/apps/housing/services.py), the deepest fall with `fall_start` and `fall_end` ([ADR 0005](../adr/0005-cash-buffer-deepest-fall.md))
- Backend regression for the 12-month fixture (RM 1,940, RM 904.74, RM 0 and RM 4,740 buffers with every monthly balance and where each fall runs), and an independent check of all chronological suffixes, without rotating months: `GigDriverStartingLiquidityTests` and `StartingLiquidityPathTests` in [`tests.py`](../../backend/apps/housing/tests.py)
- Real-browser acceptance: [`epic5.spec.ts`](../../frontend/e2e/epic5.spec.ts) (36 acceptance criteria registered once each, plus five engineering regressions: TECH-5.1 the Money shortcut, TECH-5.2 edits and a covered need, TECH-5.3 a record that never goes below zero can still need a buffer, TECH-5.4 what the safety buffer holds is not counted again, TECH-5.5 money moved in survives a reload)
- Fee-scale and pot arithmetic at the band edges: [`epic5-upfront-fees.spec.ts`](../../frontend/e2e/epic5-upfront-fees.spec.ts)
- Traceability gate: `npm run test:e2e:traceability` checks Epic 5 at 48/48 acceptance criteria against the [baseline](../requirements/EPIC_5_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md)
- Screenshots: [`output/playwright/epic-5/evidence/`](../../output/playwright/epic-5/evidence/), refreshed with `UPDATE_EVIDENCE=1`
- Run the Epic 5 checks: `npm run test:e2e:epic5` in `frontend/`

## Open points

1. **US5.8 and the amended criteria need the product owner's sign-off.** On 2026-10-05 the team built US5.8 (count the pot once, buffer first) and AC5.3.8 and AC5.3.9, and amended AC5.1.5, AC5.2.9, AC5.2.17 and AC5.3.2, without waiting for the decision. The rule matches the v27b prototype (the pot fills the safety buffer first, then counts towards upfront cash). The [requirements baseline](../requirements/EPIC_5_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md) marks each one; they still need to go into the v5 document and onto LeanKit. The Epic 10 saving plan now reads the same rule (the buffer phase lasts while the pot is below the buffer), which changes AC10.1.3 and AC10.12.3 as proposed in the 2026-10-01 critique; the Epic 10 owner should confirm.
2. **The cash buffer is the deepest fall (ADR 0005).** The amended AC5.3.2 records the reading; the figure can only rise (RM 680 became RM 1,940 on the fixture at RM 1,900 a month).
3. **The upfront figures are calculated in the frontend.** ADR 0004 names Django as the authority for upfront gaps, but *You need* and *Gap* come from the published-scale engine in `fees.ts`. Fixed-value tests pin it, and moving the scales into a backend service is a separate package. The valuation scale is tagged `ASSUMPTION` on screen because it has not been checked against a gazette copy.
4. **Some required wording sits behind the (i) button.** The sources for the fees and the SJKP criteria (AC5.2.13, AC5.2.14, AC5.4.5), the disclaimer (AC5.4.7) and the record basis (AC5.3.4 and AC5.3.5) are in info sheets, following the v24 design, and the checks open the sheets. Printing them on the page is a placement change if the team prefers it.
5. **Re-verify published sources before release.** The SJKP criteria and the *Aug 2026* reference date, and the stamp-duty, legal-fee and valuation scales, were last checked on the dates shown in the info sheets.
6. **Learn explanations (5.5 to 5.7) are built (v27b3, merged 2026-10-05) but have no acceptance checks yet.** Reading progress stays on the device and is not saved to the account, so AC5.7.5 (another device) is not met; the badges and the finished-topic celebration follow the prototype and depart from AC5.7.6 on purpose.

## Approved boundaries

- Official rules support checklists and information only. RuMampu does not show approval, eligibility or affordability conclusions.
- The cash buffer comes from the user's own recorded months and is never presented as a general rule.
- Cash is whatever the user enters; RuMampu never fills it in, and never adds a figure of its own to a cost that has no published scale.
- Applying for financing, credit scoring and post-purchase monitoring (Epic 7 preview) are outside Epic 5.
