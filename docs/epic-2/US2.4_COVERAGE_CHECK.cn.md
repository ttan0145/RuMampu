# US2.4 验收记录：Coverage 检查

语言：[English](US2.4_COVERAGE_CHECK.md) | **中文（CN）**

| 验收标准 | 状态 | 实现与证据 |
| --- | --- | --- |
| AC2.4.1 询问较慢时期 | 通过 | Coverage check 以批准的问题开场。 |
| AC2.4.2 提供三个选项 | 通过 | typed choice 为 `yes`、`no`、`not_sure`，界面显示 Yes、No、Not sure。 |
| AC2.4.3 Report only the quiet months that are genuinely missing [v24] AMENDED | 通过 | 用户保存的淡季月份与已结束月份集合比较；结果只将其中没有对应记录的月份列为缺口。 |
| AC2.4.4 选择多个慢月份 | 通过 | 多个唯一月份可保持选中，服务端统一排序。 |
| AC2.4.5 警告未覆盖月份 | 通过 | 权威响应返回 `unrepresented_slower_months`，保存回答后以警告显示。 |
| AC2.4.6 确认已覆盖月份 | 通过 | 成功确认后单独显示 `represented_slower_months`。 |
| AC2.4.7 回应 No 或 Not sure | 通过 | 两者均清空选择，只显示已结束月份的事实，并明确不能确认季节代表性。 |

一对一 `IncomeCoverage` 记录按访客隔离。Serializer、model、service 与数据库测试覆盖必选月份、类型、唯一性、顺序、1–12、自动清空、异常数据安全读取、持久化、跨年日历月份匹配与跨访客隔离。当前未完成月份会单独返回，在结束前不代表相应的淡季月份。Playwright 验证唯一一次权威初始 GET、加载期间禁用交互、自动保存及刷新持久化、No/Not sure 事实输出，以及 PUT 失败后同时保留上一次确认结果和可重试草稿。
