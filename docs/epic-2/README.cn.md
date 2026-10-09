# Epic 2 实施与验收索引

语言：[English](README.md) | **中文（CN）**

- 状态：完成并已加固
- 范围：4 个用户故事、21 条验收标准
- 协议：[API Contract](../API_CONTRACT.cn.md) 与 [OpenAPI](../openapi.yaml)
- 决策：[ADR 0002](../adr/0002-backend-authoritative-income-pattern.cn.md)
- 需求快照：[Epic 2 US/AC](../requirements/EPIC_2_USER_STORIES_AND_ACCEPTANCE_CRITERIA.cn.md)

| 用户故事 | 验收 | 证据 |
| --- | ---: | --- |
| [US2.1 — 逐月查看收入](US2.1_MONTH_BY_MONTH.cn.md) | 3/3 | 展示最新已结束月份；带标签、可横向滚动的图表；本月单独显示 |
| [US2.2 — 典型与极端月份](US2.2_TYPICAL_AND_EXTREMES.cn.md) | 8/8 | 仅按已结束月份计算 Decimal 统计；独立显示记录范围；图表可滚动查看所有月份 |
| [US2.3 — 较低收入月份](US2.3_LOWER_INCOME.cn.md) | 3/3 | 已结束月份并列最低规则；未完成月份不计入淡季和住房测试；单独显示本月至今 |
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

- Django finance 全套：151 项通过，包含已结束月份统计、未完成月份隔离、Coverage 和助手上下文的回归测试。
- TypeScript：`npm run typecheck` 通过。
- Playwright：`npm run test:e2e:epic2` 覆盖当前全部 21 条验收标准，包括已结束月份统计、本月至今分离、图表滚动、本月 Coverage 和住房预检查。
- migration drift：无变化。
- OpenAPI 已重新生成；drf-spectacular 对共享 API 输出了 serializer 推断警告和 operationId 冲突，集成后需重新校验。

本轮加固删除了 Epic 2 的 JavaScript fallback 算法，将后端 API 连接模式设为正式默认，拒绝过期 coverage 响应，在 PUT 失败后保留未保存草稿，并为辅助技术明确暴露选择状态。派生金额响应也可容纳超过单笔记录上限的聚合值。

稳定浏览器证据输出到 `output/playwright/epic-2/evidence/`。开发专用场景继续排除在公开 OpenAPI 之外。

## 已批准边界

- 收入预测、趋势建议、住房 shortfall、风险评分、离线同步和自动重试均不在范围内。
- 每个记录月只使用同一月份带日期的工作成本记录；一笔工作成本不会成为重复月度扣除。
- 只持久化用户明确回答；派生分析从源记录实时重算。
