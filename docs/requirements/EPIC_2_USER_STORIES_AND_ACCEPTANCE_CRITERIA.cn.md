# Epic 2 用户故事与验收标准

语言：[English](EPIC_2_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md) | **中文（CN）**

- Epic：收入形态分析
- 范围：4 个用户故事、21 条验收标准
- 来源快照：`TM16_RuMampu_User_Stories_and_Acceptance_Criteria_v7.docx` 中最新版 Epic 2 需求；AC2.1.1 与 AC2.4.3 使用修订后的描述。

## US2.1 — View income month by month（逐月查看收入）

**用户故事：** 作为收入不规律的用户，我希望看到各已记录月份的可用收入，以理解收入随时间变化的程度。

- **AC2.1.1 — View income month by month：** 已记录收入时，打开 Income pattern 应展示每个已结束月份的最新保存收入。
- **AC2.1.2 — Display month labels：** 有多个月份需要展示时，图表显示的每根柱子都标明对应的已记录月份。
- **AC2.1.3 — Reflect different monthly amounts：** 已结束月份的可用收入不同时，bar 高度应呈现不同金额。

## US2.2 — Understand my typical and extreme income months（理解典型与极端月份）

**用户故事：** 作为用户，我希望看到已记录收入的汇总统计，以理解典型月份以及收入较强、较弱月份之间的差距。

- **AC2.2.1 — Display average income：** 存在已结束月收入时，Income pattern 显示其可用收入平均值。
- **AC2.2.2 — Display median income：** 存在已结束月收入时，摘要显示可用收入中位数。
- **AC2.2.3 — Display highest income：** 摘要显示已结束月份中最高的可用收入。
- **AC2.2.4 — Display lowest income：** 摘要显示已结束月份中最低的可用收入。
- **AC2.2.5 — Identify calculated figures：** 从用户记录推导的统计值标明为计算所得。
- **AC2.2.6 — Explain variation：** 收入形态中各月之间存在差异时，RuMampu 利用可见的已记录范围信息说明波动程度。
- **AC2.2.7 — Show the recorded range [v24] NEW：** 记录了多个月份时，中位数、最高值、最低值和记录范围会各自分行列出。
- **AC2.2.8 — Show every recorded month [v24] NEW：** 记录的月份多于屏幕能容纳的数量时，图表会左右滚动并说明这一点，而不是丢弃月份。

## US2.3 — Identify lower-income months（识别较低收入月份）

**用户故事：** 作为用户，我希望 RuMampu 在我的记录历史中识别较弱收入月份，以便将其与更典型的月份区分开。

- **AC2.3.1 — Use the RuMampu low income rule：** 至少有两个已结束记录月时，RuMampu 根据已记录的最低可用收入识别所有并列月份，不使用固定阈值。
- **AC2.3.2 — Explain how lower income months are identified：** 假如 RuMampu 识别出一个收入较低的月份，当我查看其说明时，界面会说明该月是我当前记录中的最低收入月份，并且这不是金融标准或预测。
- **AC2.3.3 — Leave the unfinished month out of the count [v24] NEW：** 当前月份尚未结束时，房屋测试和淡季分析不计入该月，并将已保存金额单独显示为“本月至今”。

## US2.4 — Check whether my recorded history covers normally slower periods（检查记录是否覆盖通常较慢的时期）

**用户故事：** 作为收入可能随季节变化的用户，我希望标出通常收入较少的月份，以了解当前记录是否包含这些时期。

- **AC2.4.1 — Ask about quieter periods：** 打开 Coverage check 时，询问一年中是否有通常收入较少的时期。
- **AC2.4.2 — Provide three answer choices：** 用户可以选择 Yes、No 或 Not sure。
- **AC2.4.3 — Report only the quiet months that are genuinely missing [v24] AMENDED：** 用户标记了通常收入较少的月份后，进行覆盖评估时只报告不在我已记录历史中的月份。
- **AC2.4.4 — Select multiple slower months：** 多个淡季月份可以同时保持选中。
- **AC2.4.5 — Warn about uncovered slower months：** 用户标记的较慢月份不在我已记录的历史中时，RuMampu 显示提示“You said Mar is usually slower, but your record only runs Jan to Aug.”
- **AC2.4.6 — Confirm represented slower months：** 用户指定的月份已出现在已结束记录中时，界面可明确显示已覆盖。
- **AC2.4.7 — Respond to No or Not sure：** 假如我回答“否”或“不确定”，界面会显示一条关于我记录中月度波动的观察结论。

## 校准后的计算边界

- 每月可用收入等于该月总收入减去同一日历月已记录的工作成本。
- 当前日历月单独作为“本月至今”返回，不计入已结束月份数量、统计、低收入分类、Coverage 或房屋测试。
- 平均数、中位数、最高、最低、范围和总体标准差仅依据已结束月份计算。一个或两个已结束月仍显示事实值，并明确提示历史有限。
- 至少有两个已结束月时，较低收入月为所有并列的记录最低月；它不是预测或金融标准。
- Coverage 将用户声明的淡季日历月份与已结束记录月比较。`No` 和 `Not sure` 只返回已结束记录的事实范围，不能确认季节代表性。
- 每次打开 Income pattern 页面都会重新计算。新增收入后会刷新 Coverage；补录已声明的淡季月份后，提示会从“未覆盖”更新为“已覆盖”，无需重新提交回答。
- 固定百分比规则、变异系数评分、无来源阈值和 Low/Moderate/High 风险标签均不在批准范围内。
