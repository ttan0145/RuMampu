# ADR 0004: Backend-authoritative housing calculations

Language: **English** | [Chinese (CN)](0004-backend-authoritative-housing-calculations.cn.md)

- Status: Accepted
- Date: 2026-08-28

## Context

The backend already owned financing calculations, the pre-housing check, and a historical housing-test service. The formal frontend nevertheless submitted client-derived financial months to a stateless endpoint, retained duplicate housing formulas in `calc.ts`, and could route with `preHousingOk()` independently of the server result. Home and preparation screens could therefore disagree with Django.

## Decision

1. Django is the authoritative calculation layer for financing amount, instalment, total home cost, pre-housing residuals, historical tests, shortfalls, carrying range, indicative price conversion, payment comparisons, income-drop scenarios, upfront gaps, and starting liquidity.
2. The formal frontend creates or updates a session-owned `HousingScenario`, requests `/housing/pre-check/`, and runs `/housing/test-result/` by scenario ID.
3. Navigation and display use retained server responses. The frontend does not independently derive a financial conclusion.
4. Payment and income-shock comparisons are optional, non-persisted test-result overrides. They reuse the saved scenario and authoritative finance record without mutating either.
5. `/housing/test/` remains available for v1 compatibility, but the formal frontend no longer calls it or submits client-derived financial months.
6. Formatting, chart positioning, translations, navigation mechanics, and transient UI state remain frontend responsibilities.

## Consequences

- The same backend result drives both the pre-check route and the values shown after navigation.
- Housing formulas are covered by Django tests and represented in OpenAPI.
- Scenario resources can accumulate during a guest session; the frontend updates its retained scenario instead of creating a new row for every rerun.
- Preparation screens that require a historical test ask the user to run that test first rather than silently falling back to local formulas.
