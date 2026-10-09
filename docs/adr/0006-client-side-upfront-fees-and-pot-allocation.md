# ADR 0006: Client-side upfront fees and pot allocation

Language: **English** | [Chinese (CN)](0006-client-side-upfront-fees-and-pot-allocation.cn.md)

- Status: Accepted (owner decision for Epic 5, 2026-10-09)
- Date: 2026-10-09
- Amends: [ADR 0004](0004-backend-authoritative-housing-calculations.md) for upfront costs only

## Context

AC5.2.13–5.2.16 ask the app to work out the legal fee, stamp duty and the first-home exemption from published scales. AC5.2.17 and US5.8 (AC5.8.1–5.8.9) ask for one pot of the user's own money that is counted once, with the cash buffer held first. These rules landed on the client on 2026-10-05 and 2026-10-06 (commits `0b69b98` and `34dd6aa`):

- `frontend/src/rumampu/fees.ts` holds the fee scales and `upfrontNeed`.
- `frontend/src/rumampu/pot.ts` holds the pot arithmetic (`potParts`, `potSum`, `potHeld`, `potForUpfront`).
- The backend stores `UserAppState.buffer_state` and `pot_moved` and checks their types and ranges only (`config/auth_views.py`).
- `/housing/test-result/` adds the deposit and the sum of the `upfront_costs` the client sends and returns the gap (`apps/housing/services.py`). It never works out a fee.
- The starting cash buffer (the deepest fall) is still computed by the backend, as decided in [ADR 0005](0005-cash-buffer-deepest-fall.md).

ADR 0004 listed "upfront gaps and starting liquidity" as backend-authoritative. For the fee amounts and the pot rules that is not what the code does, and moving them would add work to Iteration 3 with no change visible to the user.

## Decision

1. The fee formulas in `fees.ts` and the pot rules in `pot.ts` are educational estimates, and the client is their authority. The backend stores the results and does range checks; it does not recompute or validate the formulas.
2. Published scales used by `fees.ts`:
   - Transfer stamp duty: Stamp Act 1949 (Act 378), First Schedule item 32(a).
   - Loan stamp duty: Stamp Act 1949, item 27(a).
   - Legal fee: Solicitors' Remuneration Order 2023, P.U.(A) 207/2023.
   - Valuation fee: Board of Valuers, Rule 48 item 3.
   - First-home exemption: Stamp Duty (Exemption) Orders P.U.(A) 53/2021 and 54/2021, as amended.
3. A change to any rate is made only in `fees.ts`, with the source and the date it was checked in the comment above the function and in the changelog.
4. `fees.ts` and `pot.ts` must keep unit tests (`frontend/unit/`, run by `npm run test:unit` in CI) that cover every band edge and the worked examples in AC5.8.5 and AC5.8.9.
5. The starting cash buffer stays backend-authoritative under ADR 0005.
6. If upfront fees or the pot ever need to be backend-authoritative, a new ADR will supersede this one.

## Consequences

- Iteration 3 needs no new endpoint, migration or backend tests for these rules, and each scale has a single place in the code.
- The figures can differ between devices or app versions if the client code differs, and the backend cannot correct them if the rules change.
- A rate change needs a new app release. The server has no tests for these numbers, so the frontend unit tests are the only guard.
- ADR 0004 remains in force for financing, instalments, total home cost, historical tests, shortfalls and price conversion. For the upfront gap its scope is now "sum the cost items the client provides and compute the gap"; see its 2026-10-09 amendment.
