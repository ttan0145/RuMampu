# Epic 1、2、5 实施矩阵

语言：**中文（CN）** | [English](EPIC_1_2_5_IMPLEMENTATION_MATRIX.md)

更新时间：2026-10-03

本文件以最新项目边界为约束，区分真实后端能力、仅前端原型和尚未实现内容。`Built` 只用于已经有可执行代码和验收证据的功能。

## Foundation

2026-08-24 已完成正式开发基线：模块化单体结构、`/api/v1`、统一错误格式、金额/日期类型约定、OpenAPI schema、Swagger/ReDoc、前端集中 API 客户端和提交前质量门槛。旧 `/api` 路径仅作临时兼容，不用于后续开发。另有默认关闭、从公开 OpenAPI 排除的 [12 个月网约车司机测试场景](testing/SCENARIO_GIG_DRIVER_12M.cn.md)，作为 Epic 1/2/5 共用的确定性回归输入。

## Epic 1 - Income Builder

2026-10-03 按 v24/v25 页面重新核验：`epic1.spec.ts` 中 62 条标准有 58 条通过，4 条明确记为延期并写明原因（追溯闸门只允许这 4 条）。下面链接的各故事验收记录是按 v22 页面写的。

| User Story | 当前状态 | 代码/证据 | 下一步 |
|---|---|---|---|
| US1.1 Record income from different sources | 11/12 AC；AC1.1.8 延期 | 一个金额加一个日期选择器（v24）；来源和自定义来源；金额校验；高额提醒；编辑时改日期需确认；[验收记录](epic-1/US1.1_RECORD_INCOME.cn.md) | AC1.1.8（每条记录标 `Your Data`）照旧延期。 |
| US1.2 Add historical income | 完成（4/4 AC） | “Add a month I did not record” 打开过去月份弹层；当前月份不可选；记录月数；[验收记录](epic-1/US1.2_HISTORICAL_INCOME.cn.md) | 无 |
| US1.3 Record direct work-related costs | 9/10 AC；AC1.3.7 延期 | 工作成本在日常支出里打开 “This was for work” 记录（v24，v5 修订 2、3），并列在单独的表里；2026-10-03 补回 “+ Your own cost”；每月扣除工作成本后的收入在收入规律页显示；[验收记录](epic-1/US1.3_WORK_COSTS.cn.md) | AC1.3.7（编辑工作成本）：v24 的表没有编辑操作，旧的工作成本页已无入口，需要决定并改应用。 |
| US1.4 Record regular commitments | 4/6 AC；AC1.4.3、AC1.4.4 延期 | 账单页有生活开销和还债两组；总额标 `CALCULATED`；每组一个来源标签；[验收记录](epic-1/US1.4_COMMITMENTS.cn.md) | v24 账单页只保留生活开销和还债（提交 a1e6fbf），而 AC1.4.3、AC1.4.4 要求储蓄分组。由产品负责人决定加回分组还是修订标准。 |
| US1.5 Record daily expenses | 完成（6/6 AC） | 一个金额加一个日期选择器；默认和自定义类别；[验收记录](epic-1/US1.5_MANUAL_EXPENSES.cn.md) | 无 |
| US1.6 Review daily expenses | 完成（6/6 AC） | 当月总额、记录天数和条目；Manual / Scan / Import 三个标签；月度汇总；[验收记录](epic-1/US1.6_EXPENSE_REVIEW.cn.md) | 无 |
| US1.7 Receipt starting point | 完成（10/10 AC） | 日常支出里的收据标签：选图区域、相机、示例、读取中状态、标 “from receipt” 的可编辑确认、重拍；[验收记录](epic-1/US1.7_RECEIPT_STARTING_POINT.cn.md) | 生产级 OCR 与原图存储应在隐私政策明确后另立工作包 |
| US1.8 Historical import | 完成（8/8 AC） | UTF-8 CSV 上传；逐行预览；错误行；确认后才入库；分析联动；[验收记录](epic-1/US1.8_HISTORICAL_IMPORT.cn.md) | 无；其他文件格式和银行专属模板应另立需求 |

### 第一闭环的数据边界

- 访客通过 Django session 隔离，不要求先注册账号。
- 每个访客拥有自己的默认/自定义 IncomeSource、FinancialPeriod 和 IncomeEntry。
- 历史月总额与普通交易通过 `entry_method` 区分。
- 确认后的导入记录使用 `entry_method=import`，导入批次和逐行结果保留审计关系；预览不创建收入事实。
- 只有用户确认后才保存异常高的普通收入记录。
- 当前没有生产级身份认证、跨设备同步、导出或删除。

## Epic 2 - Income Pattern Analysis

| User Story | 当前状态 | 代码/证据 | 下一步 |
|---|---|---|---|
| US2.1 Month-by-month view | 完成（3/3 AC） | 后端聚合、版本化 pattern API、每个记录月一根带标签的柱子；[验收记录](epic-2/US2.1_MONTH_BY_MONTH.cn.md) | v24 去掉了“横向滚动”提示，标准不要求它。 |
| US2.2 Typical and extreme months | 完成（6/6 AC） | 平均、中位、最高、最低和记录范围；有限历史提示；[验收记录](epic-2/US2.2_TYPICAL_AND_EXTREMES.cn.md) | v24 不再显示标准差（API 仍返回）；AC2.2.6 由记录范围满足。 |
| US2.3 Lower-income months | 完成（2/2 AC） | 点出扣除工作成本后最低的记录月；规则（“不是金融标准或预测”）放在它的 (i) 后面，2026-10-03 补回；[验收记录](epic-2/US2.3_LOWER_INCOME.cn.md) | Epic 3 actual-shortfall reason 继续作为未来扩展。 |
| US2.4 Coverage check | 完成（7/7 AC） | 回答和月份格子点下即保存（v24，没有 Check 按钮）；按已保存的回答显示缺口、已覆盖和说明三种提示；月份格子向辅助技术暴露勾选状态（2026-10-03）；[验收记录](epic-2/US2.4_COVERAGE_CHECK.cn.md) | 账户级声明等待身份需求。 |

Epic 2 以后端权威方式实现，2026-10-03 重新核验 18/18 AC，只返回描述事实，不生成无来源阈值、稳定性结论、预测或风险带。参见 [Epic 2 索引](epic-2/README.cn.md)。

## Epic 5 - Homeownership Preparation

| User Story | 当前状态 | 代码/证据 | 待决事项 |
|---|---|---|---|
| US5.1 Access homeownership preparation tools | Built（5/5 AC） | Prepare 列出 Upfront cash、Cash buffer、Documents & financing；House 和 Money 的入口已重新开放；House 卡片说明已存了多少；[验收索引](epic-5/README.cn.md) | 无 |
| US5.2 Check upfront cash readiness | Built（17/17 AC） | 带日期的现金录入保存到账户（`cash_on_hand_date`，迁移 0018）；“You have”是与首页和 House 卡片共用的一个 pot，先从中留出现金缓冲（US5.8，2026-10-05）；费用引擎由分档边界测试锁定；图表几何、颜色、分组、来源和首套房开关已在浏览器中检查 | 修订后的 AC5.1.5、AC5.2.9 和 AC5.2.17 等产品负责人确认；金额在前端计算，而 ADR 0004 规定以 Django 为权威 |
| US5.3 Estimate a cash buffer from recorded short months | Built（9/9 AC，含修订） | 服务端计算的缓冲金额，现按“不论记录从哪个月开始”的最大跌幅计算（[ADR 0005](adr/0005-cash-buffer-deepest-fall.cn.md)）；点出并标出跌幅月份；12 个月固定数据的后端回归；零线落在零实际位置 | 需产品负责人确认修订后的 AC5.3.2 以及新增的 AC5.3.8、AC5.3.9（固定数据上 RM 680 变为 RM 1,940） |
| US5.4 Review financing preparation documents | Built（7/7 AC） | 五项清单；带来源和日期的 SJKP 条件；显示“需要复核”而非结论；免责声明 | SJKP 条件和 Aug 2026 参考日期需在发布前重新核验 |
| US5.8 Count my savings once（团队修订） | Built（10/10 AC；Cash buffer 上“动用安全钱”的入口和起名待团队确认） | 一个罐子（已有现金 + 计划存下 + 转入），先留出缓冲；Upfront cash、House、罐子明细、储蓄计划和首页读同一套拆分；Cash buffer 显示覆盖情况并可打开储蓄计划；Epic 10 的缓冲阶段和月目标也按此计算 | 需产品负责人和 Epic 10 负责人确认，之后写进 v5 文档和 LeanKit |

48 条验收标准是 [v5 基线](requirements/EPIC_5_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md)的 36 条加上 2026-10-05 的团队修订。User Story 5.5 到 5.7（迭代 3 新增的 Learn 解释页）随 v27b3 合并进来，还没有验收检查。Epic 5 的官方规则只能用于准备清单与信息展示，不能输出审批、资格或可负担结论。验收记录和待决事项见 [Epic 5 索引](epic-5/README.cn.md)。

## 推荐实施顺序

1. Foundation 框架与 API 契约 - 已完成。
2. E1.1 收入来源与收入记录 - 11/12 AC，AC1.1.8 延期。
3. E1.2 历史月收入 - 已完成，4/4 AC。
4. E1.3 工作成本 - 9/10 AC；需补回编辑工作成本（AC1.3.7）。
5. E1.4 固定承诺 - 4/6 AC；储蓄分组（AC1.4.3、AC1.4.4）待产品负责人决定。
6. E1.5/E1.6 日常支出录入与回顾 - 已分别按 6/6 AC 完成。
7. E1.7 收据起点流程 - 已按 10/10 AC 完成，真实 OCR 与人工确认边界分离。
8. E1.8 历史 CSV 导入 - 已按 8/8 AC 完成。
9. E2 后端权威收入形态与 coverage - 已按 18/18 AC 完成。
10. E5 购房准备工具 - 已实现，48/48 条 AC（v5 加团队修订）有可执行证据。剩余：US5.8 和修订条目的确认、把前期费用标准移到后端、重新核验公开来源，并为 Learn 故事 5.5 到 5.7 补验收检查（以及把阅读进度存到账号）。
