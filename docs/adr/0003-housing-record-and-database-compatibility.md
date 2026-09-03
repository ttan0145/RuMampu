# ADR 0003: Housing record ownership and database compatibility

Language: **English** | [Chinese (CN)](0003-housing-record-and-database-compatibility.cn.md)

- Status: Accepted
- Date: 2026-08-25

## Context

US3.1–US3.3 and a Neon connection were added while Epic 1 and Epic 2 were establishing a session-isolated finance record. The first integration stored every anonymous housing scenario with `user = null`, so unrelated guests could list the same rows. The pre-housing endpoint also recalculated from a client-supplied copy using binary floating point. SQLite fallback existed, but PostgreSQL behaviour was not exercised in CI and a partial `PG*` configuration failed only when a connection was attempted.

## Decision

1. Every `HousingScenario` has exactly one owner: an authenticated user or the same `GuestProfile` used by finance APIs.
2. Existing unowned rows are retained under an inaccessible legacy profile during migration; they are not assigned to a current visitor.
3. Pre-housing checks read income, active work costs, active commitments, and confirmed expenses from the session-owned backend record. They reuse Epic 2's income-pattern service and expose provenance. Legacy request fields remain optional and ignored for v1 source compatibility.
4. Housing services calculate with `Decimal` and round money half-up at response boundaries.
5. `PGHOST` explicitly selects PostgreSQL. Missing credentials, invalid ports, or invalid SSL modes stop startup. TLS defaults to `require` for Neon; empty `PGHOST` selects SQLite.
6. CI runs the complete Django suite on both SQLite and PostgreSQL 16. Real Neon credentials are not stored in the repository or CI.

## Consequences

- Anonymous scenario access is isolated and shares the same session cookie as Epic 1/2.
- A client cannot forge a pre-housing result by submitting different finance values.
- The migration preserves old rows but they require an explicit future ownership-recovery decision.
- PostgreSQL compatibility is continuously tested without coupling CI to one hosted Neon database.
- This decision hardens the existing Epic 3 integration; it does not declare all Epic 3 user stories complete or remove later client-side housing calculations.

## Amendment — 2026-09-03

Under the US1.3 change, the shared finance service now uses dated, same-month work-cost entries. Decision 3's work-cost input follows that service; ownership and database decisions are unchanged. See the dated amendment in ADR 0002 for legacy-data and release boundaries.
