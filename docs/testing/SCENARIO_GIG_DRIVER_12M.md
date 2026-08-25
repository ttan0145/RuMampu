# 12-month Malaysian e-hailing driver simulation

Language: **English** | [Chinese (CN)](SCENARIO_GIG_DRIVER_12M.cn.md)

- Scenario ID: `my-gig-driver-12m`
- Purpose: full Epic 1 regression and stable input for later Epic 2/5 algorithms and screens
- Nature: deterministic product-test fixture, not Malaysian driver-income statistics, a forecast, or financial advice

## Why Playwright does not click 300 times

A real user records transactions individually, but an end-to-end test does not need to wait mechanically for every entry. The development-only scenario API creates all facts in one guest session, after which Playwright operates the real interface. This preserves:

- the same models, guest isolation, and persistence path as production features;
- repeatable amounts and dates for detecting algorithm regressions;
- sub-second setup instead of minutes of repetitive UI input; and
- real-browser verification of navigation, calculations, charts, and refresh behaviour.

## Scenario data

The scenario covers August 2025 through July 2026:

| Month | Condition label | Gross income | Recorded daily expenses |
|---|---|---:|---:|
| 2025-08 | baseline | RM4,780 | RM1,080 |
| 2025-09 | strong_demand | RM5,260 | RM1,130 |
| 2025-10 | weather_variation | RM4,930 | RM1,100 |
| 2025-11 | demand_recovery | RM5,480 | RM1,170 |
| 2025-12 | holiday_peak | RM6,620 | RM1,430 |
| 2026-01 | post_holiday_slow | RM4,380 | RM1,080 |
| 2026-02 | vehicle_downtime | RM3,910 | RM1,190 |
| 2026-03 | festive_evening_peak | RM5,840 | RM1,290 |
| 2026-04 | festive_cooldown | RM4,690 | RM1,150 |
| 2026-05 | strong_weekends | RM5,560 | RM1,230 |
| 2026-06 | mixed_demand | RM5,010 | RM1,170 |
| 2026-07 | strong_demand | RM5,790 | RM1,320 |

The load creates:

- 12 financial months;
- 60 income entries: four E-hailing and one Food delivery entry per month;
- 240 expenses: 20 distinct dates per month across Meals, Groceries, Tolls & parking, Family, and Other;
- RM750 monthly work costs; and
- estimated monthly commitments of RM2,230, including Food and Family items that complete expense months may replace.

The amounts deliberately include strong months, slow months, and vehicle downtime so later algorithms receive variation rather than a flat line. Condition labels explain the fixture design only; they do not claim that these events produce the stated amounts in real life.

## Development-only API

The endpoints are disabled by default and excluded from public OpenAPI. When enabled, a load resets only the current guest's Epic 1 finance data and does not affect other sessions:

```powershell
$env:ENABLE_TEST_SCENARIOS = 'True'
.\backend\.venv\Scripts\python.exe backend\manage.py runserver 127.0.0.1:8000 --noreload
```

List scenarios:

```http
GET /api/v1/dev/scenarios/
```

Load the scenario:

```http
POST /api/v1/dev/scenarios/my-gig-driver-12m/load/
Content-Type: application/json

{"confirm_reset": true}
```

`confirm_reset=true` is mandatory. Loading again replaces the current test guest's data rather than adding duplicates. Production or disabled environments return 404.

## Playwright regression flows

### Flow A: fast load and profile

1. Open the web application so the production API establishes a guest session.
2. POST the scenario-load endpoint from the current page context.
3. Refresh and verify `You have 12 months of income recorded` and Aug–Jul coverage.

The measured browser round trip was approximately 114 ms and server loading approximately 85.8 ms. See the [home screenshot](../../output/playwright/scenarios/gig-driver-12m/01-home-12-months.png).

### Flow B: income variation

1. Open Money and verify the latest month's two income sources and expense categories.
2. Open Income pattern and verify 12 bars, mean/median/high/low, and visible slow months.

After RM750 work costs, the measured results are mean RM4,438, median RM4,385, maximum RM5,870, and minimum RM3,160. See the [Money overview](../../output/playwright/scenarios/gig-driver-12m/02-money-overview.png) and [income-pattern screenshot](../../output/playwright/scenarios/gig-driver-12m/03-income-pattern-12m.png).

### Flow C: complete expense months

1. Open Daily expenses and verify July totals RM1,320 across 20 recorded days.
2. Open Monthly summary and verify all 12 months are `fully recorded · used in the test`.

See the [12-month expense screenshot](../../output/playwright/scenarios/gig-driver-12m/04-expense-months-12m.png).

### Flow D: housing test

1. Use the existing RM250,000, zero-deposit, 4.3%, 35-year scenario.
2. Run the housing test and verify all 12 months participate.
3. The current deterministic result is a shortfall in 2/12 months, with a maximum gap of RM742.

See the [housing-test screenshot](../../output/playwright/scenarios/gig-driver-12m/05-housing-result-12m.png).

### Flow E: later-Epic reuse

- Epic 2 can use the same 12-month `condition`, income range, and coverage to verify analysis conventions.
- Epic 5 can reuse the income, expense, and housing state to verify buffer, upfront-cash, and scenario comparisons without recreating data.

The Cash buffer screen already reads the entire Aug–Jul record. See the [reuse screenshot](../../output/playwright/scenarios/gig-driver-12m/06-epic5-buffer-reuse.png). Epic 2/5 business rules must still be implemented against their own user stories and acceptance criteria; the fixture does not define product conclusions in advance.

## Safeguards and maintenance

- Register a new scenario in `available_scenarios()` with a new stable ID; do not change the amounts of an existing scenario.
- Once a scenario is a regression baseline, amount changes are test-contract changes and require updated expected values and evidence.
- Scenario endpoints must never enter production OpenAPI or bypass session isolation.
- Scenario data must never be described as a real user, market average, or income forecast.
