# ADR 0001: Modular monolith and versioned API baseline

Language: **English** | [Chinese (CN)](0001-foundation-and-api-contract.cn.md)

- Status: accepted
- Date: 2026-08-24

## Context

The existing Expo prototype covered screens from several Epics, while the backend supported only the first income flow. Continuing screen by screen would allow income, costs, commitments, expenses, and preparation features to develop inconsistent rules for money, errors, identity, and versioning.

## Decision

1. Use an Expo frontend with a Django modular monolith; do not introduce microservices prematurely.
2. Version production business APIs under `/api/v1/`.
3. Generate and validate an OpenAPI 3 schema from code with drf-spectacular.
4. Return successful resources directly and use `{ "error": { "code", "message", ... } }` consistently for errors.
5. Store monetary values as `Decimal`, expose two-decimal strings through the API, and use ISO dates.
6. Use Django sessions for the current guest boundary. Accounts are deferred, but domain data always belongs to a profile.
7. Retain initial prototype paths temporarily as compatibility aliases while excluding them from the public schema.

## Consequences

- Later Epic 1, 2, and 5 interfaces follow the same contract.
- The frontend branches on stable error codes, never English error text.
- API changes require aligned tests, schema validation, and documentation.
- Guest sessions fit the current validation stage, but production still requires policies for retention, cross-device migration, CSRF/cookies, and account upgrades.
- The modular monolith reduces early operational cost. A future ADR may reassess service extraction if independent scaling or deployment becomes necessary.
