# US1.1 验收记录：记录不同来源的收入

验收日期：2026-08-24  
状态：完成（10/10 AC）  
需求来源：[US1.1 - Record income from different sources](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md#us11---record-income-from-different-sources)

## 验收矩阵

| Acceptance Criterion | 状态 | 实现与验收证据 |
|---|---|---|
| AC1.1.1 Enter income amount | 通过 | Income 表单提供 RM 金额输入；真实浏览器完成录入和保存。 |
| AC1.1.2 Enter income date | 通过 | 表单接受 `YYYY-MM-DD` 日期；前后端均校验真实日历日期。 |
| AC1.1.3 Select an income source | 通过 | 真实浏览器确认可选 E-hailing、Freelance、Part-time (fixed)，也可进入自定义来源流程。 |
| AC1.1.4 Use multiple income sources | 通过 | 自动化测试确认不同记录分别保留日期、金额和来源；浏览器使用三个不同来源保存记录。 |
| AC1.1.5 Add a custom income source | 通过 | 创建并使用 `Weekend market` 自定义来源；见[自定义来源记录截图](../../output/playwright/us1.1/custom-source-entry.png)。 |
| AC1.1.6 Save an income entry | 通过 | `POST /api/v1/income/entries/` 持久化有效记录；页面保存后刷新仍能读取同一访客会话的数据。 |
| AC1.1.7 Display existing entries | 通过 | Income 页面显示全部已有记录的日期、来源和金额；见[保存并重载后的记录截图](../../output/playwright/us1.1/outlier-kept.png)。 |
| AC1.1.8 Identify user-entered values | 通过 | 所有手工录入值均显示 `YOUR DATA` 标记；上述两张记录截图均可见。 |
| AC1.1.9 Prevent negative income entry | 通过 | 输入 `-10` 时显示警告且不保存；见[负数警告截图](../../output/playwright/us1.1/negative-warning.png)，API 同时拒绝非正数。 |
| AC1.1.10 Warn about an unusually high income entry | 通过 | 以 RM100、RM120、RM140 建立基线后，RM1000 先返回确认要求；界面显示 Keep，确认后才保存。见[异常值警告截图](../../output/playwright/us1.1/outlier-warning.png)及[确认保存截图](../../output/playwright/us1.1/outlier-kept.png)。 |

## 自动化与浏览器验收

- 后端 `finance` 测试：16 项通过，覆盖访客隔离、默认/自定义来源、跨来源记录、金额与日期验证、异常值确认、历史总额边界、API 版本和 OpenAPI 页面。
- 前端 TypeScript 类型检查通过。
- Playwright 真实浏览器验收通过：保存 4 条记录、刷新页面并重新进入 Income 后，记录仍通过同一访客会话持久存在。
- 最终页面控制台没有产品代码错误；仅有 Expo Web 关于原生动画驱动不可用的开发环境提示。
- 验收结束后已清理本地浏览器验收数据，不把示例收入留在开发数据库中。

## 边界说明

- 官方 US1.1 没有要求编辑或删除收入记录，因此它们不属于本故事的完成条件；如需增加，应单独建立需求和 AC。
- 当前身份边界是匿名访客会话隔离，不等同于生产级账户、登录或跨设备同步。
- 异常高收入仅在至少有 3 条手工收入记录后，以现有手工记录中位数的 3 倍作为提示阈值；历史月总额不会污染该比较基线。

