# US1.2 验收记录：添加历史月收入

语言：**中文（CN）** | [English](US1.2_HISTORICAL_INCOME.md)

- 重新验收日期：2026-09-11
- 状态：完成（4/4 AC）
- 需求来源：[US1.2 - Add historical income](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md#us12---add-historical-income)

## 验收矩阵

| Acceptance Criterion | 状态 | 实现与验收证据 |
|---|---|---|
| AC1.2.1 Access past-month entry | 通过 | v22 Income 卡片提供 `Per month` 与月份/年份选择器；默认最近一个已结束月份，不把尚未结束的当前月提供为历史月总额。 |
| AC1.2.2 Enter a monthly total | 通过 | 历史月份只需一个大于零的整月总额，不要求拆成逐笔收入，也不伪装成某个收入来源；见[历史月总额截图](../../output/playwright/epic-1/evidence/ac1.2.2-3__historical-month-entry.png)。 |
| AC1.2.3 Include past income in analysis | 通过 | 保存一个已结束月份后，权威的 pattern 与 record API 都返回 1 个记录月份。 |
| AC1.2.4 Allow any available history | 通过 | 浏览器和 API 在只有 1 个记录月份时仍可继续，不设置 6 或 12 个月最低限制。 |

## 自动化与浏览器验收

- 当前后端 `finance` 测试：90/90 项通过，包含无来源历史月总额、有限历史、记录月数、当前/未来月份拒绝、重复月份拒绝和月份口径互斥。
- 前端 TypeScript 类型检查通过。
- Playwright 在真实界面选择 `Per month`、选择上一个日历月并保存 RM2,750，再通过真实 API 验证月总额和单月记录。
- 最终浏览器控制台没有产品错误；仅有 Expo Web 关于原生动画驱动不可用的开发环境提示。
- 验收结束后清理本地浏览器验收数据，不把示例历史收入留在开发数据库中。

## 月份口径

- `manual` 表示某月的逐笔收入，必须关联收入来源。
- `historical_total` 表示用户只知道该月总收入，不关联单一收入来源。
- 同一个月份只能采用一种口径：已有逐笔收入时不能再加入整月总额，已有整月总额时也不能再加入逐笔收入。
- 历史月总额只能用于当前月份之前；v22 选择器默认最近一个已结束月份，当前月收入使用按日/周入口。
- 数据库约束确保同一访客、同一月份最多存在一条历史月总额。
