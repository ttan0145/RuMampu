# US1.8 验收记录：导入历史财务记录

验收日期：2026-08-25  
状态：完成（8/8 AC）  
需求来源：[US1.8 - Import historical financial records](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md#us18---import-historical-financial-records)

## 验收矩阵

| Acceptance Criterion | 状态 | 实现与验收证据 |
|---|---|---|
| AC1.8.1 Access historical import | 通过 | Income 页面提供 `Import income from CSV` 入口，导入页通过系统文件选择器接收支持的 CSV；见[入口截图](../../output/playwright/us1.8/01-import-start.png)。 |
| AC1.8.2 Import historical income records | 通过 | 后端读取 UTF-8 CSV，将识别结果保存为 preview 批次和逐行数据，供确认前审阅。 |
| AC1.8.3 Preview imported records | 通过 | 预览完整显示金额、日期、收入来源和原始值；验收文件中 3 条有效记录均可逐条核对。 |
| AC1.8.4 Confirm imported records | 通过 | 用户选择 `Confirm and add 3 records` 后，3 条有效行事务性创建为 `entry_method=import`，并显示确认结果。 |
| AC1.8.5 Include imported periods in analysis | 通过 | 导入后 Income pattern 显示 May/Jun、平均 RM1,275；购房测试使用同样 2 个记录月并得到 `1 of 2` 的结果；见[收入形态截图](../../output/playwright/us1.8/03-income-pattern.png)与[住房测试截图](../../output/playwright/us1.8/04-housing-result.png)。 |
| AC1.8.6 Allow import with limited history | 通过 | 验收仅导入 2 个月，API 返回 `recorded_month_count=2` 并正常进入分析，没有 6 或 12 个月最低门槛。 |
| AC1.8.7 Handle records that cannot be recognised | 通过 | 无效金额和无效日期分别显示对应行号、原始值和具体错误，不会静默写入；见[含错误行的预览截图](../../output/playwright/us1.8/02-preview-with-errors.png)。 |
| AC1.8.8 Do not add imported records without confirmation | 通过 | Playwright 在预览完成、点击确认前读取当前 session 的收入档案，精确得到 `entries=0`、`recorded_month_count=0`。 |

## 文件和确认协议

- 当前支持 UTF-8 `.csv`，必需列为 `amount,date,source`；最大 2 MB、最多 1,000 条数据行。
- 金额必须大于零且最多两位小数；日期必须是早于今天的有效自然日；来源不能为空且不超过 120 字符。
- preview 只创建 `IncomeImportBatch` 和 `IncomeImportRow`，不创建收入事实。
- confirm 只导入无错误行，复用同名来源或创建自定义来源；再次确认同一批次不会重复创建收入。
- 若某月已由历史月总额表示，该行会明确标为冲突，避免逐笔记录与整月总额混用。

## 自动化与浏览器验收

- 后端 `finance` 测试：51 项通过，其中导入专项覆盖预览不入库、错误行、确认、有限历史、自定义来源、重复确认、访客隔离、文件限制、月总额冲突和访客删除级联。
- 前端 TypeScript 类型检查通过。
- Playwright 使用真实文件选择器上传 5 行样例：3 行有效、2 行错误；确认前 0 笔，确认后 3 笔、2 个月、总额 RM2,550。
- 页面重载后仍返回 3 笔、2 个月、RM2,550，证明数据来自 API 持久化而非前端临时状态。
- 最终浏览器控制台 0 错误；仅有 Expo Web 关于原生动画驱动不可用的开发环境提示。
- 验收结束后已删除本地访客、导入批次、导入行、收入和 session 数据，并停止开发服务器。

## 非目标

- 当前不支持 XLSX、PDF、图片、银行专属模板或自动列映射；这些格式需要新的解析与验收范围。
- 导入是历史收入入口，不等同银行数据连接、跨设备同步或身份认证。
- 无效行不会被自动猜测或修正，避免把不可靠解析变成财务事实。
