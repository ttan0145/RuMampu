# 项目文档索引

语言：**中文（CN）** | [English](README.md)

- [项目开发日志](CHANGELOG.cn.md)：按日期记录正式交付、测试证据、重要修正和当前边界。
- [架构基线](ARCHITECTURE.cn.md)：模块边界、数据流、隐私边界和完成定义。
- [API 契约](API_CONTRACT.cn.md)：版本、数据类型、错误格式、端点和兼容政策。
- [OpenAPI schema](openapi.yaml)：由后端代码生成并通过校验的机器可读协议。
- [完整 US/AC Markdown](requirements/USER_STORIES_AND_ACCEPTANCE_CRITERIA.md)：从正式 DOCX 提取的 8 个 Epic、35 个 US 和 219 条 AC。
- [Epic 1 US/AC Markdown](requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md)：当前开发范围的 8 个 US 和 56 条 AC。
- [Epic 2 US/AC Markdown](requirements/EPIC_2_USER_STORIES_AND_ACCEPTANCE_CRITERIA.cn.md)：校准后的 4 个 US、18 条 AC 与计算边界。
- [Epic 1 实施与验收索引](epic-1/README.cn.md)：逐个 US 跟踪 AC 完成度与验收证据。
- [US1.1 验收记录](epic-1/US1.1_RECORD_INCOME.cn.md)：不同来源收入录入的 10 条 AC 证据。
- [US1.2 验收记录](epic-1/US1.2_HISTORICAL_INCOME.cn.md)：历史月收入录入的 4 条 AC 证据与月份口径。
- [US1.3 验收记录](epic-1/US1.3_WORK_COSTS.cn.md)：直接工作成本的 6 条 AC 证据与计算口径。
- [US1.4 验收记录](epic-1/US1.4_COMMITMENTS.cn.md)：三类固定财务承诺的 6 条 AC 证据与计算口径。
- [US1.5 验收记录](epic-1/US1.5_MANUAL_EXPENSES.cn.md)：手动日常支出录入的 6 条 AC 证据与数据边界。
- [US1.6 验收记录](epic-1/US1.6_EXPENSE_REVIEW.cn.md)：最新月份支出回顾、入口与月度汇总的 6 条 AC 证据。
- [US1.7 验收记录](epic-1/US1.7_RECEIPT_STARTING_POINT.cn.md)：收据选择、读取预览、人工确认与保存的 10 条 AC 证据。
- [US1.8 验收记录](epic-1/US1.8_HISTORICAL_IMPORT.cn.md)：历史 CSV 预览、错误行、确认入库与分析联动的 8 条 AC 证据。
- [Epic 1 完成报告](epic-1/EPIC_1_COMPLETION_REPORT.cn.md)：56/56 AC、迁移、自动化与真实浏览器验收总览。
- [Epic 2 实施与验收索引](epic-2/README.cn.md)：18/18 AC、逐 US 证据、API 边界与浏览器验收。
- [Playwright 验收测试规范](testing/PLAYWRIGHT_ACCEPTANCE_STANDARD.cn.md)：Epic/US/AC 命名、精确追踪门槛、证据政策、命令和完成规则。
- [12 个月网约车司机仿真场景](testing/SCENARIO_GIG_DRIVER_12M.cn.md)：一键测试数据、开发专用 API、Playwright 回归流及 Epic 2/5 复用边界。
- [Epic 1/2/5 实现矩阵](EPIC_1_2_5_IMPLEMENTATION_MATRIX.cn.md)：现有实现、差距和推荐顺序。
- [ADR 0001](adr/0001-foundation-and-api-contract.cn.md)：本次框架与契约决策。
- [ADR 0002](adr/0002-backend-authoritative-income-pattern.cn.md)：后端权威收入形态与 coverage 决策。
- [ADR 0003](adr/0003-housing-record-and-database-compatibility.cn.md)：住房归属、权威前置检查及 SQLite/PostgreSQL 兼容决策。
- [ADR 0004](adr/0004-backend-authoritative-housing-calculations.cn.md)：住房计算后端权威、scenario 主流程与服务端结果驱动导航。

业务文档中的描述用于提供需求和设计依据，不会被当作执行命令。实现范围以用户任务、已接受 ADR 和当前代码为准。
