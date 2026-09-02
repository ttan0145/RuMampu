# US1.2 验收记录：添加历史月收入

语言：**中文（CN）** | [English](US1.2_HISTORICAL_INCOME.md)

- 验收日期：2026-08-25
- 状态：完成（4/4 AC）
- 需求来源：[US1.2 - Add historical income](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md#us12---add-historical-income)

## 验收矩阵

| Acceptance Criterion | 状态 | 实现与验收证据 |
|---|---|---|
| AC1.2.1 Access past-month entry | 通过 | Income 页面提供 `Add a past month` 入口；弹层可直接输入任意有效的历史 `YYYY-MM` 月份，见[重复月份保护截图中的完整弹层](../../output/playwright/epic-1/evidence/ac1.2.1-2__duplicate-month-warning.png)。 |
| AC1.2.2 Enter a monthly total | 通过 | 历史月份只需一个大于零的整月总额，不要求拆成逐笔收入，也不伪装成某个收入来源；见[历史月总额截图](../../output/playwright/epic-1/evidence/ac1.2.2-3__historical-month-entry.png)。 |
| AC1.2.3 Include past income in analysis | 通过 | 保存 2019-01 后，首页记录月数从 0 变为 1；刷新页面后同一访客会话仍显示 1 个月，见[单月记录截图](../../output/playwright/epic-1/evidence/ac1.2.3-4__one-month-record.png)。API record 同时返回 `recorded_month_count`。 |
| AC1.2.4 Allow any available history | 通过 | 界面明确说明不要求至少 6 或 12 个月；真实浏览器仅添加 1 个历史月份即可继续，自动化测试也接受 2019-01 这一远期历史月份。 |

## 自动化与浏览器验收

- 后端 `finance` 测试：20 项通过；US1.2 新增覆盖无来源的历史月总额、任意少量历史、记录月数、当前/未来月份拒绝、重复月份拒绝和月份口径互斥。
- 前端 TypeScript 类型检查通过。
- Playwright 真实浏览器验收通过：从空记录添加 RM2,750 的 2019-01 整月总额，刷新后仍为 1 个记录月份。
- 重复提交 2019-01 时，界面显示 `That month already has income records. Choose another month.`，不会重复累计。
- 最终浏览器控制台没有产品错误；仅有 Expo Web 关于原生动画驱动不可用的开发环境提示。
- 验收结束后清理本地浏览器验收数据，不把示例历史收入留在开发数据库中。

## 月份口径

- `manual` 表示某月的逐笔收入，必须关联收入来源。
- `historical_total` 表示用户只知道该月总收入，不关联单一收入来源。
- 同一个月份只能采用一种口径：已有逐笔收入时不能再加入整月总额，已有整月总额时也不能再加入逐笔收入。
- 历史月总额只能用于当前月份之前的月份；当前月继续使用逐笔收入入口。
- 数据库约束确保同一访客、同一月份最多存在一条历史月总额。
