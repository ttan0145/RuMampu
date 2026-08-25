# US1.4 验收记录：记录固定财务承诺

语言：**中文（CN）** | [English](US1.4_COMMITMENTS.md)

- 验收日期：2026-08-25
- 状态：完成（6/6 AC）
- 需求来源：[US1.4 - Record regular financial commitments](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md#us14---record-regular-financial-commitments)

## 验收矩阵

| Acceptance Criterion | 状态 | 实现与验收证据 |
|---|---|---|
| AC1.4.1 Record regular living costs | 通过 | Commitments 页面从 API 加载 Rent、Food、Utilities、Family support，并把 Rent 保存为 RM700。 |
| AC1.4.2 Record debt repayments | 通过 | Debt repayments 分组独立显示 Motor loan 与 PTPTN，并把 Motor loan 保存为 RM420。 |
| AC1.4.3 Record savings contributions | 通过 | Savings 分组显示 Monthly savings，并把金额保存为 RM100。 |
| AC1.4.4 Separate commitment groups visually | 通过 | Living costs、Debt repayments、Savings 使用三个有标题的独立视觉分区；见[刷新后的承诺页面截图](../../output/playwright/us1.4/commitments-after-reload.png)。 |
| AC1.4.5 Show total commitments | 通过 | 页面将三组有效项目汇总为 `Total commitments RM 1,220`，计算为 RM700 + RM420 + RM100。 |
| AC1.4.6 Identify calculated total | 通过 | 总额旁显示 `CALCULATED` 来源标记；各输入项仍显示 `YOUR DATA`。 |

## 自动化与浏览器验收

- 后端 `finance` 测试：29 项通过；US1.4 新增覆盖默认分组、分组内独立更新、负数拒绝和跨访客修改拒绝。
- 前端 TypeScript 类型检查通过。
- Playwright 真实浏览器验收通过：分别填写生活成本、债务与储蓄，并验证 RM700 + RM420 + RM100 = RM1,220。
- 刷新页面后，三个金额、分组和 RM1,220 计算结果全部保持。
- 最终浏览器控制台没有产品错误；仅有 Expo Web 关于原生动画驱动不可用的开发环境提示。
- 验收过程中修复了首次并发请求可能创建多个访客会话的竞态：前端先完成收入档案请求以建立 session Cookie，再并行加载工作成本与承诺。
- 验收结束后清理本地浏览器验收数据，不把示例承诺留在开发数据库中。

## 数据口径与边界

- 承诺金额表示当前每月金额，允许为 0，不允许为负数。
- 每项承诺属于 `living`、`debt` 或 `savings` 之一；总承诺等于全部有效项目的月金额之和。
- 当前故事没有要求自定义承诺项目，也没有定义承诺金额的历史版本或生效日期，因此本包不扩展这些能力。
- “购房后是否停止计算租金”属于后续住房情景的计算规则，不改变用户已记录的原始承诺；若需要自动切换，应以明确的生效日期和情景需求另立工作包。
