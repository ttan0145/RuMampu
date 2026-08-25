# 项目开发日志

语言：**中文（CN）** | [English](CHANGELOG.md)

## 2026-08-25 — Epic 3 / Neon 集成兼容

状态：集成已加固；不代表全部 Epic 3 已完成

### 交付

- 将匿名 `HousingScenario` 绑定到财务数据使用的同一个 session `GuestProfile`，并增加“必须且只能有一个归属方”的数据库约束。
- 增加保留式数据迁移：既有无归属场景进入不可访问的 legacy profile，不会暴露给当前访客。
- 住房前置检查改为读取后端记录并复用 Epic 2 的月份/工作成本计算；旧客户端财务字段仍可接收，但不能覆盖持久化事实。
- 住房计算改用 `Decimal`，增加 half-up 响应舍入、重复成本分类校验和嵌套成本事务更新。
- 住房请求增加 credentials，使 finance 与 housing API 客户端保持同一个访客 session。
- 将 `PGHOST` 设为 PostgreSQL 显式开关，增加启动配置校验，并为 Neon 默认启用 TLS `require`。
- 在 SQLite 之外增加 PostgreSQL 16 CI 作业，且不保存托管 Neon 凭据。
- 用 ADR 0003 记录兼容边界，并同步架构、API 契约、OpenAPI 及英文/中文文档。

### 测试

- Django 全量 94 项本地通过，其中新增住房/数据库兼容测试 14 项，并覆盖保留式迁移。
- Playwright 7 条全部通过，包含真实浏览器住房/session 集成；SQLite 验收服务使用串行 browser worker。
- Django checks、migration drift、OpenAPI 校验及 TypeScript 检查通过。

## 2026-08-25 — Epic 2 后端权威收入形态

状态：完成并已加固；已获准交付 main

### 交付

- 完成 US2.1–US2.4 和 18/18 条验收标准。
- 新增版本化 `GET /api/v1/income-pattern/` 与 `GET/PUT /api/v1/income-coverage/`，不增加 legacy alias。
- 将月度聚合、当前工作成本扣减、描述统计、记录最低月识别和 coverage 评估移入应用服务。
- 新增按访客隔离的一对一 coverage 持久化，派生分析继续实时计算。
- 删除前端无来源阈值，改用 typed 权威响应、明确的 empty/limited/loading/saving/error/retry 状态和可横向滚动的可访问图表。
- 建立英文主版本与 `.cn.md` 镜像：需求快照、ADR 0002、API Contract、逐 US 验收记录、实施矩阵与索引。
- 删除 Epic 2 客户端 fallback 算法，将 API 模式设为正式默认，并让下游 coverage 提示直接使用权威响应。
- 增加过期响应拒绝与请求去重；coverage 保存失败时保留上一次确认结果及用户可重试草稿。
- 增加 model/service coverage 不变量、异常旧数据安全读取、支持大额聚合的金额响应字段、可访问选择状态与仓库 CI 门槛。
- 已 rebase 到组员的 US3.1–US3.3 与 Neon 改动，保留 housing 流程，恢复有文档说明的本地 SQLite fallback，并补全 housing OpenAPI 响应 schema，确保合并后的 main 仍可测试。

### 测试与验收

- 后端 `finance` 全套 80 项通过，其中 22 项为 Epic 2 专项。
- 12 个月场景固定验证 average `4437.50`、median `4385.00`、highest `5870.00`、lowest `3160.00`、range `2710.00`、population standard deviation `699.16`、最低月 `2026-02`。
- TypeScript、migration drift、Django system check、OpenAPI 生成/校验及 6 条可执行 Playwright Epic 2 流程全部通过。

### 边界

- 当前有效月度工作成本应用于全部记录月，并明确标识为 current-snapshot basis；不暗示历史成本版本。
- API 只返回描述事实，不返回预测、稳定分类、风险带、住房 shortfall reason 或无来源阈值。
- Coverage 持久化属于当前访客会话，不是账户级永久声明。

## 2026-08-25 — Epic 1 正式闭环

状态：完成；已交付 main

### 交付

- 建立 Django REST Framework 模块化后端、`/api/v1`、统一错误结构、OpenAPI、Swagger/ReDoc 和 8 个数据库迁移。
- 完成 Epic 1 的 8 个 User Story、56/56 条 Acceptance Criteria：
  - 多来源收入、异常值确认与访客持久化；
  - 历史月收入及月份口径约束；
  - 工作成本与三类固定财务承诺；
  - 手动支出、支出回顾和月度汇总；
  - 收据起点、人工核对与确认保存；
  - 历史收入 CSV 预览、错误行和确认导入。
- Expo 前端已接入收入、成本、承诺、支出和导入 API，保留 English、Bahasa Melayu、中文三语。
- 提取并归档完整 8 Epic/35 US/219 AC，以及 Epic 1 的 8 US/56 AC Markdown 快照。
- 项目默认文档统一为英文；中文资料以 `.cn.md` 明确标识并与英文版本互相链接。

### 测试与验收

- 后端 `finance` 自动化测试：58 项通过。
- 前端 TypeScript 检查通过。
- 数据库迁移检查无漂移，OpenAPI 生成与校验通过，`git diff --check` 通过。
- US1.1–US1.8 均留有真实 Playwright 浏览器验收截图。
- 新增默认关闭的 `my-gig-driver-12m` 测试场景：约 114ms 创建 12 个月、60 笔收入和 240 笔支出；已验证收入形态、完整支出月份、住房测试和 Epic 5 页面复用。

### 重要修正

- 修复前端启动阶段的 session 初始化竞态，避免多个首批请求建立不同访客档案。
- 收入来源与支出分类采用可阻止单独误删、同时允许访客整体级联清理的关系策略。
- 收入导入和收据保存均要求显式确认，未确认数据不会成为财务事实。

### 当前边界

- 收据读取仍是 prototype 起点，不宣称生产级 OCR，也不上传或长期保存原图。
- CSV 是当前唯一历史导入格式；XLSX、PDF、银行连接和自动列映射尚未实现。
- 用户账户、跨设备同步、生产数据保留/删除政策属于后续工作。
- Epic 2/5 可复用现有财务模型和确定性测试场景，但各自业务规则仍须按正式 US/AC 推进。
