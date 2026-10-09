# Epic 2 implementation and acceptance index

Language: **English** | [Chinese (CN)](README.cn.md)

- Status: Complete and hardened
- Scope: 4 user stories, 21 acceptance criteria
- Contract: [API contract](../API_CONTRACT.md) and [OpenAPI](../openapi.yaml)
- Decision: [ADR 0002](../adr/0002-backend-authoritative-income-pattern.md)
- Requirement snapshot: [Epic 2 US/AC](../requirements/EPIC_2_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md)

| User story | Acceptance | Evidence |
| --- | ---: | --- |
| [US2.1 — View income month by month](US2.1_MONTH_BY_MONTH.md) | 3/3 | Latest saved completed months; labelled, horizontally scrollable chart; current month kept separate |
| [US2.2 — Typical and extreme months](US2.2_TYPICAL_AND_EXTREMES.md) | 8/8 | Completed-month Decimal statistics; distinct range row; all chart months reachable with a visible scroll hint |
| [US2.3 — Lower-income months](US2.3_LOWER_INCOME.md) | 3/3 | Tied completed-month minimum; unfinished month excluded from quiet and housing counts; month-so-far display |
| [US2.4 — Coverage check](US2.4_COVERAGE_CHECK.md) | 7/7 | Guest-isolated persistence; explicit confirmation; represented/unrepresented months; factual No/Not sure observation |

## Evidence map

- Domain calculations and fail-safe coverage reads: [`analysis_service.py`](../../backend/finance/analysis_service.py)
- Persistence invariants: [`models.py`](../../backend/finance/models.py), [`validators.py`](../../backend/finance/validators.py), and [migration 0009](../../backend/finance/migrations/0009_income_coverage.py)
- Typed transport boundary: [`serializers.py`](../../backend/finance/serializers.py), [`analysis_views.py`](../../backend/finance/analysis_views.py), and the [OpenAPI contract](../openapi.yaml)
- Client request sequencing and authoritative state: [`state.tsx`](../../frontend/src/rumampu/state.tsx), [`money.tsx`](../../frontend/src/rumampu/screens/money.tsx), and [`money.ts`](../../frontend/src/rumampu/money.ts)
- Backend regression evidence: [`test_analysis.py`](../../backend/finance/test_analysis.py)
- Real-browser evidence: [`epic2.spec.ts`](../../frontend/e2e/epic2.spec.ts) and [stable screenshots](../../output/playwright/epic-2/evidence/)
- Repeatable repository gates: [GitHub Actions quality workflow](../../.github/workflows/quality.yml)

## Automated acceptance

- Django finance suite: 151 tests passed, including regressions for completed-month statistics, unfinished-month separation, coverage, and assistant context.
- TypeScript: `npm run typecheck` passed.
- Playwright: `npm run test:e2e:epic2` covers all 21 current acceptance criteria, including completed-month statistics, month-so-far separation, chart scrolling, current-month coverage, and the housing pre-check.
- Migration drift: no changes detected.
- OpenAPI regenerated; drf-spectacular reported serializer-inference warnings and operationId collisions in the shared API surface, so rerun schema validation after integration.

Hardening removed the Epic 2 JavaScript fallback algorithm, made connected API mode the formal default, rejects stale coverage responses, preserves unsaved drafts after failed PUTs, and makes selection state explicit to assistive technology. Derived monetary response fields also accept aggregates larger than one stored entry.

Stable browser evidence is produced under `output/playwright/epic-2/evidence/`. The development-only scenario remains excluded from the public OpenAPI contract.

## Approved boundaries

- Income prediction, trend recommendations, housing shortfall, risk scoring, offline synchronisation, and automatic retries remain out of scope.
- Each recorded month uses only the dated work-cost entries recorded in that same month; a work-cost entry is never reused as a recurring deduction.
- Only the explicit coverage answer is persisted; derived analysis is recalculated from source records.
