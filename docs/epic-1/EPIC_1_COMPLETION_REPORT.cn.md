# Epic 1 完成报告

语言：**中文（CN）** | [English](EPIC_1_COMPLETION_REPORT.md)

## 2026-10-08 v7 修复补记

最新验收基线为 v7：Epic 1 共 9 个 User Story、72 条 AC。此前的 13/13 Playwright 运行覆盖当时可执行的前 67 条；日志：[full-final/run.log](../../output/playwright/epic1-supervised/full-final/run.log)，测试产物：[test-results](../../output/playwright/epic1-supervised/full-final/test-results)。本轮按用户确认的 Groq 路径实现 US1.9 五条 AC，并补充定向验收。此前工作还恢复了承诺中的储蓄组，给每日支出和工作成本增加编辑及双向迁移；迁移时保留商户，并应用用户同时编辑的金额和日期。也补齐了逐笔工作成本、月份标签和空字段占位符验收。完整 Epic 1/2 联合回归由主对话负责人完成。

### US1.9 当前实现与边界

v7 修订 1 的 Finory 名称是历史需求背景；用户已确认本项目当前图片读取路径使用 Groq，因此本轮按实际方案实现，不以 Finory 集成作为前提。上传前独立披露文案说明 Groq、处理地区范围、留存例外和当前账户 ZDR 状态；Iteration 2 Security Risk & Privacy Plan 与 Data Management Plan 的代码库补充也记录了这些事实。Groq 推理输入/输出默认不保留，排错或滥用调查可暂存至多 30 天，法律要求可能更久；如保留客户数据则位于美国 GCP，但 DPA 允许在美国及其他运营国家处理，不能称为美国独占处理或承诺零保留。浏览器层尚未验收。

此功能仅识别收入／收益行，模型输出和 API 响应受字段白名单限制，最多 20 条；缺失日期不默认填今天，缺日期或低置信结果默认未选。只有有效且用户选中并确认的行会入账；失败时提示没有保存并提供手工录入。实现和受控测试已添加，但本轮 Playwright 未进入测试阶段：后端 health 返回 200，前端测试服务未就绪后按收敛要求停止。后端 20 项定向单测通过；浏览器 UI 路径仍待运行。没有调用在线 Groq，也没有上传真实财务资料，因此尚无真实账单识别准确率或生产服务可用性证据；功能也不声称解析 PDF、导入所有收支流水。

详见 [US1.9 验收记录](US1.9_BANK_STATEMENT_SCAN.cn.md)、[Security Plan 补充](../privacy/ITERATION_2_SECURITY_RISK_PRIVACY_PLAN.cn.md) 和 [Data Management Plan 补充](../privacy/ITERATION_2_DATA_MANAGEMENT_PLAN.cn.md)。

## v7 当前验收总览

| User Story | AC 数 | 本轮状态 | 证据 |
|---|---:|---|---|
| US1.1 Record income from different sources | 12 | 通过（12/12） | [US1.1 记录](US1.1_RECORD_INCOME.cn.md) |
| US1.2 Add historical income | 4 | 通过（4/4） | [US1.2 记录](US1.2_HISTORICAL_INCOME.cn.md) |
| US1.3 Record direct work-related costs | 13 | 通过（13/13，含编辑和双向迁移） | [US1.3 记录](US1.3_WORK_COSTS.cn.md) |
| US1.4 Record regular financial commitments | 6 | 通过（6/6，含储蓄） | [US1.4 记录](US1.4_COMMITMENTS.cn.md) |
| US1.5 Record daily expenses manually | 8 | 通过（8/8） | [US1.5 记录](US1.5_MANUAL_EXPENSES.cn.md) |
| US1.6 Review recorded daily expenses | 6 | 通过（6/6） | [US1.6 记录](US1.6_EXPENSE_REVIEW.cn.md) |
| US1.7 Use a receipt as the starting point | 10 | 通过（10/10） | [US1.7 记录](US1.7_RECEIPT_STARTING_POINT.cn.md) |
| US1.8 Import historical financial records | 8 | 通过（8/8） | [US1.8 记录](US1.8_HISTORICAL_IMPORT.cn.md) |
| US1.9 Read a bank statement or e-statement into entries | 5 | 已实现；定向后端测试 20/20 通过；浏览器验收未运行 | [US1.9 记录](US1.9_BANK_STATEMENT_SCAN.cn.md) |

追踪检查确认 72 条 AC 均唯一映射、US1.9 不再标记延期。先前 13/13 浏览器套件和 60/60 finance 测试是在本轮 US1.9 实现前运行；本轮类型检查通过，US1.9 定向后端测试 20/20 通过。浏览器服务未启动完成，US1.9 UI 验收未运行。集成方如需最终 Epic 1/2 联合回归，应将其与先前结果分开记录。

## 历史基线（v3，2026-09-11；不代表 v7 结果）

- 重新验收日期：2026-09-11
- 结论：v3 与新版 UI 适配覆盖 8/8 个有效 User Story，61 条可执行 AC 全部通过；AC1.1.8（`Your Data`）按本轮范围明确暂缓。

## 历史交付总览（v3）

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

历史 v3 需求快照保存在 [Epic 1 US/AC Markdown](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md)；当时基线共 62 条 AC：61 条可执行，AC1.1.8 一条明确暂缓。当前正式口径请以上方 v7（72 条）为准。

## 历史实施基线（v3）

- Expo/React Native/TypeScript 前端与 Django REST Framework 后端采用 `/api/v1` 契约通信。
- Django session 隔离匿名访客；收入、工作成本、承诺、支出与导入批次均持久化。
- 收入支持普通逐笔、历史月总额和确认后的 CSV 导入三种可追溯来源。
- 支出支持手工录入与收据起点；收据值必须人工确认后才能入库。
- OpenAPI、统一错误结构、迁移、三语界面、逐个 US 验收文档和 Playwright 截图均已归档。

## 历史质量证据（截至 v3）

- 2026-09-03 后端整套 `manage.py test`：106 项通过，包含新增 7 项工作成本边界回归。
- `makemigrations --check --dry-run`：无模型/迁移漂移。
- OpenAPI 生成与 `--validate`：通过。
- 前端 `npm run typecheck`：通过。
- 2026-09-11 当前 finance 回归：90/90 项通过。
- 2026-09-11 当前 Epic 1+2 Playwright 验收、迭代补充与 UI 加固回归及 12 个月综合 CSV：24/24 项通过。
- 2026-09-03 完整 `npm run test:e2e -- --reporter=line`：32 项全部通过（2.3 分钟），覆盖现有 Epic 1/2、住房及记录页与新增工作成本故障回归。编号唯一映射检查不能替代此运行结果。
- 财务迁移覆盖 `0001` 至 `0010`；`0010` 新建工作成本逐笔记录，不为旧月度估计猜测业务日期。
- Epic 1 完成后补充了[12 个月网约车司机仿真场景](../testing/SCENARIO_GIG_DRIVER_12M.cn.md)：约 114ms 建立 12 个月、60 笔收入和 240 笔支出，并由真实浏览器验证收入、支出、住房测试和 Epic 5 复用入口。

## 历史边界（截至 v3；请以本报告 v7 边界为准）

- LeanKit 只读核查，未更新任何卡片。本地适配等待负责人验收，目前未提交、未推送。
- 旧版 v1 接口存在破坏性变化，生产发布前须处理版本化和迁移；旧月度估计仅保留供核查。无幂等键时，POST 响应丢失仍须先核对记录，不能盲目重试。详见 [US1.3 核查](US1.3_AUDIT_2026-09-03.cn.md)。

- 收据读取仍是 prototype 起点，不宣称生产级 OCR，也不上传或长期保存原图。
- CSV 是当时的历史导入格式；US1.9 在 v7 已成为正式范围。当前实现和验证边界见本报告开头。
- 尚无正式用户账户、跨设备同步、数据导出/删除界面或生产数据保留政策。
- Epic 2 已在 2026-09-11 与 Epic 1 同轮重新验收；Epic 5 仍是独立交付范围。

## 当前 v7 结论

Epic 1 的当前验收范围为 9 个 User Story、72 条 AC，追踪映射均可执行。本轮完成 US1.9 实现并通过定向后端测试，但浏览器验收尚未运行；先前 67 条的完整套件结果早于此变更。最终 Epic 1/2 联合回归由主对话负责人决定；映射检查不能替代运行结果。
