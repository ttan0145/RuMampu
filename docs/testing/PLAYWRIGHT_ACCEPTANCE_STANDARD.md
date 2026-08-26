# Playwright acceptance-test standard

Language: **English** | [Chinese (CN)](PLAYWRIGHT_ACCEPTANCE_STANDARD.cn.md)

## Purpose

This standard makes browser acceptance results traceable from an Epic to a user story (US) and then to every acceptance criterion (AC). It applies to completed work declared ready for team cross-testing.

## Required structure

```text
test.describe("Epic N — name", { tag: "@epicN" })
  test("USN.N — name", { tag: "@usN.N" })
    ac("ACN.N.N", "criterion title", async () => { ... })
```

- One spec file owns one Epic: `frontend/e2e/epicN.spec.ts`.
- Each formal US has at least one independently named Playwright test.
- Each AC appears exactly once as an `ac(...)` step using its formal identifier.
- Several closely related ACs may share a browser scenario. Creating one test per AC is not required.
- Engineering regressions that are not formal criteria use `TECH-EN-NN` titles and the `@hardening` tag. They must not invent AC identifiers.
- Test and step titles are English because English is the project's primary delivery language.

The HTML report therefore expands as `Epic → US → AC`, while the number of browser contexts remains proportionate to real user journeys.

## What belongs in Playwright

Playwright proves user-observable behaviour and important client/server integration: navigation, form validation, explicit confirmation, accessible chart state, persistence after refresh, failure recovery, and routing based on authoritative API responses.

Backend tests remain authoritative for exhaustive permutations, monetary rounding, database constraints, service invariants, guest isolation, and validation branches that do not require a browser. An AC may be supported by both layers, but Playwright must assert its observable outcome when that outcome exists in the UI.

## Stable test design

- Use role, accessible name, visible label, or `data-testid` selectors. Avoid CSS tied to visual layout.
- Create test records through public UI or versioned API contracts. Development scenario endpoints may be used only for explicitly documented fixtures.
- Each test receives an isolated browser context and guest session. Do not depend on a previous test.
- Keep workers at one while the local acceptance server uses a shared SQLite database.
- Stub failures only at the network boundary and assert a bounded, recoverable UI state.
- Place reusable helpers in `frontend/e2e/support` and static fixture data in `frontend/e2e/fixtures`.

## Traceability gate

`npm run test:e2e:traceability` compares the formal requirement snapshots with literal `ac(...)` registrations. It fails on a missing, unknown, or duplicated AC. Completed Epics are registered in `frontend/scripts/check-e2e-traceability.mjs`.

Current registered baseline:

| Epic | US scenarios | Formal AC mapping |
| --- | ---: | ---: |
| Epic 1 | 8 | 56/56 |
| Epic 2 | 4 | 18/18 |

Other Epic specs remain executable regression coverage, but must not be declared AC-complete under this standard until their formal requirement snapshot and exact mapping are registered.

## Commands

Run from `frontend`:

```powershell
npm run test:e2e:traceability
npm run test:e2e:epic1
npm run test:e2e:epic2
npm run test:e2e:acceptance
npm run test:e2e
```

`test:e2e:acceptance` runs the completed Epic 1 and Epic 2 acceptance suites. `test:e2e` runs traceability and every browser spec in the repository. CI uses the latter.

## Reports and evidence

- Ephemeral HTML report: `output/playwright/report/`
- Failure traces and screenshots: `output/playwright/test-results/`
- Reviewed evidence: `output/playwright/epic-N/evidence/`

Reports and failure artefacts are ignored by Git. A normal test run never rewrites reviewed evidence. To refresh evidence deliberately, set `UPDATE_EVIDENCE=1`, run the relevant Epic, review the images, and commit them only with approval.

## Completion rule

An Epic can be described as Playwright acceptance-complete only when:

1. its English requirement snapshot is authoritative and its AC count is fixed;
2. every US has an executable scenario and every AC is mapped exactly once;
3. traceability, TypeScript, and the Epic Playwright suite pass;
4. relevant backend tests cover non-visual business rules;
5. evidence and documentation are reviewed without stale links or unsupported completion claims.
