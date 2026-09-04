# US1.5 验收记录：手动记录日常支出

语言：**中文（CN）** | [English](US1.5_MANUAL_EXPENSES.md)

- 验收日期：2026-08-25
- 状态：完成（6/6 AC）
- 需求来源：[US1.5 - Record daily expenses manually](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md#us15---record-daily-expenses-manually)

## 验收矩阵

| Acceptance Criterion | 状态 | 实现与验收证据 |
|---|---|---|
| AC1.5.1 Enter an expense amount | 通过 | Add expense 表单显示 `Amount (RM)` 输入框并在手机端请求小数键盘；浏览器确认小数金额在保存和展示时保持不变，空值、零和负数仍不可保存。 |
| AC1.5.2 Select an expense category | 通过 | 分类以可选择的 Chip 呈现；真实浏览器分别选择 Groceries 与新建的 Pet supplies 保存支出。 |
| AC1.5.3 Use predefined categories | 通过 | API 为每个访客建立 Meals、Groceries、Tolls & parking、Family、Other 五个预设分类；见[刷新后的表单截图](../../output/playwright/epic-1/evidence/ac1.5.1-5__add-expense-form-after-reload.png)。 |
| AC1.5.4 Add a custom category | 通过 | 通过 `+ Your own category` 新建 `Pet supplies`，自动成为当前分类；刷新后该分类仍显示。 |
| AC1.5.5 Enter expense date | 通过 | 表单接受 `YYYY-MM-DD` 日期并校验真实日历日期；验收分别保存 2026-08-24 与 2026-08-25。 |
| AC1.5.6 Add the expense | 通过 | Groceries RM18.40 与 Pet supplies RM36.60 均通过 API 加入当前访客记录；刷新后列表与 RM55 总额保持，见[记录页截图](../../output/playwright/epic-1/evidence/ac1.5.6__manual-expenses-after-reload.png)。 |

## 自动化与浏览器验收

- 后端 `finance` 测试：38 项通过；US1.5 新增覆盖默认分类、访客隔离、分类分离、自定义分类、正数金额、有效日期、跨访客分类拒绝、重复名称拒绝和整档级联删除。
- 前端 TypeScript 类型检查通过。
- Playwright 真实浏览器验收通过：先验证空金额拦截，再保存一笔预设分类支出和一笔自定义分类支出。
- 页面刷新后，两笔金额、日期、分类、自定义分类和 RM55 月内累计全部保持。
- 最终浏览器控制台没有产品错误；仅有 Expo Web 关于原生动画驱动不可用的开发环境提示。
- 验收结束后清理本地浏览器验收数据，不把示例支出或分类留在开发数据库中。

## 数据口径与边界

- 支出金额使用十进制定点数，必须大于 0；日期必须是有效的 `YYYY-MM-DD` 日历日期。
- 每笔支出属于当前访客的一个有效分类，其他访客的分类 ID 不可使用。
- 当前故事只保存人工录入来源 `manual`；收据来源、用户确认状态和导入批次将在 US1.7/US1.8 中分别定义。
- 编辑、删除、商家和备注不在 US1.5 正式 AC 内；如产品需要，应另立需求。
