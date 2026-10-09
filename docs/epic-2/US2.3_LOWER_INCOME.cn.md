# US2.3 验收记录：识别较低收入月份

语言：[English](US2.3_LOWER_INCOME.md) | **中文（CN）**

| 验收标准 | 状态 | 实现与证据 |
| --- | --- | --- |
| AC2.3.1 Use the RuMampu low income rule | 通过 | 至少两个已结束月份时，服务标记所有并列的可用收入最低月；只有一个月时不制造比较结论。 |
| AC2.3.2 Explain how lower income months are identified | 通过 | 页面说明结果是已结束记录中可用收入最低的月份，不是金融标准或预测。 |
| AC2.3.3 Leave the unfinished month out of the count [v24] NEW | 通过 | 收入形态和房屋预检查排除本月；形态与覆盖响应会将本月单独作为“本月至今”返回。 |

测试覆盖唯一最低、并列最低、单月、负可用收入，以及带有工作成本记录的当前月份。12 个月场景只识别 `2026-02`。响应不返回固定百分比、变异系数评分或风险标签。
