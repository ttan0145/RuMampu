# ADR 0003：住房记录归属与数据库兼容

语言：**中文（CN）** | [English](0003-housing-record-and-database-compatibility.md)

- 状态：已接受
- 日期：2026-08-25

## 背景

组员加入 US3.1–US3.3 和 Neon 连接时，Epic 1、2 正在建立按 session 隔离的财务记录。初版集成把全部匿名住房场景保存为 `user = null`，导致无关访客可能列出同一批数据。住房前置检查还会使用客户端提交的财务副本和二进制浮点数重新计算。虽然存在 SQLite 回退，但 CI 没有实际运行 PostgreSQL，缺少部分 `PG*` 配置时也只会在连接阶段才失败。

## 决策

1. 每个 `HousingScenario` 必须且只能有一个归属方：登录用户，或财务 API 使用的同一个 `GuestProfile`。
2. 迁移时将既有无归属记录保留到一个不可访问的 legacy profile，不把它们分配给当前访客。
3. 住房前置检查从当前 session 的后端记录读取收入、有效工作成本、有效承诺和已确认支出，并复用 Epic 2 收入形态服务、返回来源信息。旧请求字段在 v1 中继续作为可选兼容输入接收，但不参与计算。
4. 住房服务内部使用 `Decimal`，在响应边界按 half-up 对金额舍入。
5. `PGHOST` 是 PostgreSQL 的显式开关。凭据缺失、端口无效或 SSL 模式无效时启动立即失败；Neon 默认 `sslmode=require`，空 `PGHOST` 使用 SQLite。
6. CI 在 SQLite 和 PostgreSQL 16 上分别运行完整 Django 测试；仓库和 CI 不保存真实 Neon 凭据。

## 后果

- 匿名住房场景与 Epic 1/2 共用同一个 session Cookie 和隔离边界。
- 客户端不能通过提交不同财务金额伪造住房前置检查结果。
- 旧记录得到保留，但未来如需恢复归属，必须另行作出显式决策。
- 无需把 CI 绑定到某个托管 Neon 数据库，也能持续验证 PostgreSQL 兼容性。
- 本决策只加固已有 Epic 3 集成，不代表全部 Epic 3 US 已完成，也不移除后续尚存的客户端住房计算。
