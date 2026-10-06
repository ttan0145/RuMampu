# Project changelog

Language: **English** | [Chinese (CN)](CHANGELOG.cn.md)

## 2026-10-06 — One name for the safety money, and the user can change it (AC5.8.10)

Status: built and checked locally

- The buffer was called four things on screen: cash buffer, safety buffer, safety money and shield. Every string that refers to it now reads one name, "safety money" (MS "duit keselamatan", ZH "安全钱"). The Cash buffer page title stays "Cash buffer", as in the criteria.
- Asked for by the team: the user can give that money a name of their own. Cash buffer shows the current name under the title with the same pencil the income rows use; the sheet takes up to 30 characters, tidies spaces, and "Use the default name" clears it. The name is kept with the plan on the account (`buffer_state.name`, validated by the backend) and is used wherever the app talks about the money.
- Phone-width web no longer scrolls sideways: Ask Ruma's edge tab peeks past the right edge by design, and the app root now clips it instead of widening the page by 31px. The Epic 5 spec checks the page width.
- New AC5.8.10 "Name my safety money"; the traceability gate is at 48/48.

## 2026-10-06 — Use the safety buffer from Cash buffer (AC5.8.9)

Status: built and checked locally

- Cash buffer now has "I used some of my safety money" while the pot covers any of the buffer. A sheet takes the amount, refuses more than the buffer holds, and records it with `drawDownBuffer`: the amount comes off the pot, the buffer refills from the rest first, and the existing Epic 10 line confirms it ("You used your safety money. That's exactly what it's for."). The pot's working shows the amount as "Used from your safety buffer −RM x".
- v27b4 has no design for this, so the placement is the developer's choice and has been shared with the team for review.
- AC5.8.9 is no longer deferred: the Epic 5 spec checks it in the browser, and the traceability gate is at 47/47.

## 2026-10-06 — AC5.8.9 added to the Epic 5 baseline

Status: committed and pushed to main

- After the team review, US5.8 and AC5.3.8, AC5.3.9 and the four amendments were added to the Drive document "Added User Stories to Epics for Iteration 3", together with a new AC5.8.9 "Using the buffer takes it off the pot".
- The repository baseline now has AC5.8.9 (47 Epic 5 criteria). No screen uses the buffer yet, so it is recorded as deferred in the Epic 5 spec and allowed by the traceability gate; the rule itself is pinned by TECH-BUFFER-03 and TECH-BUFFER-06.

## 2026-10-06 — Retire the separate buffer balance; using the buffer spends from the pot

Status: committed and pushed to main on 2026-10-06 (8eb220b)

Raised by the team on 2026-10-06: after the move to one pot, the old shield balance (`buffer.saved`, `buffer.overflow`) was still updated, and "use your safety money" only touched it. So using the buffer would have left the pot, the phase and every screen unchanged.

- `buffer.saved` and `buffer.overflow` are retired. A saved day is in the pot through the plan, and the buffer holds the smaller of the pot and its target. Older snapshots that still carry the two fields load without them, and the account endpoint still accepts them from older devices.
- Using the buffer records the amount as `buffer.used`, which comes off the pot (agreed in the team chat). The buffer refills from the rest of the pot first: with RM 10,000 and a RM 3,000 buffer, using RM 1,000 leaves RM 9,000, the buffer still full at RM 3,000, and RM 6,000 towards upfront costs. Only what the buffer holds can be used. The pot's working lists the amount used.
- The Saving plan's old "overflow" line is removed.
- Each saved day still remembers whether it built a village house, so undoing it takes back a house only if it built one.
- From the upstream Epic 7/8 commit: `docs/openapi.yaml` regenerated for the new post-purchase endpoints, and the retention email no longer uses the Linux-only `%-d` date format, so its test also passes on Windows.

## 2026-10-05 — Merge v27b3; savings counted once, buffer first (US5.8)

Status: committed and pushed to main on 2026-10-05 (0b69b98)

- **Merged origin/main** (v27b3 design, Learn, the price page and model, STT categorisation) with the Epic 5 and acceptance-suite commits. Home, the Saving plan and Ask Ruma take the v27b3 versions; Upfront cash keeps the dated cash entry, steady inputs and the held note. `docs/openapi.yaml` is regenerated for the new endpoints, and the price-model tests no longer write to `/dev/null`, so they also pass on Windows.
- **One pot, buffer first (team amendment US5.8, not yet signed off).** The pot is the cash I already had, what the plan put aside and the months moved in. The cash buffer from the kept house test is held from it first, and only the rest counts towards the upfront cash (`potHeld`, `potForUpfront`, `potSplit`, `potNow`). Upfront cash, the House card, the pot's working, the Saving plan and Home all read this split. Home's line now reads "… more to go for your safety buffer and upfront cash", since it measures both goals.
- **Epic 10 follows the same rule.** The buffer phase lasts while the pot is below the buffer, the village lock reads the pot, and the plan's monthly target subtracts what counts towards the upfront cash instead of only the cash entered. This is the AC10.1.3 and AC10.12.3 change proposed on 2026-10-01; the Epic 10 owner should confirm.
- **Cash buffer** says how much of the buffer the pot already covers and what is still to set aside, links to the Saving plan, and, when the record ends lower than it started, states the shortfall over the whole record (AC5.3.9).
- **Upfront cash** says when a newer kept test moved the buffer, so the amount held changed (AC5.8.7).
- **Requirements:** US5.8, AC5.3.8 and AC5.3.9 are added to the Epic 5 baseline, and AC5.1.5, AC5.2.9, AC5.2.17 and AC5.3.2 are amended, each marked as a team amendment awaiting the product owner. The traceability gate now expects 46 Epic 5 criteria.
- **Account sync fixed for v27b plans.** v27b3 saves two more fields with the month's plan (`from`, the day the split started, and `sig`, what the target was worked out from). The account endpoint refused any plan carrying them, so once a plan existed every account sync was rejected and nothing (cash, moved-in months, plan) reached the server. The validator now accepts both, with bounds, and a backend regression covers it.
- **Tests:** the Epic 5 spec follows the v27b3 screens and covers the ten new criteria; Epic 8 answers v27b's "Add your commitments first" prompt; Epic 10 reads Home's new line; Epic 8 and login specs use the shared API address, so the suite runs on any backend port.

## 2026-10-05 — Fix input focus, saving reversals and acceptance timing

Status: committed and pushed to main on 2026-10-05 (e0f62e9)

- Hoist Upfront cash's row, input and stage components so typing does not remount the inputs. AC5.2.9 types each character and still checks account cash, date, gap and reload.
- Persist each saving day's original destination in optional `saving_plan.buffered` (boolean/null array). Undo follows that destination across phase changes and reloads. Older plans remain accepted; their destinations cannot be recovered exactly, so legacy undo caps the reservation at declared savings remaining. Four regressions failed on the earlier implementation and pass after the fix. Backend tests cover round trips and atomic rejection of malformed allocations.
- Place Ask Ruma at the bottom right on its first layout. The loan-edit test keeps it visible and removes the CSS workaround.
- Receipt scans wait for category data before matching the returned slug. A browser regression deliberately holds the category response.
- Guest fixtures use ordinary clicks through the current entry and wait for an actionable tab. Epic 5 account setup waits for login POST success and the login screen to close. TECH-5.5 previously reloaded while login was pending; it now reaches the transfer, server state and reload assertions.
- Map US3.1 to its official IDs: financing amount is AC3.1.3 (still deferred); AC3.1.6 checks instalment and AC3.1.7 checks known payment. Gate only that US slice (6 executable + 1 deferred / 7), not all of Epic 3.
- Replace the false arbitrary-rotation invariant with an independent check of chronological suffixes. The buffer algorithm and four fixed amounts are unchanged.

### Verification

- Isolated local SQLite: clean Django check, no migration drift, 178/178 backend tests passed.
- Both TypeScript checks and traceability passed. OpenAPI validation exits 0 and matches the document; existing diagnostics remain 4 warnings / 77 errors.
- Focused browser verification: 12/12 passed. One complete Playwright run: 98/98 passed across 13 files in 15.3 minutes, with no skips or retries. SQLite and generated artifacts were isolated outside the repository and removed afterward.

## 2026-10-03 — Acceptance suite back in step with the app; savings counted once; steadier cash buffer; moved-in money kept

Status: committed and pushed to main on 2026-10-05 (e0f62e9)

- **Browser acceptance suite.** The CI step "Run browser acceptance" had failed on every push to main since 2026-09-04. The suite now matches the current main (`aa90231`, merged locally) and the v24/v25 screens:
  - The shared `openApp()` helper walks the guest entry through the "Continue as a guest?" dialog and keeps the client id the test seeded, so specs that seed their record through the API still see it after onboarding.
  - Epic 1 to 4, the import regressions and the housing integration test follow the current screens: one income question with a date picker; past months from "Add a month I did not record"; work costs on Daily expenses with "This was for work"; the receipt tab; the quietest-month line and coverage callouts that save as you answer; the loan sheet on the house form; the income drop on the result. Steps that used fixed dates or future days now pick days in last month, so they pass on any day of a month.
  - Criteria the current screens no longer meet are recorded as explicitly deferred with their reason, not passed: AC1.3.7 (edit a work cost), AC1.4.3 and AC1.4.4 (savings on Bills), AC3.1.3 (financing amount), AC4.4.4 (custom drop), AC4.4.8 and AC4.4.9 (the drop shown as a hypothetical). The traceability gate allows exactly the Epic 1 ones.
  - Two things the v24 port had dropped are back: "+ Your own cost" in work-cost mode on Daily expenses (AC1.3.4), and the lower-income rule behind an (i) on Income pattern (AC2.3.2). The coverage month cells now expose their checked state to assistive technology.
  - Removed `work-costs-hardening.spec.ts`: its eight checks drove the old Work costs screen, which nothing has linked to since v24. Two stale assertions went as well (the horizontal-scroll hint on the pattern chart and the original text under a corrected import row).
  - Three tests that could fail by chance were made steady: the Epic 8 guest-transfer flow now waits for the log-in screen to close before using the tab bar (it failed once under load); the Epic 10 month-end check freezes the clock on the month's second-to-last day instead of the 29th, which February of a common year does not have; and the Epic 10 village merge no longer makes a second move when the first already merged the two tiles (a move that merges nothing clears the message).
- **Savings counted once.** What the Epic 10 safety buffer already holds is left out of *You have*, the House card and the gap on Home, and Upfront cash and the pot's working say how much is held (`potHeld` and `potForUpfront` in `pot.ts`). Cash already held still does not fill the buffer; that rule (proposed US5.8) waits on the product owner and the Epic 10 owner.
- **Cash buffer measured as the deepest fall** ([ADR 0005](adr/0005-cash-buffer-deepest-fall.md)): the smallest opening amount that gets through the rest of the record whichever month it started in. `starting_liquidity` adds `fall_start` and `fall_end`, and Cash buffer names those months and shades them. On the fixture, RM 680 becomes RM 1,940 and RM 0 becomes RM 904.74; RM 4,740 is unchanged.
- **Money moved in from finished months is kept.** `pot_moved` is stored on the account (migration 0019, validated like `cash_on_hand`) and in the local snapshot. Months marked as moved without an amount, from snapshots saved before this, are offered again.
- Regenerated `docs/openapi.yaml`.

### Verification

- Backend: `check` and `makemigrations --check` clean; 176 tests passed; `spectacular --validate` output identical to `docs/openapi.yaml`.
- Frontend: `npm run typecheck`; traceability (Epic 1 58 executable + 4 deferred / 62, Epic 2 18/18, Epic 5 36/36); the whole Playwright suite (93 tests) in batches on 2026-10-03: Epics 1 and 2 22/22; Epics 3 and 4, housing integration, sign-up and import 12/12; Epic 4 expenses and Epic 5 25/25; Epics 6 and 8 28/29 with the guest-transfer test failing once on time and passing on three reruns after the wait was added; Epic 10 5/5. After the three test fixes, Epics 8 and 10 were run together (29 passed; the village test then failed once on the tile placement, which led to its fix) and Epic 10 twice over (see below).
- Not run here: the PostgreSQL job (no local PostgreSQL; migration 0019 is a plain field addition) and the suite in one Linux run as CI does it.

## 2026-10-01 — OpenAPI contract refreshed

- Regenerated `docs/openapi.yaml` from the backend. The committed file had fallen behind the code: it lacked six endpoints (`auth/export`, `auth/guest-transfer`, `auth/record`, `expenses/{entry_id}/coverage`, `housing/saved-tests/{test_id}` and `income/scan`) and three schemas, and still listed the older expense entry-method enum. The CI step that compares the committed file with a fresh `spectacular` run could not pass.
- Checked the way CI does: `spectacular --validate` succeeds and its output is identical to the committed file.

## 2026-10-01 — Epic 5 homeownership preparation tools (v5)

Status: built; acceptance checks pass locally, awaiting owner acceptance

- Re-baselined Epic 5 on the v5 requirements (Drive, Iteration 3: `TM16_RuMampu_User_Stories_and_Acceptance_Criteria_v5.docx`): 36 acceptance criteria, where the earlier repository snapshot had 25. The v5 text is in [`EPIC_5_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md`](requirements/EPIC_5_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md), and the traceability gate checks Epic 5 against it. User stories 5.5 to 5.7 (Learn explanations added for Iteration 3) are not built.
- Reopened the House → Prepare for a house entry and the Money → Cash buffer shortcut, which had pointed at the "Coming soon" placeholder since 2026-09-15. The placeholder screen and its route stay registered.
- Added what was missing or never shown: the Cash buffer option on Prepare (AC5.1.2), the zero-deposit explanation on Upfront cash (AC5.2.8), and the "65% check: needs review" notice on Documents & financing (AC5.4.6). The wording already existed in the string table.
- New in v5: a "Cash I already have" entry on Upfront cash, saved with the day it was reported (AC5.2.9, AC5.2.10). The account state gains `cash_on_hand_date` (migration 0018, validated on the server) and the local snapshot keeps it too.
- "You have" is now one pot (cash already had, plus what the plan added, plus what finished months moved in). Upfront cash, the House card (AC5.1.5), Home and the Saving plan show the same total, and the "How this adds up" sheet lists all three parts (AC5.2.17).
- The cash-buffer chart puts its zero line where zero falls (AC5.3.7), and its month abbreviations no longer wrap onto two lines.
- Gave the upfront-cash and running-balance charts accessible labels and stable test ids so their values can be asserted, and made the first-home switch expose its on/off state to assistive technology.
- Added `epic5.spec.ts` (36 acceptance criteria, each registered once, plus two engineering regressions) and arithmetic tests for the upfront fee scales and the pot. `npm run test:e2e:epic5` runs both files.
- Added backend tests for the cash buffer on the 12-month fixture (RM 680, RM 0 and RM 4,740, with every monthly balance) and for the cash date.
- Restored the US8.4 navigation check to expect the Prepare screen instead of the placeholder.
- Recorded the acceptance record and five open points in the [Epic 5 index](epic-5/README.md): the pot reading is an unconfirmed interpretation and the Saving plan still subtracts only the cash entered, the upfront figures are calculated in the frontend although ADR 0004 names Django as the authority, some required wording sits behind the (i) button, the published sources need reverification, and the Learn stories are not built.

### Verification

- Backend suite: 172 tests passed, including the 3 cash-buffer regressions and the 2 cash-date tests; Django checks and migration-drift checks are clean. The new field is not part of any OpenAPI schema, because the account-state endpoints declare none.
- `npm run typecheck`, the traceability gate (Epic 5 at 36/36) and `npm run test:e2e:epic5` (16 tests) pass. Epics 6, 8 and 10 (34 tests) pass with the pot changes.
- Each new criterion fails its check when the behaviour is broken on purpose (cash date, pot total, zero line, group order, placeholder, earnest deposit, exemption limit, House card), and so do the three earlier gaps, a wrong chart scale and wrapped month labels.
- The full Playwright run covered 98 tests: 59 passed and 39 failed, none of them in Epic 5. The 39 are the Epic 1, 2, 3 and 4, import, work-cost and `housing-integration` specs that already fail on the untouched commit `707e2c0` (eight of them, covering every failure type, were re-run there). Most are caused by the older `openApp()` helper leaving the "Continue as a guest?" dialog open, which blocks the first tap; two wait for wording that the v22 Home no longer shows. One date-dependent Epic 10 test passed on the first of the month but breaks on the last day of a month. These were not fixed here.

## 2026-09-11 — Editable confirmed income imports

- Enabled confirmed CSV income entries to use the existing income edit flow while retaining their `CSV` provenance tag.
- Extended the income-entry update API to edit imported amounts, dates, and sources without changing `entry_method` or the original import-row audit snapshot.
- Added backend and Playwright hardening coverage without introducing a new formal acceptance criterion.

## 2026-09-04 — Income deletion and Work costs regression protection

- Removed a legacy Work costs notice and duplicated row provenance that returned in the income-deletion commit; restored the responsive row layout.
- Removed repeated `YOUR DATA` labels from editable Commitment rows while retaining `CALCULATED` on the derived total.
- Enabled decimal keyboards and decimal-value persistence for Commitment amounts on mobile.
- Standardised mobile decimal input for new income, manual expenses, and custom income-shock percentages.
- Added an end-to-end regression for deleting the last monthly income while preserving dated work costs and recalculating the month as having no income.
- Added API coverage for ownership isolation, repeated deletion, empty-period cleanup, sibling preservation, and work-cost preservation; regenerated OpenAPI with the DELETE operation.

## 2026-08-28 — I1 backend-authoritative housing calculations

Status: complete and verified for main delivery

### Delivered

- Changed the formal housing flow to create or update a guest-owned scenario, request the independent pre-housing check, and run the historical test by scenario ID.
- Reused `/housing/test-result/` for payment comparisons and income-drop scenarios through non-persisted overrides; the formal frontend no longer calls the stateless `/housing/test/` endpoint or submits client-derived finance months.
- Removed frontend housing formulas and the `preHousingOk()` navigation decision from `calc.ts` and `state.tsx`.
- Added backend-authoritative upfront gaps and starting-liquidity paths, then changed Home and Preparation screens to render retained server responses.
- Added serializer/service/API coverage, regenerated OpenAPI, and recorded the decision in ADR 0004.

### Verification

- Full backend suite: 98 tests passed, including 18 housing tests.
- TypeScript and OpenAPI validation passed; Django system checks and migration-drift checks passed.
- The complete Playwright suite passed 28/28 scenarios; the traceability gate confirmed Epic 1 at 56/56 ACs and Epic 2 at 18/18 ACs.
- Fixed profile bootstrap when an income-entry request is the first request in a session, so historical totals cannot leave the profile without default sources, work costs, commitments, or expense categories.

## 2026-08-26 — Playwright acceptance-test standardisation

Status: implemented locally; not committed or pushed

### Delivered

- Standardised browser acceptance as `Epic → US → AC`, with formal ACs exposed as named report steps and non-requirement regressions separated as `TECH-*` hardening tests.
- Added an executable Epic 1 suite with 8 US scenarios and exact 56/56 AC mapping; reorganised Epic 2 into 4 US scenarios with exact 18/18 AC mapping while retaining its failure, race, and boundary regressions.
- Added a static traceability gate that rejects missing, unknown, or duplicated criteria before browser execution.
- Added shared app, evidence, and acceptance helpers; normal regression runs no longer rewrite reviewed evidence screenshots.
- Moved shared Playwright reports and failure artefacts out of the Epic 2 evidence tree and documented English-primary/CN-mirror rules and commands.

### Verification

- Traceability gate: Epic 1 `56/56`; Epic 2 `18/18`.
- TypeScript passed.
- All 27 repository Playwright scenarios passed in the bundled Chromium, including Epic 1, Epic 2, Epic 3, Epic 4, Epic 8, and the housing integration flow.
- The acceptance run exposed and fixed a first-load guest-session race by waiting for the income bootstrap before requesting coverage.

## 2026-08-25 — Epic 3 / Neon integration compatibility

Status: integration-hardened; this does not declare all of Epic 3 complete

### Delivered

- Bound anonymous `HousingScenario` rows to the same session-owned `GuestProfile` as finance data and added an exactly-one-owner database constraint.
- Added a preserving data migration that moves existing unowned scenarios to an inaccessible legacy profile rather than exposing them to a current guest.
- Changed the pre-housing check to read the backend record and reuse Epic 2 month/work-cost calculations; legacy client finance fields remain accepted but cannot override persisted facts.
- Changed housing calculations to `Decimal`, added half-up response rounding, duplicate-cost validation, and transactional nested-cost updates.
- Added credentialed housing requests so the finance and housing API clients retain one guest session.
- Made `PGHOST` an explicit PostgreSQL switch with startup validation and TLS `require` by default for Neon.
- Added a PostgreSQL 16 CI job alongside SQLite, without storing hosted Neon credentials.
- Recorded the compatibility boundary in ADR 0003 and updated the architecture, API contract, OpenAPI, and English/CN documentation.

### Tests

- Full Django suite: 94 tests passed locally, including 14 new housing/database compatibility cases and a preserving migration test.
- All 7 Playwright flows passed, including the real-browser housing/session integration; browser workers are serialised for the SQLite acceptance server.
- Django checks, migration drift, OpenAPI validation, and TypeScript checks passed.

## 2026-08-25 — Epic 2 backend-authoritative income patterns

Status: complete and hardened; main delivery authorised

### Delivered

- Completed US2.1–US2.4 and 18/18 acceptance criteria.
- Added versioned `GET /api/v1/income-pattern/` and `GET/PUT /api/v1/income-coverage/` without legacy aliases.
- Moved monthly aggregation, current work-cost subtraction, descriptive statistics, recorded-minimum identification, and coverage evaluation into application services.
- Added guest-isolated one-to-one coverage persistence while keeping derived analysis ephemeral.
- Replaced unsupported frontend thresholds with typed authoritative responses, explicit empty/limited/loading/saving/error/retry states, and a horizontally scrolling accessible chart.
- Added English primary documentation with `.cn.md` mirrors: requirement snapshot, ADR 0002, API contract, per-US acceptance records, implementation matrix, and index.
- Removed the Epic 2 client-side fallback algorithm, made API mode the formal default, and linked downstream coverage warnings to the authoritative response.
- Added stale-response rejection and request de-duplication; failed coverage saves preserve the last confirmed result and the user's retryable draft.
- Added model/service coverage invariants, fail-safe legacy-row reads, aggregate-safe monetary response fields, accessible selection state, and repository CI gates.
- Rebased onto the team's US3.1–US3.3 and Neon work, preserved the housing flows, restored a documented local SQLite fallback, and completed housing OpenAPI response schemas so the combined main branch remains testable.

### Tests and acceptance

- Backend `finance` suite: 80 tests passed, including 22 dedicated Epic 2 cases.
- The 12-month scenario verifies average `4437.50`, median `4385.00`, highest `5870.00`, lowest `3160.00`, range `2710.00`, population standard deviation `699.16`, and minimum month `2026-02`.
- TypeScript, migration drift, Django system check, OpenAPI generation/validation, and all 6 executable Playwright Epic 2 flows passed.

### Boundaries

- Current active monthly work costs are applied to every recorded month and identified as a current-snapshot basis; historical cost versioning is not implied.
- The API returns descriptive facts only. It does not return forecasts, stability classifications, risk bands, housing shortfall reasons, or unsupported thresholds.
- Coverage persistence belongs to the current guest session, not a permanent account-level declaration.

## 2026-08-25 — Epic 1 full-stack completion

Status: complete; delivered on main

### Delivered

- Established a Django REST Framework modular backend with `/api/v1`, consistent errors, OpenAPI, Swagger/ReDoc, and eight database migrations.
- Completed all eight Epic 1 user stories and 56/56 acceptance criteria:
  - multi-source income, outlier confirmation, and guest persistence;
  - historical monthly income and month-level consistency rules;
  - work costs and three groups of regular financial commitments;
  - manual expenses, expense review, and monthly summaries;
  - receipt starting point, human review, and confirmed saving; and
  - historical-income CSV preview, invalid rows, and confirmed import.
- Connected the Expo frontend to income, work-cost, commitment, expense, and import APIs while retaining English, Bahasa Melayu, and Chinese localisation. English remains the default.
- Extracted and archived searchable requirement snapshots for all 8 Epics/35 user stories/219 acceptance criteria and Epic 1's 8 user stories/56 acceptance criteria.
- Adopted an English-default documentation policy. Chinese documentation is retained under explicit `.cn.md` filenames.

### Tests and acceptance

- Backend `finance` suite: 58 tests passed.
- Frontend TypeScript check passed.
- Migration drift check, OpenAPI generation and validation, and `git diff --check` passed.
- US1.1–US1.8 each have real Playwright browser-acceptance evidence.
- Added the disabled-by-default `my-gig-driver-12m` scenario: approximately 114 ms to create 12 months, 60 income entries, and 240 expenses; income patterns, complete expense months, housing tests, and Epic 5 reuse were verified.

### Notable fixes

- Fixed a session-initialisation race during frontend startup that could create multiple guest profiles for the initial parallel requests.
- Income sources and expense categories prevent isolated accidental deletion while still allowing a guest profile to be deleted as a complete cascade.
- Income imports and receipt-based saves require explicit confirmation; unconfirmed data never becomes a financial fact.

### Current boundaries

- Receipt reading remains a prototype starting point. It does not claim production OCR and does not upload or retain the source image.
- CSV is the only historical import format. XLSX, PDF, bank connections, and automatic column mapping are not implemented.
- User accounts, cross-device synchronisation, and production retention/deletion policies remain future work.
- Epics 2 and 5 can reuse the financial model and deterministic scenario, but their business rules still require delivery against their formal user stories and acceptance criteria.
