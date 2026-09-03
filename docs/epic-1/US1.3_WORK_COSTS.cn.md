# US1.3 验收记录：记录直接工作成本

语言：**中文（CN）** | [English](US1.3_WORK_COSTS.md)

- 验收日期：2026-09-03
- 状态：本地实现与验收通过（10/10 AC）；不代表 LeanKit 关闭、IT2 排期或生产发布。
- 需求来源：[US1.3 - Record direct work-related costs](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md#us13---record-direct-work-related-costs)

## 验收矩阵

| Acceptance Criterion | 状态 | 实现与验收证据 |
|---|---|---|
| AC1.3.1 Select a work-cost category | 通过 | 页面加载当前 profile 的默认与自定义类别；保存前必须选定一个类别。 |
| AC1.3.2 Enter a work-cost amount | 通过 | 表单和 API 都要求金额大于 0。 |
| AC1.3.3 Enter a work-cost date | 通过 | 表单提供日期选择器；API 保存 `date` 并拒绝未来日期。 |
| AC1.3.4 Add a custom category | 通过 | `POST /api/v1/work-costs/` 新建唯一的自定义类别，不为它设置重复月金额。 |
| AC1.3.5 Save a work-cost entry | 通过 | `POST /api/v1/work-costs/entries/` 追加一笔独立的类别、金额和日期记录。 |
| AC1.3.6 Display recorded entries | 通过 | 页面列出每笔已保存记录的业务日期、类别、金额和用户数据来源。 |
| AC1.3.7 Edit a work-cost record | 通过 | `PATCH /api/v1/work-costs/entries/{id}/` 只修改被选中的记录，并刷新受影响月份的结果。 |
| AC1.3.8 Apply work costs to the correct month | 通过 | 财务服务按 `cost_date` 的年月分组，不会把一笔成本扣到其他月份。 |
| AC1.3.9 Show income after work costs | 通过 | 所选月汇总为该月总收入减该月成本；无收入月份保留成本并明确净收入不可计算。 |
| AC1.3.10 Identify calculated income | 通过 | 月净收入显示 `CALCULATED` 来源标记，并明确它使用所选月记录而非平均值。 |

## 自动化与浏览器验收

- 后端整套 `manage.py test`：106 项通过，新增 7 项工作成本边界回归，覆盖跨年编辑、空月份、日期/精度、访客隔离、零值/负值、旧金额保留。
- 前端 TypeScript 与验收可追溯性检查通过；Epic 1 的 60 条 AC 均唯一映射。
- `npm run test:e2e -- --reporter=line`：2026-09-03 在当前代码上完整运行，32 项全部通过（2.3 分钟），包含 Epic 1/2、既有住房/记录页回归和 4 项新增工作成本故障测试。
- `e2e/epic1.spec.ts` 的 US1.3 流程按服务端当前月份生成相对日期，不再锁死 2026 年 9 月；验证保存后重新加载、单条编辑、同月扣除、仅成本月份以及 calculated 标记。

验收技能将“编号唯一映射”与“实际验收通过”分开；本次完整浏览器回归才是新的运行证据。工程回归映射及剩余发布门槛见[批判性核查记录](US1.3_AUDIT_2026-09-03.cn.md)。

## 计算口径

- 工作成本类别只是标签；只有带正金额和业务日期的单笔记录才是金额事实。
- `YYYY-MM` 的 `Income after work costs` = 该月已记录总收入 − `cost_date` 落在同一 `YYYY-MM` 的全部记录。
- 所选月没有收入时，RuMampu 不会替换为平均值或其他月份；它显示已记录成本，并说明净收入不可计算。
- 为迁移安全而保留的旧 `WorkCostItem.monthly_amount` 不再参与计算，也不会被虚构成历史日期记录。
- 非零旧金额通过只读 `legacy_monthly_amount` 展示为待核查旧估计，并提醒不要重复录入。生产迁移及旧版接口版本化仍是发布门槛；尚未部署。
