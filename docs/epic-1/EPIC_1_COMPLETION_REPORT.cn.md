# Epic 1 完成报告

语言：**中文（CN）** | [English](EPIC_1_COMPLETION_REPORT.md)

- 重新验收日期：2026-09-11
- 结论：v3 与新版 UI 适配覆盖 8/8 个有效 User Story，61 条可执行 AC 全部通过；AC1.1.8（`Your Data`）按本轮范围明确暂缓。

## 交付总览

| User Story | AC | 结果 | 详细证据 |
|---|---:|---|---|
| US1.1 Record income from different sources | 12 | 11 条通过；AC1.1.8 暂缓 | [验收记录](US1.1_RECORD_INCOME.cn.md) |
| US1.2 Add historical income | 4 | 4/4 通过 | [验收记录](US1.2_HISTORICAL_INCOME.cn.md) |
| US1.3 Record direct work-related costs | 10 | 10/10 通过 | [验收记录](US1.3_WORK_COSTS.cn.md) |
| US1.4 Record regular financial commitments | 6 | 6/6 通过 | [验收记录](US1.4_COMMITMENTS.cn.md) |
| US1.5 Record daily expenses manually | 6 | 6/6 通过 | [验收记录](US1.5_MANUAL_EXPENSES.cn.md) |
| US1.6 Review recorded daily expenses | 6 | 6/6 通过 | [验收记录](US1.6_EXPENSE_REVIEW.cn.md) |
| US1.7 Use a receipt as the starting point | 10 | 10/10 通过 | [验收记录](US1.7_RECEIPT_STARTING_POINT.cn.md) |
| US1.8 Import historical financial records | 8 | 8/8 通过 | [验收记录](US1.8_HISTORICAL_IMPORT.cn.md) |

需求快照保存在 [Epic 1 US/AC Markdown](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md)，已与网盘 v3 和 2026-09-07 迭代 2 补充说明校准。当前基线共 62 条 AC：61 条可执行，AC1.1.8 一条明确暂缓。

## 已形成的正式基线

- Expo/React Native/TypeScript 前端与 Django REST Framework 后端采用 `/api/v1` 契约通信。
- Django session 隔离匿名访客；收入、工作成本、承诺、支出与导入批次均持久化。
- 收入支持普通逐笔、历史月总额和确认后的 CSV 导入三种可追溯来源。
- 支出支持手工录入与收据起点；收据值必须人工确认后才能入库。
- OpenAPI、统一错误结构、迁移、三语界面、逐个 US 验收文档和 Playwright 截图均已归档。

## 最终质量证据

- 2026-09-03 后端整套 `manage.py test`：106 项通过，包含新增 7 项工作成本边界回归。
- `makemigrations --check --dry-run`：无模型/迁移漂移。
- OpenAPI 生成与 `--validate`：通过。
- 前端 `npm run typecheck`：通过。
- 2026-09-11 当前 finance 回归：90/90 项通过。
- 2026-09-11 当前 Epic 1+2 Playwright 验收、迭代补充与 UI 加固回归及 12 个月综合 CSV：24/24 项通过。
- 2026-09-03 完整 `npm run test:e2e -- --reporter=line`：32 项全部通过（2.3 分钟），覆盖现有 Epic 1/2、住房及记录页与新增工作成本故障回归。编号唯一映射检查不能替代此运行结果。
- 财务迁移覆盖 `0001` 至 `0010`；`0010` 新建工作成本逐笔记录，不为旧月度估计猜测业务日期。
- Epic 1 完成后补充了[12 个月网约车司机仿真场景](../testing/SCENARIO_GIG_DRIVER_12M.cn.md)：约 114ms 建立 12 个月、60 笔收入和 240 笔支出，并由真实浏览器验证收入、支出、住房测试和 Epic 5 复用入口。

## 明确边界

- LeanKit 只读核查，未更新任何卡片。本地适配等待负责人验收，目前未提交、未推送。
- 旧版 v1 接口存在破坏性变化，生产发布前须处理版本化和迁移；旧月度估计仅保留供核查。无幂等键时，POST 响应丢失仍须先核对记录，不能盲目重试。详见 [US1.3 核查](US1.3_AUDIT_2026-09-03.cn.md)。

- 收据读取仍是 prototype 起点，不宣称生产级 OCR，也不上传或长期保存原图。
- CSV 是当前历史导入格式。拟议的 US1.9 银行电子账单流程依赖尚未确定的处理器，不属于本轮实施基线。
- 尚无正式用户账户、跨设备同步、数据导出/删除界面或生产数据保留政策。
- Epic 2 已在 2026-09-11 与 Epic 1 同轮重新验收；Epic 5 仍是独立交付范围。

## 推送前结论

Epic 1 的实现、验收和文档已经形成可提交基线。正式推送前仍应由负责人检查工作区差异与产品边界，再决定提交信息和是否直接进入 `main`。
