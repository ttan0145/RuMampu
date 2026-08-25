# RuMampu

语言：**中文（CN）** | [English](README.md)

RuMampu 面向收入不规律的马来西亚用户，帮助他们根据真实的月度财务记录评估住房付款压力，并解释结果。它不是贷款机构、信用评分工具或贷款获批预测器。

## 当前状态

Epic 1 与 Epic 2 均已全栈闭环：Epic 1 为 56/56 AC，Epic 2 为 18/18 AC。

Epic 1 提供：

- 按访客会话隔离的收入档案；
- 默认及自定义收入来源；
- 单笔收入与历史月收入录入；
- 异常高收入二次确认；
- 默认及自定义工作成本、独立金额更新和持久化；
- 扣除工作成本后的月收入计算与来源标记；
- 生活成本、债务还款和储蓄承诺的分组录入与持久化；
- 月度总承诺计算与来源标记；
- 日常支出的预设/自定义分类、金额、日期与手动录入持久化；
- 最新支出月份、记录天数、明细与跨月汇总回顾；
- 收据拍照/选图起点、读取预览、人工编辑确认和来源持久化；
- 历史收入 CSV 选择、逐行预览、错误标识、确认入库和分析联动；
- Expo 前端与 Django API 同步；
- `/api/v1`、统一错误响应和 OpenAPI 契约。

Epic 2 新增：

- 后端权威的逐月可用收入分析；
- 平均数、中位数、最高、最低、范围与总体标准差；
- 空记录、单月、双月与三个月以上的明确历史状态；
- 不使用无来源阈值或风险标签的记录最低月识别；
- 按访客隔离持久化的慢月份 coverage 回答；
- 已覆盖/未覆盖月份，以及 No/Not sure 的事实性观察；
- 唯一后端计算权威、过期响应保护与保存失败恢复；
- 可在 GitHub Actions 重复执行的后端、TypeScript、OpenAPI、migration 与 Playwright 质量门槛。

逐条验收证据见 [Epic 1 实施与验收索引](docs/epic-1/README.cn.md)。

Epic 2 的 18 条验收、计算边界与浏览器证据见 [Epic 2 实施与验收索引](docs/epic-2/README.cn.md)。

本轮正式开发记录见 [项目开发日志](docs/CHANGELOG.cn.md)。

Epic 1 完成报告见 [Epic 1 完成报告](docs/epic-1/EPIC_1_COMPLETION_REPORT.cn.md)。生产级 OCR、用户账户、跨设备同步、收入预测、风险评分与 Epic 5 正式化仍不在当前范围；完整边界见 [Epic 1/2/5 实现矩阵](docs/EPIC_1_2_5_IMPLEMENTATION_MATRIX.cn.md)。

正式需求已经转换为便于检索的 Markdown：[全部 US/AC](docs/requirements/USER_STORIES_AND_ACCEPTANCE_CRITERIA.md)、[Epic 1 US/AC](docs/requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md) 和 [Epic 2 US/AC](docs/requirements/EPIC_2_USER_STORIES_AND_ACCEPTANCE_CRITERIA.cn.md)。实现时以 US 为交付单元、以 AC 为验收单元。

## 技术结构

```text
RuMampu/
├─ backend/                 Django + Django REST Framework
│  ├─ config/               运行配置、API 路由、错误和 OpenAPI 基线
│  └─ finance/              当前收入领域模型、服务、API 和测试
├─ frontend/                Expo + React Native + TypeScript
│  └─ src/rumampu/          页面、状态、计算和 API 客户端
└─ docs/                    架构、API 契约、ADR 和 Epic 状态
```

本项目采用模块化单体：先保证领域边界清楚，不预先拆分微服务。设计原则和后续模块划分见 [架构基线](docs/ARCHITECTURE.cn.md)。

## 本地启动

### 后端

```powershell
Set-Location backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py runserver localhost:8000
```

本地 SQLite 使用时让 `backend/.env` 中的 `PGHOST` 保持为空。接入 Neon/PostgreSQL 时设置完整的 `PG*` 变量；TLS 默认要求 `require`。

可用入口：

- 健康检查：`http://localhost:8000/api/v1/health/`
- Swagger UI：`http://localhost:8000/api/docs/`
- ReDoc：`http://localhost:8000/api/redoc/`
- OpenAPI schema：`http://localhost:8000/api/schema/`

### 前端

```powershell
Set-Location frontend
npm ci
Copy-Item .env.example .env
npm start
```

Expo Web 与 Django 应使用相同主机名，例如都使用 `localhost`，这样访客会话 Cookie 才能稳定保存。未设置 `EXPO_PUBLIC_API_URL` 时，前端使用内存原型数据；设置后，已接通的收入、工作成本、财务承诺、日常支出、收入形态与 coverage 功能使用正式 API。

### 快速仿真档案

开发环境提供默认关闭的 `my-gig-driver-12m` 测试场景：一次 API 请求可建立 12 个月、60 笔收入和 240 笔支出，并直接用于收入分析与住房测试。启用方式、金额假设、保护规则和 Playwright 流见 [12 个月网约车司机仿真场景](docs/testing/SCENARIO_GIG_DRIVER_12M.cn.md)。该接口不属于生产 API，也不会发布到 OpenAPI。

## API 约定

正式业务 API 从 `/api/v1/` 开始。金额在响应中使用两位小数字符串，日期使用 `YYYY-MM-DD`，所有 API 错误使用统一的 `error` 对象。详细规则、样例和兼容政策见 [API 契约](docs/API_CONTRACT.cn.md)。

`/api/income/` 和 `/api/health/` 仅作为首版原型的临时兼容路径，不属于公开 OpenAPI 契约，新代码不得继续使用。

## 开发质量门槛

提交前至少运行：

```powershell
# 后端测试、迁移漂移和 OpenAPI 校验
.\backend\.venv\Scripts\python.exe backend\manage.py test finance --noinput
.\backend\.venv\Scripts\python.exe backend\manage.py makemigrations --check --dry-run
.\backend\.venv\Scripts\python.exe backend\manage.py spectacular --validate --file docs\openapi.yaml

# 前端类型检查
Set-Location frontend
npm run typecheck
npm run test:e2e:epic2
```

一个工作包只有在代码、测试、API schema 和受影响文档同步后才算完成。基础决策记录在 [ADR 0001](docs/adr/0001-foundation-and-api-contract.cn.md)，Epic 2 计算边界记录在 [ADR 0002](docs/adr/0002-backend-authoritative-income-pattern.cn.md)。
