# US1.6 验收记录：回顾已记录的日常支出

语言：**中文（CN）** | [English](US1.6_EXPENSE_REVIEW.md)

- 验收日期：2026-08-25
- 状态：完成（6/6 AC）
- 需求来源：[US1.6 - Review recorded daily expenses](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md#us16---review-recorded-daily-expenses)

## 验收矩阵

| Acceptance Criterion | 状态 | 实现与验收证据 |
|---|---|---|
| AC1.6.1 Display current monthly spending | 通过 | 最新记录月份为 2026-08，页面只汇总该月 RM18.40 与 RM36.60，显示 `Aug so far · RM55`；2026-07 的 RM10 不混入当前月。 |
| AC1.6.2 Display recorded days | 通过 | 两笔 8 月支出分别在 24 日、25 日，页面显示 `2 days recorded`；见[最新月份回顾截图](../../output/playwright/us1.6/latest-month-review.png)。 |
| AC1.6.3 Display individual expenses | 通过 | 最新月份的全部相关条目按日期倒序展示：25 Aug · Meals · RM36.60 与 24 Aug · Groceries · RM18.40。 |
| AC1.6.4 Access manual expense entry | 通过 | 选择 `Add expense` 后进入包含 Amount、Category、Date 的手动录入页面，再通过 Back 返回。 |
| AC1.6.5 Access receipt-entry flow | 通过 | 选择 `Scan a receipt` 后进入收据预览流程，并显示 `Use a sample receipt` 起点，再通过 Back 返回。 |
| AC1.6.6 Access monthly expense summary | 通过 | 选择 `Monthly summary` 后显示 Aug 2026 · RM55 · 2 days 与 Jul 2026 · RM10 · 1 day；见[月度汇总截图](../../output/playwright/us1.6/monthly-summary.png)。 |

## 自动化与浏览器验收

- 后端 `finance` 测试：40 项通过；US1.6 增加支出读取顺序与跨访客读取隔离覆盖。
- 前端 TypeScript 类型检查通过。
- Playwright 真实浏览器使用同一访客 session 准备 7 月和 8 月数据，验证最新月份总额、记录天数、条目列表和三个导航入口。
- 月度汇总同时显示两个记录月份，并对未完整记录的月份保留明确说明；单日/多日文案正确处理单复数。
- 窄屏视觉检查发现并修复了长说明与金额来源标记的横向溢出，最终截图无截断。
- 最终浏览器控制台没有产品错误；仅有 Expo Web 关于原生动画驱动不可用的开发环境提示。
- 验收结束后清理本地浏览器验收数据。

## 展示口径与边界

- “当前月”指最新一笔已记录支出所属月份，而不是强制使用设备当前月份。
- Daily expenses 首页只展示该最新月份的总额、不同记录日数量和全部相关条目；历史月份通过 Monthly summary 查看。
- “记录天数”按存在至少一笔支出的不同自然日去重，不等于支出笔数。
- 进入收据流程属于 US1.6 的范围；收据读取、确认与保存的正式验收属于 US1.7。
