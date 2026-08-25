# Epic 1、2、5 实施矩阵

语言：**中文（CN）** | [English](EPIC_1_2_5_IMPLEMENTATION_MATRIX.md)

更新时间：2026-08-25

本文件以最新项目边界为约束，区分真实后端能力、仅前端原型和尚未实现内容。`Built` 只用于已经有可执行代码和验收证据的功能。

## Foundation

2026-08-24 已完成正式开发基线：模块化单体结构、`/api/v1`、统一错误格式、金额/日期类型约定、OpenAPI schema、Swagger/ReDoc、前端集中 API 客户端和提交前质量门槛。旧 `/api` 路径仅作临时兼容，不用于后续开发。另有默认关闭、从公开 OpenAPI 排除的 [12 个月网约车司机测试场景](testing/SCENARIO_GIG_DRIVER_12M.cn.md)，作为 Epic 1/2/5 共用的确定性回归输入。

## Epic 1 - Income Builder

| User Story | 当前状态 | 代码/证据 | 下一步 |
|---|---|---|---|
| US1.1 Record income from different sources | 完成（10/10 AC） | Income UI；`finance` 收入来源/记录 API；16 项后端回归中的相关测试；Playwright 真实浏览器验收与刷新持久化；[验收记录](epic-1/US1.1_RECORD_INCOME.cn.md) | 无；编辑/删除不在正式 US1.1 AC 内，如需要应另立需求 |
| US1.2 Add historical income | 完成（4/4 AC） | 任意历史月份输入；无最低月数；`historical_total` 与逐笔收入互斥；记录月数；刷新持久化；[验收记录](epic-1/US1.2_HISTORICAL_INCOME.cn.md) | 无 |
| US1.3 Record direct work-related costs | 完成（6/6 AC） | 默认/自定义成本 API；独立金额更新；收入扣除成本计算；刷新持久化；[验收记录](epic-1/US1.3_WORK_COSTS.cn.md) | 无；历史成本版本或来源归属不在当前 AC 内 |
| US1.4 Record regular commitments | 完成（6/6 AC） | living/debt/savings 分组 API；独立金额更新；总承诺计算；刷新持久化；[验收记录](epic-1/US1.4_COMMITMENTS.cn.md) | 无；购房情景中的 rent 处理不改变原始承诺，应在对应情景需求中定义 |
| US1.5 Record daily expenses | 完成（6/6 AC） | 默认/自定义 ExpenseCategory API；正数金额与日历日期验证；ExpenseEntry API；刷新持久化；[验收记录](epic-1/US1.5_MANUAL_EXPENSES.cn.md) | 无；编辑/删除不在当前 AC 内 |
| US1.6 Review daily expenses | 完成（6/6 AC） | 最新记录月份总额/天数/全部条目；手动/收据/月度汇总入口；跨月汇总；真实 API 与访客隔离；[验收记录](epic-1/US1.6_EXPENSE_REVIEW.cn.md) | 无；20 天完整规则沿用既有产品说明，不改变本故事的“已记录多少”事实 |
| US1.7 Receipt starting point | 完成（10/10 AC） | 拍照/选图；可见读取态；receipt 来源标记；可编辑确认；Retake；确认后 API 持久化；[验收记录](epic-1/US1.7_RECEIPT_STARTING_POINT.cn.md) | 生产级 OCR 与原图存储不在 prototype AC 内，应在隐私政策明确后另立工作包 |
| US1.8 Historical import | 完成（8/8 AC） | UTF-8 CSV 上传；金额/日期/来源逐行预览；错误行标识；显式确认后事务入库；有限历史与分析联动；[验收记录](epic-1/US1.8_HISTORICAL_IMPORT.cn.md) | 无；其他文件格式和银行专属模板应另立需求 |

### 第一闭环的数据边界

- 访客通过 Django session 隔离，不要求先注册账号。
- 每个访客拥有自己的默认/自定义 IncomeSource、FinancialPeriod 和 IncomeEntry。
- 历史月总额与普通交易通过 `entry_method` 区分。
- 确认后的导入记录使用 `entry_method=import`，导入批次和逐行结果保留审计关系；预览不创建收入事实。
- 只有用户确认后才保存异常高的普通收入记录。
- 当前没有生产级身份认证、跨设备同步、导出或删除。

## Epic 2 - Income Pattern Analysis

| User Story | 当前状态 | 主要缺口 |
|---|---|---|
| US2.1 Month-by-month view | 前端已计算和绘图 | 缺纯函数测试；空记录页面需专门处理 |
| US2.2 Typical and extreme months | 前端有均值、中位数、最高、最低 | 需定义记录不足时显示什么，不能输出 `Infinity` 或假精度 |
| US2.3 Lower-income months | 与最新边界冲突 | 代码仍使用低于平均值 75% 的旧规则，必须移除 |
| US2.4 Coverage check | 前端原型 | `12%` 窄幅判断也是无来源阈值，需要改为无标签、可解释的记录覆盖描述 |

Epic 2 必须等 Epic 1 的真实收入数据稳定后收敛。最新边界禁止 75% 规则、CV 和 Low/Moderate/High 风险带。

## Epic 5 - Homeownership Preparation

| User Story | 当前状态 | 主要缺口 |
|---|---|---|
| US5.1 Review upfront purchase cash | 前端 mock 计算 | 金额来源、日期和可编辑假设未持久化 |
| US5.2 Compare cash on hand with upfront need | 前端原型 | 储蓄快照尚未接 API |
| US5.3 Review cash buffer | 已有纯计算和页面 | 需要基于修正后的 rent/commitment 规则补测试 |
| US5.4 Documents & financing | 前端清单原型 | 清单状态未持久化；SJKP 规则和来源日期需重新核验 |

Epic 5 的官方规则只能用于准备清单与信息展示，不能输出审批、资格或可负担结论。

## 推荐实施顺序

1. Foundation 框架与 API 契约 - 本包已完成。
2. E1.1 收入来源与收入记录闭环 - 已按 10/10 AC 完成。
3. E1.2 历史月收入 - 已按 4/4 AC 完成，并明确与逐笔收入的月份口径。
4. E1.3 工作成本持久化 - 已按 6/6 AC 完成。
5. E1.4 固定承诺持久化 - 已按 6/6 AC 完成；购房情景的 rent 规则留给对应情景需求。
6. E1.5/E1.6 日常支出录入与回顾 - 已分别按 6/6 AC 完成。
7. E1.7 收据起点流程 - 已按 10/10 AC 完成，并将真实 OCR 与人工确认边界分离。
8. E1.8 历史 CSV 导入 - 已按 8/8 AC 完成预览、错误行、确认入库及分析联动。
9. E2 移除旧阈值并为所有纯计算补边界测试。
10. E5 先实现储蓄、前期费用和清单持久化，再接已核验官方规则。
