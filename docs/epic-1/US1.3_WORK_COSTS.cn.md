# US1.3 验收记录：记录直接工作成本

语言：**中文（CN）** | [English](US1.3_WORK_COSTS.md)

- 验收日期：2026-08-25
- 状态：完成（6/6 AC）
- 需求来源：[US1.3 - Record direct work-related costs](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md#us13---record-direct-work-related-costs)

## 验收矩阵

| Acceptance Criterion | 状态 | 实现与验收证据 |
|---|---|---|
| AC1.3.1 View work-cost categories | 通过 | Work costs 页面从 API 加载 Petrol、Servicing、Platform fees、Phone data、Road tax & insurance 五个默认项目。 |
| AC1.3.2 Edit work-cost amounts | 通过 | 真实浏览器把 Petrol 改为 RM400、Servicing 改为 RM100；离开输入框时通过 `PATCH /api/v1/work-costs/{id}/` 持久化。 |
| AC1.3.3 Record different work costs separately | 通过 | 每项成本拥有独立资源、金额输入和 `YOUR DATA` 标记，更新一项不会覆盖其他项。 |
| AC1.3.4 Add my own work cost | 通过 | 创建 `Equipment rental` 自定义项目并保存 RM200，刷新后仍作为第六项显示。 |
| AC1.3.5 Show income after work costs | 通过 | 月收入 RM3,000 减去 RM700 工作成本后，页面显示 `Income after work costs RM 2,300`。 |
| AC1.3.6 Identify calculated income | 通过 | 结果旁显示 `CALCULATED` 来源标记；见[刷新后的完整工作成本截图](../../output/playwright/us1.3/work-costs-after-reload.png)。 |

## 自动化与浏览器验收

- 后端 `finance` 测试：25 项通过；US1.3 新增覆盖默认项目、项目分离、金额更新、自定义项目、负数/重复拒绝、跨访客修改拒绝和 OpenAPI 路径。
- 前端 TypeScript 类型检查通过。
- Playwright 真实浏览器验收通过：编辑两个默认项目、增加一个自定义项目，并验证 RM3,000 − RM700 = RM2,300。
- 刷新页面后，RM400、RM100、RM200、自定义名称和 RM2,300 计算结果全部保持。
- 最终浏览器控制台没有产品错误；仅有 Expo Web 关于原生动画驱动不可用的开发环境提示。
- 验收结束后清理本地浏览器验收数据，不把示例收入或成本留在开发数据库中。

## 计算口径

- 工作成本金额表示每月直接工作成本，允许为 0，不允许为负数。
- 每个记录月份的 `income after work costs` 等于该月收入总额减去当前全部工作成本项目之和。
- 多个月份页面显示这些月度结果的平均值，并明确标记为计算值；原始收入与工作成本仍各自保留为用户数据。
- 当前故事不包含按收入来源或按月份保存不同成本版本；如产品需要历史成本变化，应另立带生效月份的需求。
