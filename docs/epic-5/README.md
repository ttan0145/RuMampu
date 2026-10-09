# Epic 5 implementation and acceptance index

Language: **English** | [Chinese (CN)](README.cn.md)

- Status: Built and covered by executable checks; awaiting owner acceptance
- Scope: 11 user stories, 88 acceptance criteria: the 36 of v5, the 20 Learn criteria for Iteration 3, the team amendments of 2026-10-05 and 2026-10-06 (US5.8 with AC5.8.9 and AC5.8.10, AC5.3.8, AC5.3.9), and the 20 V9 criteria for US5.9–5.11 ([baseline](../requirements/EPIC_5_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md), Drive `US and AC V9.docx`)
- Entry points: House → **Prepare for a house**, and Money → **Cash buffer**
- Decisions: [ADR 0004](../adr/0004-backend-authoritative-housing-calculations.md), see implementation boundary 3; [ADR 0005](../adr/0005-cash-buffer-deepest-fall.md) for how the cash buffer is measured

| User story | Acceptance | Evidence |
| --- | ---: | --- |
| US5.1 — Access homeownership preparation tools | 5/5 | Prepare lists Upfront cash, Cash buffer and Documents & financing; each opens its own screen and returns to Prepare; the House card says what is set aside |
| US5.2 — Check upfront cash readiness | 17/17 | You have / You need / Gap, the water-line chart, the itemised list grouped by when costs fall due, a dated cash entry, published-scale fees with sources, and the first-home switch |
| US5.3 — Estimate a cash buffer from recorded short months | 9/9 | Server-calculated buffer (the deepest fall, ADR 0005), the months it ran between shaded on the 12-month running-balance chart, the zero line where zero falls, the record basis and the RM 0 explanation |
| US5.4 — Review financing preparation documents | 7/7 | Five-item checklist, SJKP criteria with source and date, "needs review" instead of a verdict, and the disclaimer |
| US5.5 — Learn what buying involves before I commit | 11/11 | Prepare entry, five tabs, 19 sourced explanations, terms, personal figures and page-fit checks |
| US5.6 — Find what applies to someone without a payslip | 3/3 | No payslip, SJKP limits and checklist navigation |
| US5.7 — See what I've already read | 6/6 | Read counts, resume, Prepare total and account progress on another device, without rewards |
| US5.8 — Count my savings once across the cash buffer and the upfront costs (team amendment) | 10/10 | The buffer is held from the pot first; Upfront cash, House, the Saving plan and Home read the same split; Cash buffer says how much is covered and links to the plan |
| US5.9 — Prepare for one home, step by step (V9) | 6/7, 1 deferred | One home for every step, the choose-or-type form, four steps none locked, ticks for the monthly, cash and paperwork steps, the all-done line without a verdict, the PDF page. Deferred: AC5.9.7 (a guest who reopens the page goes through the guest entry, which starts a clean record; owner decision pending). Spec: `epic5-prepare-path.spec.ts` |
| US5.10 — Check what paying each month would be like (V9) | 9/9 | Six lesson screens and the summary; the share of the typical month in figures and words (the Comfortable / Tight / Heavy word kept by owner decision, 2026-10-09); provenance tags on every screen and the age-70 rule with its source. Spec: `epic5-prepare-path.spec.ts` |
| US5.11 — See how buying works for my kind of home (V9) | 4/4 | Subsale and project timelines, the choice kept, the Schedule H fold, and every timing and share with its status, source and checked date or an unverified mark. Spec: `epic5-prepare-path.spec.ts` |

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
| AC5.4.5 Display source and date | Passed | The info sheet shows *Source: sjkp.com.my/en/hcgs/eligibility, checked 8 Oct 2026* |
| AC5.4.6 Avoid displaying unsupported approval status | Passed | *65% check: needs review* with its reason; no pass, fail, approved or eligible wording |
| AC5.4.7 Display financing disclaimer | Passed | The info sheet says RuMampu does not apply for the user and cannot tell whether a bank will say yes |
| AC5.5.1 Open the explanations from Prepare | Passed | Prepare opens Learn |
| AC5.5.2 Sections shown as tabs | Passed | Five ordered topic tabs |
| AC5.5.3 Every explanation names its source and date | Passed | All 19 explanations show a linked source and checked date on their last page |
| AC5.5.4 Government sources only | Passed | Government schemes and a direct SJKP participating-institution link |
| AC5.5.5 Reach the right tab from each tool | Passed | Upfront and Documents open their related topics |
| AC5.5.6 Show my own figure where one exists | Passed | Tested-home fees with a CALCULATED amount |
| AC5.5.7 Explain terms where they appear | Passed | Terms expand in place |
| AC5.5.8 Not advice | Passed | Every ending states the advice and approval boundary |
| AC5.5.9 One idea per page | Passed | Actual content height on all 51 pages at 390×844 and 360×740 |
| AC5.5.10 Move between pages with buttons | Passed | Back, Next, Finish and page numbers agree |
| AC5.5.11 Refer EPF out rather than explain it | Passed | EPF boundary and KWSP link |
| AC5.6.1 A tab for irregular income | Passed | No payslip tab and document lesson |
| AC5.6.2 Explain the financing guarantee and its limits | Passed | Both SJKP limits, without promising approval |
| AC5.6.3 Link documents to the checklist | Passed | Document lesson opens the checklist |
| AC5.7.1 Show progress on each explanation | Passed | Read pages over total pages |
| AC5.7.2 Grey out what I've finished | Passed | Read rows have 0.66 opacity and can reopen |
| AC5.7.3 Resume where I stopped | Passed | Unfinished explanations resume their last page |
| AC5.7.4 Show progress for each section and overall | Passed | Topic read counts and the total on Prepare |
| AC5.7.5 Keep progress between sessions | Passed | Account PATCH, reload and a second browser signing into the same account |
| AC5.7.6 Nothing is locked behind reading | Passed | Other features remain usable; reading has no reward or celebration |
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
| AC5.9.1 One home for every step | Passed | The banner names the home, its price and subsale/project; Change home lists both kept tests and "Test a new house first"; choosing one re-points the path (`epic5-prepare-path.spec.ts`) |
| AC5.9.2 Choose or type a home first | Passed | With no test, "Which home are you preparing for?" and the type-in form show no path; after "Use this home" the banner and steps appear |
| AC5.9.3 Four steps, none locked | Passed | The four steps in order, each with its figure; the paperwork step opens first |
| AC5.9.4 What counts as done | Passed | The paperwork tick after all five documents, the monthly tick after Save to my plan, and the cash tick once RM 100,000 on hand covers the need (reached under AC5.9.5); the keys step carries no progress |
| AC5.9.5 Say what is left without a verdict | Passed | With two steps done the line reads "1 thing left before you buy. You have 0% of the cash. RM … to go."; with all three done it reads "All three steps are done. Save your plan for your own reference." and never says ready or approved (copy changed 2026-10-09) |
| AC5.9.6 Keep a copy of my plan | Passed | The print page is headed "RuMampu buying plan, for my own reference" and lists the price, loan, upfront cash, cash buffer, ready documents and the disclaimer; the phone share sheet is not tested |
| AC5.9.7 Kept on this device | Deferred | Kept while the app stays open. The path is already written to local storage on the web and in the phone apps, but a guest who reopens the page goes through the guest entry, which starts a clean record (as the guest-entry copy says); a signed-in account resumes without that step, not yet verified. Owner to choose between keeping the guest record on the device, accepting the criterion for signed-in users only, or syncing the path to the account (2026-10-09) |
| AC5.10.1 The monthly payment first | Passed | The instalment, "90% loan at 4.30%, over 35 years" and "Your typical month" |
| AC5.10.2 Compare with my month, without a rating | Passed (owner decision) | "Comfortable — the instalment is RM 1,245, about 31% of your typical month." states the share in figures and words; the Comfortable / Tight / Heavy word beside it is kept by the owner's decision of 2026-10-09 rather than removed |
| AC5.10.3 Where the payment goes | Passed | Year 1, a middle year and the final year with interest shares and the legend |
| AC5.10.4 Pick how long and how much the bank lends | Passed | 25, 30, 35 years with monthly and total interest; 80%/90% with "You put down … The bank lends …" |
| AC5.10.5 If rates go up | Passed | Now, +1% and +2% with rates and payments, the question, and the answer changes no other figure |
| AC5.10.6 My full monthly bill | Passed | Condo: instalment, quit rent, fire insurance and maintenance, each "Our guess" until changed, with the monthly total |
| AC5.10.7 A cushion from my own months | Passed | The cushion, "Your pot covers …", the running balance months, the biggest drop, and Add RM x opens the saving plan |
| AC5.10.8 Three numbers to keep | Passed | Monthly payment, payment if rates rise 1%, cushion, the loan summary, the disclaimer, and Save marks the step done |
| AC5.10.9 Say where every figure comes from | Passed | Every screen carries the product's provenance tags: the instalment, the split, the tenure figures, the cushion and the three summary numbers are `CALCULATED`; the loan share, rate and years are `YOUR DATA` when they come from the test or a choice in the check and `ASSUMPTION` while a RuMampu starting point is in use; +1% and +2% are `ASSUMPTION`; a changed bill is `YOUR DATA` and an unchanged one stays "Our guess"; (i) on the first screen opens "Where these figures come from"; the age-70 rule cites the CIMB home loan page, checked 9 October 2026 |
| AC5.11.1 Subsale or project | Passed | The timeline switches and the choice is still there after leaving and returning to Prepare |
| AC5.11.2 A subsale in five steps | Passed | The five steps with "You pay" ×4 and "Bank pays" ×1 |
| AC5.11.3 A project as it is built | Passed | Signing, the build with interest-only wording, keys, title and retention, and the Schedule H fold |
| AC5.11.4 Timings and shares name their source | Passed | Subsale: the 2 to 3% deposit, the 14 days and the 3 to 4 months each read "Common practice, not a legal rule." with the agent and lawyer guides as source, checked 9 October 2026; the first-instalment timing is marked unverified. Project: the shares name Schedule H of the Housing Development (Control and Licensing) Regulations 1989 (the same shares as Schedule G since 2015), marked unverified against the gazette text with secondary sources read 9 October 2026, under the timeline and again under the full schedule. Every amount carries `ASSUMPTION` (the 2% earnest deposit), `YOUR DATA` (a typed earnest deposit) or `CALCULATED` |

## Evidence map

- Screens: [`prepare.tsx`](../../frontend/src/rumampu/screens/prepare.tsx); entry points in [`test.tsx`](../../frontend/src/rumampu/screens/test.tsx) and [`money.tsx`](../../frontend/src/rumampu/screens/money.tsx)
- The one pot behind *You have*, the House card, Home and the Saving plan, and the part of it the safety buffer holds: [`pot.ts`](../../frontend/src/rumampu/pot.ts)
- Fee scales behind *You need*: [`fees.ts`](../../frontend/src/rumampu/fees.ts)
- Cash entered and its date: `cash_on_hand` and `cash_on_hand_date` on `UserAppState` ([`models.py`](../../backend/finance/models.py), [migration 0018](../../backend/finance/migrations/0018_userappstate_cash_on_hand_date.py)), validated in [`auth_views.py`](../../backend/config/auth_views.py) and covered in [`test_auth.py`](../../backend/config/test_auth.py)
- Money moved in from finished months: `pot_moved` beside `pot_moved_months` ([migration 0019](../../backend/finance/migrations/0019_userappstate_pot_moved.py)) and in the local snapshot
- Cash-buffer calculation: `_starting_liquidity` in [`services.py`](../../backend/apps/housing/services.py), the deepest fall with `fall_start` and `fall_end` ([ADR 0005](../adr/0005-cash-buffer-deepest-fall.md))
- Backend regression for the 12-month fixture (RM 1,940, RM 904.74, RM 0 and RM 4,740 buffers with every monthly balance and where each fall runs), and an independent check of all chronological suffixes, without rotating months: `GigDriverStartingLiquidityTests` and `StartingLiquidityPathTests` in [`tests.py`](../../backend/apps/housing/tests.py)
- Real-browser acceptance: [`epic5.spec.ts`](../../frontend/e2e/epic5.spec.ts) (48 core acceptance criteria registered once each, plus engineering regressions: TECH-5.1 the Money shortcut, TECH-5.2 edits and a covered need, TECH-5.3 a record that never goes below zero can still need a buffer, TECH-5.4 what the safety buffer holds is not counted again, TECH-5.5 money moved in survives a reload)
- Learn browser acceptance: [`epic5-learn.spec.ts`](../../frontend/e2e/epic5-learn.spec.ts), covering all 20 criteria for US5.5–5.7, all 51 pages and account progress across devices.
- Fee-scale and pot arithmetic at the band edges: [`epic5-upfront-fees.spec.ts`](../../frontend/e2e/epic5-upfront-fees.spec.ts)
- Prepare path, monthly check and How buying works (US5.9–5.11): [`epic5-prepare-path.spec.ts`](../../frontend/e2e/epic5-prepare-path.spec.ts); the sources behind the timings, shares and the age rule: [`buying-facts.ts`](../../frontend/src/rumampu/buying-facts.ts), with the Schedule H arithmetic checked in [`unit/buying-facts.test.ts`](../../frontend/unit/buying-facts.test.ts)
- Traceability gate: `npm run test:e2e:traceability` checks Epic 5 at 88 acceptance criteria against the [baseline](../requirements/EPIC_5_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md): 87 executable, AC5.9.7 explicitly deferred
- Screenshots: [`output/playwright/epic-5/evidence/`](../../output/playwright/epic-5/evidence/), refreshed with `UPDATE_EVIDENCE=1`
- Run the Epic 5 checks: `npm run test:e2e:epic5` in `frontend/`

## Implementation boundaries and acceptance process

1. **The current requirements and LeanKit agree.** The Iteration 3 files and board checked on 2026-10-08 contain 8 user stories and 68 criteria, including US5.8, AC5.3.8/.9 and four amendments. This repair updates the local baseline. Code verification, owner sign-off and card lanes are separate evidence; no cards were moved and external sign-off is not claimed.
2. **The cash buffer is the deepest fall (ADR 0005).** Current AC5.3.2 records that rule; the fixture at RM 1,900 a month produces RM 1,940.
3. **The upfront figures are calculated in the frontend.** ADR 0004 names Django as the authority, but You need and Gap still come from `fees.ts`. Fixed-value regressions remain; moving the scales into the backend is separate architecture work. The valuation scale remains ASSUMPTION.
4. **Some required wording is in info sheets.** Fee and SJKP sources, disclaimers and the cash-buffer record basis are opened through (i) and checked by acceptance tests.
5. **Public sources have explicit verification dates.** SJKP eligibility was checked against its official page on 2026-10-08. References and corrections for all 19 lessons are in [LEARN_SOURCES.md](LEARN_SOURCES.md). Stamp-duty scales retain their previous date rather than claiming a fresh complete verification.

## Approved boundaries

- Official rules support checklists and information only. RuMampu does not show approval, eligibility or affordability conclusions.
- The cash buffer comes from the user's own recorded months and is never presented as a general rule.
- Cash is whatever the user enters; RuMampu never fills it in, and never adds a figure of its own to a cost that has no published scale.
- Applying for financing, credit scoring and post-purchase monitoring (Epic 7 preview) are outside Epic 5.

## Iteration 3 Learn repair — 8 October 2026

US5.5–5.7 are included in this index and the requirement baseline. `epic5-learn.spec.ts` registers their 20 criteria exactly once and follows the real UI, including 51 lesson pages at two phone sizes, sources and dates, term explanations, contextual figures, document navigation, reading counts, resume, reload and a second browser context signing into the same account.

| User story | Criteria | Behaviour |
| --- | ---: | --- |
| US5.5 — Learn what buying involves before I commit | 11 | Prepare opens Learn; five ordered tabs, sourced and dated explanations, government schemes and the SJKP institution list, personal figures, terms, page controls, a disclaimer and KWSP link |
| US5.6 — Find what applies to someone without a payslip | 3 | No payslip topic, SJKP guarantee limits and direct navigation to the checklist |
| US5.7 — See what I've already read | 6 | Pages read, subdued read rows, resume, section and Prepare totals, account-backed cross-device progress, optional reading without rewards |

Apply migration `finance.0022_userappstate_learning_progress` before deploying. Guests keep local reading progress; the authenticated account is authoritative at login. Empty account progress clears another account's local history. Invalid progress rejects a patch atomically.

AC5.7.6 is implemented as written: reading badges and celebration were removed; completed explanations show their read state.

Public content sources and corrections are in [LEARN_SOURCES.md](LEARN_SOURCES.md).

## Final verification (2026-10-08 17:20 SGT)

- `npm run typecheck`: frontend and E2E TypeScript passed.
- `npm run test:e2e:traceability`: Epic 5 maps 68/68 criteria exactly once, with no deferrals.
- Complete `npm run test:e2e`: all 111 tests passed in 16.4m, including 30 Epic 5 tests for all 68 formal criteria and engineering regressions.
- Page fit: 102 checks across all 51 pages at two phone sizes, plus 10 checks of five personal figures at both sizes; all 112 fit without scrolling. The source area is clear of the assistant.
- Complete Django suite on an isolated SQLite test database: all 215 tests passed; no migration drift.
- House costs returns an explicit 503 rather than a 500 when raw sales data is unavailable. Regressions cover missing, partial, empty and loaded data, including transaction recovery.
- Regenerated OpenAPI matches the committed file. Existing serializer-inference and operationId-collision diagnostics remain; generation is not claimed to be warning-free.

Per-criterion evidence and deployment steps are in the [repair report (Chinese)](REPAIR_REPORT.cn.md).

## Iteration 3 close-out — 9 October 2026

- US5.9–5.11 (20 V9 criteria, the Prepare path built on 8 October 2026) joined the baseline, taking Epic 5 to 88 criteria.
- Four criteria the V9 build notes had flagged were closed on 9 October: AC5.9.5 (the all-done line no longer says "ready to buy"), AC5.10.2 (accepted as built by the owner: the share is stated in figures and words, the rating word stays), AC5.10.9 (provenance tags on every screen of the monthly check and a source for the age-70 rule) and AC5.11.4 (status, source and checked date, or an unverified mark, on every timing and share of How buying works, and a provenance tag on every amount). AC5.9.7 waits for the owner's decision on guests.
- Since the Expo SDK 57 upgrade the development bundle shows React's `ariaHidden` warning in a toast that covers the page, so the browser checks for this close-out were run against a production web export (`frontend/playwright.static.config.ts`); the dev-server configuration is unchanged.
