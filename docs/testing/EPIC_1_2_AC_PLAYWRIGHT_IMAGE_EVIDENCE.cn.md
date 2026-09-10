# Epic 1 + 2 AC 与 Playwright 图片证据对照表

> 核查日期：2026-09-11
>
> 需求基线：Google Drive `TM16_RuMampu_User_Stories_and_Acceptance_Criteria_v3.docx`（2026-09-06 修改），并与 `Changes to I2 in terms of Epics and Pain Points`（2026-09-07 修改）校准
>
> 代码基线：已同步 `origin/main` 的 `7feea84`，并合并本地 Epic 1+2 适配；待用户本地验收后再提交、推送
>
> 自动验收：Epic 1 `61` 条可执行 AC 全部通过，AC1.1.8 按要求明确暂缓；Epic 2 `18/18` AC 全部通过。包含技术加固与 12 个月 CSV 的本地 Playwright 回归共 `24/24` 通过，后端 finance `90/90` 通过。

## 使用说明

- 文件名中的 `ac1.1.1-3` 表示连续覆盖 AC1.1.1 至 AC1.1.3；下划线连接不连续的 AC 组；双下划线 `__` 后是画面说明。
- Epic 1 的主流程图和关键中间状态图已统一放在 `output/playwright/epic-1/evidence`；其中 `*-flow` 是该 US 自动测试执行完成后的收尾图。
- 图片是可视化证据，真正闭环还包括同一 Playwright `ac(...)` 区块中的页面断言、API 断言、未写入断言和刷新后持久化断言。
- `tech-e2-*` 是失败重试、有限历史、重新打开刷新和覆盖更新等技术加固证据，不冒充 Drive/LeanKit 中的业务 AC。
- AC1.1.8 的 `Your Data` 呈现按用户要求暂缓，追踪检查会接受这一项且只接受这一项被明确标记为 deferred。

## Epic 1

### US1.1 记录不同来源的收入

| AC | 图片证据 | 说明 |
|---|---|---|
| AC1.1.1 输入收入金额 | [主流程](../../output/playwright/epic-1/evidence/ac1.1.1-10__income-entry-flow.png)、[自定义来源记录](../../output/playwright/epic-1/evidence/ac1.1.1-3_ac1.1.5-8__custom-source-entry.png) | 金额字段可见。 |
| AC1.1.2 选择收入日期 | [主流程](../../output/playwright/epic-1/evidence/ac1.1.1-10__income-entry-flow.png)、[自定义来源记录](../../output/playwright/epic-1/evidence/ac1.1.1-3_ac1.1.5-8__custom-source-entry.png) | 日期控件及已选日期可见。 |
| AC1.1.3 选择收入来源 | [主流程](../../output/playwright/epic-1/evidence/ac1.1.1-10__income-entry-flow.png)、[自定义来源记录](../../output/playwright/epic-1/evidence/ac1.1.1-3_ac1.1.5-8__custom-source-entry.png) | 预设来源与自定义来源入口可见。 |
| AC1.1.4 使用多个收入来源 | [多来源记录](../../output/playwright/epic-1/evidence/ac1.1.4_ac1.1.6-8_ac1.1.10__outlier-kept.png)、[主流程](../../output/playwright/epic-1/evidence/ac1.1.1-10__income-entry-flow.png) | 列表显示不同来源的多笔收入。 |
| AC1.1.5 添加自定义收入来源 | [自定义来源记录](../../output/playwright/epic-1/evidence/ac1.1.1-3_ac1.1.5-8__custom-source-entry.png)、[主流程](../../output/playwright/epic-1/evidence/ac1.1.1-10__income-entry-flow.png) | `Weekend market` 自定义来源可见。 |
| AC1.1.6 保存收入记录 | [保存后的记录](../../output/playwright/epic-1/evidence/ac1.1.4_ac1.1.6-8_ac1.1.10__outlier-kept.png)、[自定义来源记录](../../output/playwright/epic-1/evidence/ac1.1.1-3_ac1.1.5-8__custom-source-entry.png) | 保存结果进入当前记录。 |
| AC1.1.7 显示已有记录 | [保存后的记录](../../output/playwright/epic-1/evidence/ac1.1.4_ac1.1.6-8_ac1.1.10__outlier-kept.png)、[主流程](../../output/playwright/epic-1/evidence/ac1.1.1-10__income-entry-flow.png) | 日期、来源与金额可见。 |
| AC1.1.8 标识用户输入的数据 | 暂缓 | `Your Data` UI 本轮不实施；测试以 `deferredAc(...)` 明确记录。 |
| AC1.1.9 阻止负数收入 | [负数警告](../../output/playwright/epic-1/evidence/ac1.1.9__negative-warning.png) | 警告直接可见；“未写入”由 API 数量断言证明。 |
| AC1.1.10 警告异常高额收入 | [异常值警告](../../output/playwright/epic-1/evidence/ac1.1.10__outlier-warning.png)、[确认保留后](../../output/playwright/epic-1/evidence/ac1.1.4_ac1.1.6-8_ac1.1.10__outlier-kept.png)、[主流程](../../output/playwright/epic-1/evidence/ac1.1.1-10__income-entry-flow.png) | 警告、Keep 入口及确认后记录均有证据。 |
| AC1.1.11 编辑已记录收入 | [主流程](../../output/playwright/epic-1/evidence/ac1.1.1-10__income-entry-flow.png) | Playwright 修改金额、日期、来源并断言更新后的单笔记录。 |
| AC1.1.12 校验金额格式 | 无独立截图 | Playwright 输入部分数字字符串，断言出现金额格式错误且 API 中没有新增记录。 |

### US1.2 添加历史收入

| AC | 图片证据 | 说明 |
|---|---|---|
| AC1.2.1 进入历史月份录入 | [最新历史录入流程](../../output/playwright/epic-1/evidence/ac1.2.1-4__historical-income-flow.png) | Income 页的 `Per month`、月份/年份选择器可用。 |
| AC1.2.2 输入月度总额 | [最新历史录入流程](../../output/playwright/epic-1/evidence/ac1.2.1-4__historical-income-flow.png)、[历史月记录](../../output/playwright/epic-1/evidence/ac1.2.2-3__historical-month-entry.png) | 月份与单一月度总额字段/结果可见。 |
| AC1.2.3 将历史收入纳入分析 | [历史月记录](../../output/playwright/epic-1/evidence/ac1.2.2-3__historical-month-entry.png)、[单月记录](../../output/playwright/epic-1/evidence/ac1.2.3-4__one-month-record.png) | 历史月进入记录并令记录月数为 1。 |
| AC1.2.4 接受任意历史长度 | [最新历史录入流程](../../output/playwright/epic-1/evidence/ac1.2.1-4__historical-income-flow.png)、[单月记录](../../output/playwright/epic-1/evidence/ac1.2.3-4__one-month-record.png) | 明示无 6/12 个月最低要求，且 1 个月仍可继续。 |

### US1.3 记录直接工作相关成本

| AC | 图片证据 | 说明 |
|---|---|---|
| AC1.3.1 选择工作成本类别 | [主流程](../../output/playwright/epic-1/evidence/ac1.3.1-10__work-costs.png) | Petrol、Servicing、Platform fees 等预设类别可用。 |
| AC1.3.2 输入工作成本金额 | [主流程](../../output/playwright/epic-1/evidence/ac1.3.1-10__work-costs.png) | 金额字段接受有效正数。 |
| AC1.3.3 输入工作成本日期 | [主流程](../../output/playwright/epic-1/evidence/ac1.3.1-10__work-costs.png) | 保存业务日期并按所选月份显示。 |
| AC1.3.4 添加自定义工作成本类别 | [主流程](../../output/playwright/epic-1/evidence/ac1.3.1-10__work-costs.png) | 自定义 `Equipment rental` 已加入。 |
| AC1.3.5 保存工作成本 | [主流程](../../output/playwright/epic-1/evidence/ac1.3.1-10__work-costs.png) | 新记录追加并在重新打开页面后保留。 |
| AC1.3.6 显示已记录成本 | [主流程](../../output/playwright/epic-1/evidence/ac1.3.1-10__work-costs.png) | 日期、类别和金额可见。 |
| AC1.3.7 编辑工作成本 | [主流程](../../output/playwright/epic-1/evidence/ac1.3.1-10__work-costs.png) | 编辑所选记录后金额及月度结果更新。 |
| AC1.3.8 按正确月份应用成本 | 无独立截图 | API 断言不同月份只扣除该月成本，成本不循环复用。 |
| AC1.3.9 显示扣除工作成本后的收入 | [主流程](../../output/playwright/epic-1/evidence/ac1.3.1-10__work-costs.png) | 有收入时显示差额；只有成本时明确说明不能计算。 |
| AC1.3.10 标识计算所得收入 | [主流程](../../output/playwright/epic-1/evidence/ac1.3.1-10__work-costs.png) | 结果带 `CALCULATED`。 |

### US1.4 记录固定财务负担

| AC | 图片证据 | 说明 |
|---|---|---|
| AC1.4.1 记录生活成本 | [最新证据](../../output/playwright/epic-1/evidence/ac1.4.1-6__commitments.png)、[刷新后证据](../../output/playwright/epic-1/evidence/ac1.4.1-6__commitments-after-reload.png) | Living costs 与 Rent 数值可见。 |
| AC1.4.2 记录债务还款 | [最新证据](../../output/playwright/epic-1/evidence/ac1.4.1-6__commitments.png)、[刷新后证据](../../output/playwright/epic-1/evidence/ac1.4.1-6__commitments-after-reload.png) | Debt repayments 与 Motor loan 可见。 |
| AC1.4.3 记录储蓄 | [最新证据](../../output/playwright/epic-1/evidence/ac1.4.1-6__commitments.png)、[刷新后证据](../../output/playwright/epic-1/evidence/ac1.4.1-6__commitments-after-reload.png) | Savings 数值可见。 |
| AC1.4.4 分隔不同负担类型 | [最新证据](../../output/playwright/epic-1/evidence/ac1.4.1-6__commitments.png)、[刷新后证据](../../output/playwright/epic-1/evidence/ac1.4.1-6__commitments-after-reload.png) | 三个分组独立呈现。 |
| AC1.4.5 显示固定支出总额 | [最新证据](../../output/playwright/epic-1/evidence/ac1.4.1-6__commitments.png)、[刷新后证据](../../output/playwright/epic-1/evidence/ac1.4.1-6__commitments-after-reload.png) | `Total commitments RM 1,220` 可见。 |
| AC1.4.6 将总额标识为计算值 | [最新证据](../../output/playwright/epic-1/evidence/ac1.4.1-6__commitments.png)、[刷新后证据](../../output/playwright/epic-1/evidence/ac1.4.1-6__commitments-after-reload.png) | 总额带 `CALCULATED`。 |

### US1.5 手动记录日常支出

| AC | 图片证据 | 说明 |
|---|---|---|
| AC1.5.1 输入支出金额 | [表单](../../output/playwright/epic-1/evidence/ac1.5.1-5__add-expense-form-after-reload.png)、[主流程](../../output/playwright/epic-1/evidence/ac1.5.1-6__manual-expense-flow.png) | 金额字段可见。 |
| AC1.5.2 选择支出类别 | [表单](../../output/playwright/epic-1/evidence/ac1.5.1-5__add-expense-form-after-reload.png)、[主流程](../../output/playwright/epic-1/evidence/ac1.5.1-6__manual-expense-flow.png) | 类别选择可见。 |
| AC1.5.3 使用预设类别 | [表单](../../output/playwright/epic-1/evidence/ac1.5.1-5__add-expense-form-after-reload.png) | 五个预设类别可见。 |
| AC1.5.4 添加自定义类别 | [表单](../../output/playwright/epic-1/evidence/ac1.5.1-5__add-expense-form-after-reload.png)、[保存结果](../../output/playwright/epic-1/evidence/ac1.5.6__manual-expenses-after-reload.png) | `Your own category` 入口及 `Pet supplies` 结果可见。 |
| AC1.5.5 输入支出日期 | [表单](../../output/playwright/epic-1/evidence/ac1.5.1-5__add-expense-form-after-reload.png) | 日期字段可见。 |
| AC1.5.6 添加支出 | [最新主流程](../../output/playwright/epic-1/evidence/ac1.5.1-6__manual-expense-flow.png)、[刷新后记录](../../output/playwright/epic-1/evidence/ac1.5.6__manual-expenses-after-reload.png) | 新支出、总额和保存提示可见。 |

### US1.6 查看已记录的日常支出

| AC | 图片证据 | 说明 |
|---|---|---|
| AC1.6.1 显示当前月度支出 | [最近月份](../../output/playwright/epic-1/evidence/ac1.6.1-5__latest-month-review.png)、[主流程](../../output/playwright/epic-1/evidence/ac1.6.1-6__expense-review-flow.png) | Aug 总额可见。 |
| AC1.6.2 显示已记录天数 | [最近月份](../../output/playwright/epic-1/evidence/ac1.6.1-5__latest-month-review.png) | `2 days recorded` 可见。 |
| AC1.6.3 显示每笔支出 | [最近月份](../../output/playwright/epic-1/evidence/ac1.6.1-5__latest-month-review.png) | 24/25 Aug 两笔记录可见。 |
| AC1.6.4 进入手动支出录入 | [最近月份](../../output/playwright/epic-1/evidence/ac1.6.1-5__latest-month-review.png) | `Add expense` 入口可见；导航由 Playwright 断言。 |
| AC1.6.5 进入收据录入流程 | [最近月份](../../output/playwright/epic-1/evidence/ac1.6.1-5__latest-month-review.png) | `Scan a receipt` 入口可见；导航由 Playwright 断言。 |
| AC1.6.6 进入月度支出摘要 | [最新主流程](../../output/playwright/epic-1/evidence/ac1.6.1-6__expense-review-flow.png)、[月度摘要](../../output/playwright/epic-1/evidence/ac1.6.6__monthly-summary.png) | Jul/Aug 摘要可见。 |

### US1.7 以收据作为支出录入起点

| AC | 图片证据 | 说明 |
|---|---|---|
| AC1.7.1 选择收据图片 | [选择页](../../output/playwright/epic-1/evidence/ac1.7.1_ac1.7.9__receipt-selection.png)、[主流程](../../output/playwright/epic-1/evidence/ac1.7.1-10__receipt-expense-flow.png) | 拍摄、选择及示例入口可见。 |
| AC1.7.2 显示收据读取状态 | [读取状态](../../output/playwright/epic-1/evidence/ac1.7.2__receipt-reading.png) | Shimmer 与 `Reading the receipt…` 可见。 |
| AC1.7.3 展示待确认数值 | [核对页](../../output/playwright/epic-1/evidence/ac1.7.3-8__receipt-review-edited.png) | 商户、日期、总额和类别字段可见。 |
| AC1.7.4 显示收据识别的商户 | [核对页](../../output/playwright/epic-1/evidence/ac1.7.3-8__receipt-review-edited.png) | Shop 带 `FROM RECEIPT`。 |
| AC1.7.5 显示收据识别的日期 | [核对页](../../output/playwright/epic-1/evidence/ac1.7.3-8__receipt-review-edited.png) | Date 带 `FROM RECEIPT`。 |
| AC1.7.6 显示收据识别的总额 | [核对页](../../output/playwright/epic-1/evidence/ac1.7.3-8__receipt-review-edited.png) | Total 带 `FROM RECEIPT`。 |
| AC1.7.7 选择支出类别 | [核对页](../../output/playwright/epic-1/evidence/ac1.7.3-8__receipt-review-edited.png) | Meals 等类别可见。 |
| AC1.7.8 保存前编辑 | [核对页](../../output/playwright/epic-1/evidence/ac1.7.3-8__receipt-review-edited.png) | 编辑后的商户、日期和总额可见。 |
| AC1.7.9 重新拍摄收据 | [返回选择页](../../output/playwright/epic-1/evidence/ac1.7.1_ac1.7.9__receipt-selection.png)、[核对页](../../output/playwright/epic-1/evidence/ac1.7.3-8__receipt-review-edited.png) | 核对页 Retake 与返回后的选择页形成前后证据；未保存由 API 断言证明。 |
| AC1.7.10 保存已确认支出 | [最新主流程](../../output/playwright/epic-1/evidence/ac1.7.1-10__receipt-expense-flow.png)、[刷新后记录](../../output/playwright/epic-1/evidence/ac1.7.10__confirmed-receipt-after-reload.png) | 收据支出进入列表并在刷新后保留。 |

### US1.8 导入历史财务记录

| AC | 图片证据 | 说明 |
|---|---|---|
| AC1.8.1 进入历史数据导入 | [导入入口](../../output/playwright/epic-1/evidence/ac1.8.1__import-start.png)、[主流程](../../output/playwright/epic-1/evidence/ac1.8.1-8__income-import-flow.png) | CSV 文件选择入口可见。 |
| AC1.8.2 导入历史收入记录 | [导入预览](../../output/playwright/epic-1/evidence/ac1.8.2-3_ac1.8.7-8__preview-with-errors.png)、[主流程](../../output/playwright/epic-1/evidence/ac1.8.1-8__income-import-flow.png) | 文件行被读取并分类。 |
| AC1.8.3 预览导入记录 | [导入预览](../../output/playwright/epic-1/evidence/ac1.8.2-3_ac1.8.7-8__preview-with-errors.png) | 金额、日期、来源和原始值可见。 |
| AC1.8.4 确认导入记录 | [导入后收入形态](../../output/playwright/epic-1/evidence/ac1.8.1-8__income-import-flow.png)、[历史证据](../../output/playwright/epic-1/evidence/ac1.8.4-6__income-pattern.png) | 图片显示确认后的记录结果；点击和成功提示由 Playwright 断言。 |
| AC1.8.5 将导入期间纳入分析 | [导入后收入形态](../../output/playwright/epic-1/evidence/ac1.8.1-8__income-import-flow.png)、[历史收入形态](../../output/playwright/epic-1/evidence/ac1.8.4-6__income-pattern.png)、[住房结果](../../output/playwright/epic-1/evidence/ac1.8.5__housing-result.png) | May/Jun 进入收入形态和住房计算。 |
| AC1.8.6 允许导入有限历史 | [导入后收入形态](../../output/playwright/epic-1/evidence/ac1.8.1-8__income-import-flow.png)、[历史收入形态](../../output/playwright/epic-1/evidence/ac1.8.4-6__income-pattern.png) | 两个月历史被接受，并显示有限历史说明。 |
| AC1.8.7 处理无法识别的记录 | [导入预览](../../output/playwright/epic-1/evidence/ac1.8.2-3_ac1.8.7-8__preview-with-errors.png) | `2 NEED ATTENTION` 与受影响行可见。 |
| AC1.8.8 未确认前不添加导入记录 | [确认前预览](../../output/playwright/epic-1/evidence/ac1.8.2-3_ac1.8.7-8__preview-with-errors.png) | 图片证明仍处于预览；记录数为 0 的关键结论由 API 断言证明。 |

## Epic 1 UI 加固（非业务 AC）

| 编号 | 图片证据 | 说明 |
|---|---|---|
| TECH-E1-01 | 无独立截图 | 新版 `Per week` 入口接受该周内任意日期，并在保存和刷新后保留正确周语义。 |
| TECH-E1-02 | 无独立截图 | 新版收入 `Scan` 示例可解析、确认并保存 5 条收入记录。 |
| TECH-E1-03 | 无独立截图 | 新版支出 CSV 示例可完成字段映射并保存 8 条支出记录。 |

## Epic 2

### US2.1 逐月查看收入

| AC | 图片证据 | 说明 |
|---|---|---|
| AC2.1.1 显示月度收入图 | [12 个月收入图](../../output/playwright/epic-2/evidence/ac2.1.1-3__income-month-chart.png) | 月度柱状图可见，Playwright 断言共 12 柱。 |
| AC2.1.2 显示月份标签 | [12 个月收入图](../../output/playwright/epic-2/evidence/ac2.1.1-3__income-month-chart.png) | 柱形下有月份和金额标签。 |
| AC2.1.3 反映不同月度金额 | [12 个月收入图](../../output/playwright/epic-2/evidence/ac2.1.1-3__income-month-chart.png) | 不同金额对应不同柱高，测试另比较具体 CSS 高度。 |

### US2.2 理解典型月份与极端月份

| AC | 图片证据 | 说明 |
|---|---|---|
| AC2.2.1 显示平均收入 | [统计汇总](../../output/playwright/epic-2/evidence/ac2.2.1-6__income-statistics.png) | 顶部平均值 RM4,437.50。 |
| AC2.2.2 显示收入中位数 | [统计汇总](../../output/playwright/epic-2/evidence/ac2.2.1-6__income-statistics.png) | Median RM4,385.00。 |
| AC2.2.3 显示最高收入 | [统计汇总](../../output/playwright/epic-2/evidence/ac2.2.1-6__income-statistics.png) | Highest RM5,870.00。 |
| AC2.2.4 显示最低收入 | [统计汇总](../../output/playwright/epic-2/evidence/ac2.2.1-6__income-statistics.png) | Lowest RM3,160.00。 |
| AC2.2.5 标识计算所得数值 | [统计汇总](../../output/playwright/epic-2/evidence/ac2.2.1-6__income-statistics.png) | 各统计值带 `CALCULATED`。 |
| AC2.2.6 解释收入波动 | [统计汇总](../../output/playwright/epic-2/evidence/ac2.2.1-6__income-statistics.png) | Recorded range RM2,710.00 与 standard deviation RM699.16 可见。 |

### US2.3 识别较低收入月份

| AC | 图片证据 | 说明 |
|---|---|---|
| AC2.3.1 使用 RuMampu 低收入规则 | [最低收入月](../../output/playwright/epic-2/evidence/ac2.3.1-2__lower-income-month.png) | 明示当前记录最低月份为 Feb 2026；测试断言对应柱形标签。 |
| AC2.3.2 解释低收入月份识别方式 | [最低收入月](../../output/playwright/epic-2/evidence/ac2.3.1-2__lower-income-month.png) | 明示基于当前记录、不是金融标准或预测。 |

### US2.4 检查记录历史是否覆盖较淡时期

| AC | 图片证据 | 说明 |
|---|---|---|
| AC2.4.1 询问较淡时期 | [覆盖月份](../../output/playwright/epic-2/evidence/ac2.4.1-6__coverage-months.png) | Coverage check 问题可见。 |
| AC2.4.2 提供三个回答选项 | [覆盖月份](../../output/playwright/epic-2/evidence/ac2.4.1-6__coverage-months.png) | Yes、No、Not sure 可见。 |
| AC2.4.3 选择较淡月份 | [覆盖月份](../../output/playwright/epic-2/evidence/ac2.4.1-6__coverage-months.png) | 12 个月均可见。 |
| AC2.4.4 选择多个较淡月份 | [覆盖月份](../../output/playwright/epic-2/evidence/ac2.4.1-6__coverage-months.png) | Jan、Mar、Aug 同时选中。 |
| AC2.4.5 警告未覆盖的较淡月份 | [覆盖月份](../../output/playwright/epic-2/evidence/ac2.4.1-6__coverage-months.png) | Mar 未覆盖警告可见。 |
| AC2.4.6 确认已覆盖的较淡月份 | [覆盖月份](../../output/playwright/epic-2/evidence/ac2.4.1-6__coverage-months.png) | Jan、Aug 已覆盖提示可见。 |
| AC2.4.7 回应 No 或 Not sure | [事实观察](../../output/playwright/epic-2/evidence/ac2.4.7__coverage-factual-observation.png) | 显示两个月的事实范围，并说明不能确认代表性。 |

## Epic 2 技术加固图片（非业务 AC）

| 编号 | 图片证据 | 说明 |
|---|---|---|
| TECH-E2-01 | [有限历史的零/负值](../../output/playwright/epic-2/evidence/tech-e2-01__limited-zero-negative.png) | 两个月历史保留 RM0 与 RM-400，不伪造稳定性结论。 |
| TECH-E2-02 | 无截图 | 只验证初始 coverage 请求唯一且控件在权威响应前禁用。 |
| TECH-E2-03 | [保存失败可重试](../../output/playwright/epic-2/evidence/tech-e2-03__coverage-save-failure.png) | 保留已确认结果，同时显示未保存草稿与重试提示。 |
| TECH-E2-04 | [失败重试后的空状态](../../output/playwright/epic-2/evidence/tech-e2-04__empty-pattern-after-retry.png) | API 失败后重试进入受控空状态。 |
| TECH-E2-05 | 无截图 | 重新打开 Income pattern 后再次请求服务端，并显示期间新增收入后的结果。 |
| TECH-E2-06 | 无截图 | 补录已声明的淡季月份后，Coverage 从未覆盖更新为已覆盖。 |

## LeanKit 核查结论

- Epic 1 的 8 个有效 US 与 62 个 AC、Epic 2 的 4 个 US 与 18 个 AC，编号和语义与 Drive v3 及 2026-09-07 补充说明一致。
- 当前注册表对 80 个业务 AC 一一映射：79 条可执行，AC1.1.8 一条明确暂缓；没有缺号、重复号或跨 Epic 误挂。
- 本次只读核查 LeanKit；没有移动、编辑或关闭任何卡片。
