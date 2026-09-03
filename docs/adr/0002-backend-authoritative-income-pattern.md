# ADR 0002: Backend-authoritative income-pattern analysis

Language: **English** | [Chinese (CN)](0002-backend-authoritative-income-pattern.cn.md)

- Status: Accepted
- Date: 2026-08-25

## Context

The first prototype calculated income patterns inside the frontend and included unsupported thresholds. Epic 2 is consumed by later housing and preparation flows, so a client-specific calculation could drift and create contradictory conclusions.

## Decision

1. `GET /api/v1/income-pattern/` is the authoritative calculation boundary.
2. The application service aggregates income by calendar month, subtracts the current active monthly work-cost snapshot once per month, and calculates descriptive statistics with `Decimal`.
3. Population standard deviation is rounded `ROUND_HALF_UP` to two decimals only at the response boundary.
4. The source rows and derived analysis remain separate. Derived analysis is recalculated and is not persisted as a snapshot.
5. Lower-income months are all tied recorded minima when at least two months exist. No fixed threshold, score, prediction, or risk band is produced.
6. `GET/PUT /api/v1/income-coverage/` persists only the current guest's explicit answer. `yes` requires unique months 1–12; `no` and `not_sure` clear the month list.
7. Coverage compares declared month numbers with recorded calendar month numbers. `no` and `not_sure` return a factual recorded-range observation only.
8. Frontend clients use typed responses and explicit loading, ready, saving, error, empty, limited-history, and retry states. A failed save retains the last server-confirmed coverage answer.

## Consequences

- Web, mobile, and future clients share one calculation contract.
- Current work-cost values are intentionally applied to all recorded months until a separate historical-cost requirement is approved.
- Editing income or current work costs changes the next calculated response without data migration or snapshot cleanup.
- Seasonal representativeness remains unknown unless it follows directly from a user's declaration and recorded calendar months.

## Amendment — 2026-09-03

The approved US1.3 implementation replaces the recurring snapshot rule in decision 2: subtract only saved work-cost entries whose business dates belong to the income month and year. Legacy monthly estimates are preserved and exposed read-only but excluded from calculations; no dates are invented. Historical wording above is retained as the decision record. This is a breaking change to the former v1 work-cost contract; versioning and production rollout remain release gates, not covered by local acceptance.
