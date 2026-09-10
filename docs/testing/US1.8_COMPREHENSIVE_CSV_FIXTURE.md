# US1.8 comprehensive 12-month gig-driver CSV

Language: **English** | [中文](US1.8_COMPREHENSIVE_CSV_FIXTURE.cn.md)

Uploadable file: [us1.8-comprehensive-12-month-income.csv](../../frontend/e2e/fixtures/us1.8-comprehensive-12-month-income.csv)

This is a deterministic product-test fixture, not a real user, market average,
income forecast, or financial advice. Its 12 monthly gross-income totals match the
existing `my-gig-driver-12m` scenario, so CSV import and downstream finance/housing
checks share one baseline.

The file contains 67 rows: 60 valid incomes from August 2025 through July 2026
and seven intentionally invalid rows. Each month has four `E-hailing` entries and
one `Food delivery` entry on varied dates. Monthly totals range from RM3,910 to
RM6,620 and valid income totals RM62,250. Case and whitespace variants exercise
source reuse; invalid rows exercise amount, precision, date and source validation.

After confirmation, expected analysis is: average RM5,187.50, median RM5,135,
highest RM6,620, lowest RM3,910, and range RM2,710.

US1.8 accepts only `amount,date,source`, so this CSV **cannot import costs**.
The matching local `my-gig-driver-12m` scenario separately creates 240 daily
expenses across five categories, 60 dated work costs totalling RM750 per month,
and RM2,230 monthly commitments. It supports repeatable income-pattern,
complete-expense-month, housing, guest-isolation and persistence checks. See the
[12-month scenario](SCENARIO_GIG_DRIVER_12M.md). Scenario-loading endpoints are
disabled in production; on the real website, costs must be recorded through Work
costs, Commitments and Daily expenses.

`TECH-IMPORT-01` verifies this CSV through the real file picker: preview counts,
seven row-error classes, no income before confirmation, valid-only confirmation,
source reuse, exact 12-month aggregation, analysis and reload persistence. It does
not re-register AC1.8.1–AC1.8.8.

One file cannot cover wrong extensions, missing headers, 2MB/1,000-row limits,
pre-existing monthly-total conflicts, repeat confirmation, guest isolation or
cascade deletion. Dedicated backend tests retain those responsibilities. Fixed
dates make the CSV valid only when the test date is after 2026-07-28.
