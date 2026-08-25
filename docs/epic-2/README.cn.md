# Epic 2 实施与验收索引

语言：[English](README.md) | **中文（CN）**

- 状态：完成并已加固
- 范围：4 个用户故事、18 条验收标准
- 协议：[API Contract](../API_CONTRACT.cn.md) 与 [OpenAPI](../openapi.yaml)
- 决策：[ADR 0002](../adr/0002-backend-authoritative-income-pattern.cn.md)
- 需求快照：[Epic 2 US/AC](../requirements/EPIC_2_USER_STORIES_AND_ACCEPTANCE_CRITERIA.cn.md)

| 用户故事 | 验收 | 证据 |
| --- | ---: | --- |
| [US2.1 — 逐月查看收入](US2.1_MONTH_BY_MONTH.cn.md) | 3/3 | 后端月度聚合与工作成本口径；可访问的横向滚动图；空值、零值、负值、多来源与 12 个月覆盖 |
| [US2.2 — 典型与极端月份](US2.2_TYPICAL_AND_EXTREMES.cn.md) | 6/6 | Decimal 描述统计；计算来源标识；可见范围与有限历史状态 |
| [US2.3 — 较低收入月份](US2.3_LOWER_INCOME.cn.md) | 2/2 | 并列记录最低规则；单月不做比较；不使用无来源阈值 |
| [US2.4 — Coverage 检查](US2.4_COVERAGE_CHECK.cn.md) | 7/7 | 访客隔离持久化；显式确认；已覆盖/未覆盖月份；No/Not sure 的事实性观察 |

## 证据映射

- 领域计算及 coverage 异常数据安全降级：[`analysis_service.py`](../../backend/finance/analysis_service.py)
- 持久化不变量：[`models.py`](../../backend/finance/models.py)、[`validators.py`](../../backend/finance/validators.py) 与 [migration 0009](../../backend/finance/migrations/0009_income_coverage.py)
- Typed 传输边界：[`serializers.py`](../../backend/finance/serializers.py)、[`analysis_views.py`](../../backend/finance/analysis_views.py) 与 [OpenAPI 契约](../openapi.yaml)
- 客户端请求排序与权威状态：[`state.tsx`](../../frontend/src/rumampu/state.tsx)、[`money.tsx`](../../frontend/src/rumampu/screens/money.tsx) 与 [`money.ts`](../../frontend/src/rumampu/money.ts)
- 后端回归证据：[`test_analysis.py`](../../backend/finance/test_analysis.py)
- 真实浏览器证据：[`epic2.spec.ts`](../../frontend/e2e/epic2.spec.ts) 与 [稳定截图](../../output/playwright/epic-2/evidence/)
- 可重复仓库门槛：[GitHub Actions quality workflow](../../.github/workflows/quality.yml)

## 自动化验收

- Django finance 全套：80 项通过，其中 22 项为 Epic 2 专项 service/API/model 测试。
- TypeScript：`npm run typecheck` 通过。
- Playwright：`npm run test:e2e:epic2` 的 6 条流程全部通过，覆盖 12 个月场景、有效 bar 几何、零值/负值有限历史、持久化、初始请求去重与交互锁定、coverage 保存失败与重试、空记录、API 失败及重试。
- migration drift：无变化。
- OpenAPI 生成与校验：通过。

本轮加固删除了 Epic 2 的 JavaScript fallback 算法，将后端 API 连接模式设为正式默认，拒绝过期 coverage 响应，在 PUT 失败后保留未保存草稿，并为辅助技术明确暴露选择状态。派生金额响应也可容纳超过单笔记录上限的聚合值。

稳定浏览器证据输出到 `output/playwright/epic-2/evidence/`。开发专用场景继续排除在公开 OpenAPI 之外。

## 已批准边界

- 收入预测、趋势建议、住房 shortfall、风险评分、离线同步和自动重试均不在范围内。
- 在历史成本版本另立需求前，当前有效月度工作成本快照应用于每个记录月。
- 只持久化用户明确回答；派生分析从源记录实时重算。
