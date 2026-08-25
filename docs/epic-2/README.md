# Epic 2 implementation and acceptance index

Language: **English** | [Chinese (CN)](README.cn.md)

- Status: Complete and hardened
- Scope: 4 user stories, 18 acceptance criteria
- Contract: [API contract](../API_CONTRACT.md) and [OpenAPI](../openapi.yaml)
- Decision: [ADR 0002](../adr/0002-backend-authoritative-income-pattern.md)
- Requirement snapshot: [Epic 2 US/AC](../requirements/EPIC_2_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md)

| User story | Acceptance | Evidence |
| --- | ---: | --- |
| [US2.1 — View income month by month](US2.1_MONTH_BY_MONTH.md) | 3/3 | Backend monthly aggregation and work-cost basis; accessible horizontally scrolling chart; empty, zero, negative, multi-source, and 12-month coverage |
| [US2.2 — Typical and extreme months](US2.2_TYPICAL_AND_EXTREMES.md) | 6/6 | Decimal descriptive statistics; calculated provenance; visible range and limited-history states |
| [US2.3 — Lower-income months](US2.3_LOWER_INCOME.md) | 2/2 | Tied recorded-minimum rule; no one-month comparison; boundary explanation without unsupported thresholds |
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

- Django finance suite: 80 tests passed, including 22 dedicated Epic 2 service/API/model tests.
- TypeScript: `npm run typecheck` passed.
- Playwright: all 6 `npm run test:e2e:epic2` flows passed, covering the 12-month scenario, meaningful bar geometry, limited zero/negative history, persistence, initial-request de-duplication and locking, coverage save failure with retry, empty data, API failure, and retry.
- Migration drift: no changes detected.
- OpenAPI generation and validation: passed.

Hardening removed the Epic 2 JavaScript fallback algorithm, made connected API mode the formal default, rejects stale coverage responses, preserves unsaved drafts after failed PUTs, and makes selection state explicit to assistive technology. Derived monetary response fields also accept aggregates larger than one stored entry.

Stable browser evidence is produced under `output/playwright/epic-2/evidence/`. The development-only scenario remains excluded from the public OpenAPI contract.

## Approved boundaries

- Income prediction, trend recommendations, housing shortfall, risk scoring, offline synchronisation, and automatic retries remain out of scope.
- The current active monthly work-cost snapshot applies to every recorded month until historical cost versioning has its own requirement.
- Only the explicit coverage answer is persisted; derived analysis is recalculated from source records.
