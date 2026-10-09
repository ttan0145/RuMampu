# Epic 1 实施与验收索引

语言：**中文（CN）** | [English](README.md)

更新时间：2026-10-08

Epic 1 以 User Story 为交付单元、Acceptance Criterion 为验收单元。只有代码、自动化测试、真实界面验收和受影响文档全部同步后，状态才会标记为“完成”。

当前基线已对齐 v7：9 个 User Story、72 条 AC。前 67 条曾在 13/13 个浏览器用例中通过；本轮按用户确认的 Groq 路径补上了 US1.9 实现与计划披露，后端定向测试 20 项通过。US1.9 浏览器验收因前端测试服务未就绪而未运行；功能使用合成数据，未验证真实账单识别准确率。完整 Epic 1/2 联合回归由主对话负责人收尾。详见 [2026-10-08 Epic 1 完成报告](EPIC_1_COMPLETION_REPORT.cn.md#v7-当前验收总览)。

| User Story | AC 数量 | 状态 | 验收记录 |
|---|---:|---|---|
| US1.1 Record income from different sources | 12 | 通过（12/12） | [US1.1 验收记录](US1.1_RECORD_INCOME.cn.md) |
| US1.2 Add historical income | 4 | 通过（4/4） | [US1.2 验收记录](US1.2_HISTORICAL_INCOME.cn.md) |
| US1.3 Record direct work-related costs | 13 | 通过（13/13，含编辑和双向迁移） | [US1.3 验收记录](US1.3_WORK_COSTS.cn.md) |
| US1.4 Record regular financial commitments | 6 | 通过（6/6，含储蓄组） | [US1.4 验收记录](US1.4_COMMITMENTS.cn.md) |
| US1.5 Record daily expenses manually | 8 | 通过（8/8） | [US1.5 验收记录](US1.5_MANUAL_EXPENSES.cn.md) |
| US1.6 Review recorded daily expenses | 6 | 通过（6/6） | [US1.6 验收记录](US1.6_EXPENSE_REVIEW.cn.md) |
| US1.7 Use a receipt as the starting point for an expense | 10 | 通过（10/10） | [US1.7 验收记录](US1.7_RECEIPT_STARTING_POINT.cn.md) |
| US1.8 Import historical financial records | 8 | 通过（8/8） | [US1.8 验收记录](US1.8_HISTORICAL_IMPORT.cn.md) |
| US1.9 Read a bank statement or e-statement into entries | 5 | 已实现；后端 20 项定向测试通过；浏览器验收未运行 | [US1.9 验收记录](US1.9_BANK_STATEMENT_SCAN.cn.md) |

正式需求原文见 [Epic 1 US/AC](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md)。
