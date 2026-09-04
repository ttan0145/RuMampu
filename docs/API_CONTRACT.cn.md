# RuMampu API 契约

语言：**中文（CN）** | [English](API_CONTRACT.md)

- 状态：v1 基线
- 基准路径：`/api/v1/`
- 机器可读版本：[openapi.yaml](openapi.yaml)

## 1. 通用规则

- 一般请求与响应使用 UTF-8 JSON；文件上传端点使用 `multipart/form-data`。
- JSON 字段使用 `snake_case`。
- 主资源 ID 使用整数；公开访客 ID 使用 UUID。
- Finance 领域金额响应使用两位小数字符串，例如 `"777.25"`；既有住房 numeric 响应例外见第 10 节。客户端不得使用二进制浮点数进行权威计算。
- 自然日使用 `YYYY-MM-DD`；时间戳使用带时区的 ISO 8601。
- 当前身份边界是 Django session Cookie。Web 客户端必须发送 credentials。
- 成功响应直接返回资源或资源数组，不增加无意义的 `data` 包装层。

## 2. 错误格式

所有 DRF 端点错误都返回：

```json
{
  "error": {
    "code": "validation_error",
    "message": "The request contains invalid fields.",
    "fields": {
      "amount": ["Income amount must be greater than zero."]
    }
  }
}
```

`code` 是客户端判断逻辑的稳定字段；`message` 只作为英文回退信息，正式 UI 应根据 code 本地化。`fields` 仅用于字段错误；需要补充上下文时使用 `context`。

当前稳定错误码：

| HTTP | code | 含义 |
| --- | --- | --- |
| 400 | `validation_error` | 请求字段不合法 |
| 404 | `not_found` | 资源不存在 |
| 405 | `method_not_allowed` | HTTP 方法不支持 |
| 409 | `income_outlier_confirmation_required` | 异常高收入需要明确确认 |
| 415 | `unsupported_media_type` | Content-Type 不支持 |
| 429 | `throttled` | 请求频率受限（启用限流后） |

异常收入响应示例：

```json
{
  "error": {
    "code": "income_outlier_confirmation_required",
    "message": "This amount is well above the profile's usual entries. Confirm to keep it.",
    "context": {
      "median_amount": "120.00"
    }
  }
}
```

客户端确认后应使用相同数据重试，并设置 `confirm_outlier: true`。

## 3. 当前端点

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/v1/health/` | 服务健康与 API 版本 |
| GET | `/api/v1/income/record/` | 当前访客的来源和收入记录 |
| GET | `/api/v1/income/sources/` | 活跃收入来源 |
| POST | `/api/v1/income/sources/` | 新建自定义收入来源 |
| GET | `/api/v1/income/entries/` | 收入明细 |
| POST | `/api/v1/income/entries/` | 新建收入或历史月总额 |
| PATCH | `/api/v1/income/entries/{id}/` | 更新一笔收入或历史月总额记录 |
| DELETE | `/api/v1/income/entries/{id}/` | 删除当前访客的一笔收入记录 |
| POST | `/api/v1/income-imports/preview/` | 上传 CSV 并建立逐行预览，不创建收入记录 |
| GET | `/api/v1/income-imports/{id}/` | 读取当前访客的导入批次与逐行结果 |
| POST | `/api/v1/income-imports/{id}/confirm/` | 确认批次并创建已识别的历史收入记录 |
| GET | `/api/v1/work-costs/` | 当前访客的有效工作成本类别 |
| POST | `/api/v1/work-costs/` | 新建自定义工作成本类别 |
| GET、POST | `/api/v1/work-costs/entries/` | 读取或新建带日期的工作成本记录 |
| PATCH | `/api/v1/work-costs/entries/{id}/` | 更新一笔带日期工作成本记录 |
| GET | `/api/v1/work-costs/summary/?month=YYYY-MM` | 计算所选月份的工作成本事实汇总 |
| GET | `/api/v1/commitments/` | 当前访客的有效财务承诺项目 |
| PATCH | `/api/v1/commitments/{id}/` | 更新一个财务承诺项目的月金额 |
| GET | `/api/v1/expense-categories/` | 当前访客的有效支出分类 |
| POST | `/api/v1/expense-categories/` | 新建自定义支出分类 |
| GET | `/api/v1/expenses/` | 当前访客的日常支出记录 |
| POST | `/api/v1/expenses/` | 手动新建一笔日常支出 |
| GET | `/api/v1/income-pattern/` | 重新计算当前访客的逐月收入形态 |
| GET | `/api/v1/income-coverage/` | 读取当前访客已确认的慢时期覆盖回答 |
| PUT | `/api/v1/income-coverage/` | 确认并评估慢时期覆盖回答 |
| POST | `/api/v1/housing/calculate/` | 计算融资额、月供与住房月总成本 |
| POST | `/api/v1/housing/pre-check/` | 使用当前访客记录评估加入住房成本前的现有月度缺口 |
| GET/POST | `/api/v1/housing/scenarios/` | 列出或创建当前归属方的住房场景 |
| GET/PUT/PATCH/DELETE | `/api/v1/housing/scenarios/{id}/` | 读取、更新或删除住房场景 |
| POST | `/api/v1/housing/test-result/` | 使用权威财务记录测试当前归属方的住房场景 |

请求和响应字段的完整定义以 OpenAPI schema 为准。

`GET /api/v1/income/record/` 除收入来源与明细外，还返回 `recorded_month_count`，表示当前访客记录中不重复的财务月份数量。

## 4. 新建收入示例

```json
{
  "source_id": 1,
  "amount": "880.50",
  "date": "2026-08-24",
  "entry_method": "manual",
  "confirm_outlier": false
}
```

响应：

```json
{
  "id": 1,
  "amount": "880.50",
  "date": "2026-08-24",
  "source_id": 1,
  "entry_method": "manual",
  "created_at": "2026-08-24T15:00:00Z"
}
```

`entry_method` 可为：

- `manual`：单笔收入，`source_id` 必填；
- `historical_total`：用户仅知道该月总收入，`source_id` 应省略或为 `null`。

历史月总额示例：

```json
{
  "amount": "2750.00",
  "date": "2019-01-15",
  "entry_method": "historical_total",
  "source_id": null
}
```

历史月总额必须属于当前月份之前的月份。同一月份只允许一种收入记录口径：不能把整月总额与逐笔收入混合，同一月份也不能重复保存两条整月总额。客户端可让用户输入月份，发送时使用该月内的约定日期；分析和 `recorded_month_count` 均按年月归集。

`DELETE /api/v1/income/entries/{id}/` 只删除当前访客选中的一笔记录并返回 `204`；记录不存在或属于其他访客时返回 `404`。如果删掉的是该月最后一笔收入，同时清理空的财务月份，但保留同月带日期的工作成本记录。工作成本、收入形态和覆盖页面随后必须基于更新后的记录刷新。

## 5. 工作成本

默认及自定义工作成本类别均作为独立资源返回。默认类别通过稳定 `slug` 本地化，自定义类别使用用户提供的 `name`；类别本身不携带持续性的金额。

只读字段 `legacy_monthly_amount` 继续保留旧版无日期估计供核查。按用户确认的界面调整，工作成本页不再展示旧估计提示或旧金额；这些值仍不参与计算，也不自动转换为逐笔记录。

新建自定义类别：

```json
{
  "name": "Equipment rental"
}
```

新建带日期记录：

```json
{
  "category_id": 1,
  "amount": "200.00",
  "date": "2026-09-02"
}
```

`amount` 必须大于 0，`date` 不能是未来日期。即使类别和月份相同，多笔记录也会独立保留。`PATCH /api/v1/work-costs/entries/{id}/` 只更新目标记录的 `category_id`、`amount` 或 `date`。

`GET /api/v1/work-costs/summary/?month=2026-09` 返回所选月、该月已记录总收入、该月工作成本总额，以及仅在该月有收入时返回的 `income_after_work_costs`。`available_months` 包含当前月以及有收入或工作成本记录的月份。计算为 `YYYY-MM` 的总收入减去 `cost_date` 同属该 `YYYY-MM` 的成本记录；不会把一笔记录变成重复月扣除，也不会跨月使用平均值。

省略 `month` 使用服务端本地当前月。显式传入时必须是严格 ASCII `YYYY-MM`，年份 0001–9999、月份 01–12；空串、空白、未补零及年份 0000 均返回带字段错误的 400。无收入用 `null` 而非 0；计算得到的 0 和负数保留。加载中或刷新失败时，不得把旧结果标为新月份。

POST/PATCH 已返回确认记录，即代表写入成功，后续 GET 失败不能再显示为保存失败。客户端应用确认记录、清空已提交草稿，提供只读刷新，不自动重试 POST。若 POST 响应本身丢失，v1 因尚无幂等键仍无法确认结果；手动重新录入前应先核对记录列表。

发布门槛：当前工作区改变了旧版 v1 类别/月金额接口和分析口径，不是向后兼容的部署。面向既有客户端发布前，仍须按第 11 节完成接口版本化及迁移发布方案；本地测试通过不免除该要求。

## 6. 财务承诺

默认承诺项目按 `commitment_type` 分为 `living`、`debt` 和 `savings`。每项金额使用 `monthly_amount`，允许 `0.00`，不允许负数；稳定 `slug` 用于前端本地化。

响应项目示例：

```json
{
  "id": 1,
  "slug": "rent",
  "name": "Rent",
  "commitment_type": "living",
  "monthly_amount": "700.00",
  "is_daily_variable": false,
  "active": true
}
```

修改金额：

```json
{
  "monthly_amount": "700.00"
}
```

总承诺由客户端将当前全部有效项目相加并标记为计算值。可编辑来源项仍是该访客拥有的用户数据，但界面不会在每个输入框下重复显示来源标记。当前 v1 不提供新建自定义承诺端点，也不保存承诺金额历史版本。

## 7. 日常支出

预设及自定义支出分类均是访客隔离的独立资源。预设分类通过稳定 `slug` 本地化；自定义分类使用用户提供的 `name`。

新建自定义分类：

```json
{
  "name": "Pet supplies"
}
```

手动新建支出：

```json
{
  "amount": "36.60",
  "date": "2026-08-25",
  "category_id": 6
}
```

支出金额必须大于零，日期必须为有效 `YYYY-MM-DD` 日历日期，`category_id` 必须属于当前访客。人工录入响应包含 `entry_method: "manual"`。

用户核对收据预览后保存：

```json
{
  "amount": "35.20",
  "date": "2026-08-25",
  "category_id": 1,
  "entry_method": "receipt",
  "merchant": "Kedai Maju edited",
  "confirm_receipt": true
}
```

`entry_method=receipt` 必须同时发送 `confirm_receipt=true`；否则返回字段验证错误且不创建记录。成功响应保留编辑后的 `merchant`、`entry_method: "receipt"` 和 `user_confirmed: true`。原始图片当前不上传到 API。

## 8. 历史收入 CSV 导入

导入使用 preview/confirm 两阶段协议。客户端先以 `multipart/form-data` 向 `/api/v1/income-imports/preview/` 发送 `file`；服务器保存解析批次与逐行结果，但此时不创建 `IncomeEntry`。

当前支持范围：

- UTF-8 编码、`.csv` 扩展名，最大 2 MB；
- 最多 1,000 条数据行；
- 必须包含 `amount`、`date`、`source` 三列，列名不区分大小写；
- `amount` 必须为大于零、最多两位小数的金额；
- `date` 必须是早于今天的 `YYYY-MM-DD` 日历日期；
- `source` 去除多余空白后必须为 1–120 个字符；
- 若某月已用 `historical_total` 表示，导入行会标为 `monthly_total_conflict`，不会混合口径。

预览响应示例：

```json
{
  "id": 1,
  "file_name": "history.csv",
  "status": "preview",
  "total_rows": 2,
  "ready_count": 1,
  "error_count": 1,
  "imported_count": 0,
  "confirmed_at": null,
  "rows": [
    {
      "row_number": 2,
      "raw_amount": "1200.00",
      "raw_date": "2025-05-10",
      "raw_source": "E-hailing",
      "amount": "1200.00",
      "date": "2025-05-10",
      "source_name": "E-hailing",
      "is_valid": true,
      "error_code": "",
      "error_message": "",
      "imported_entry_id": null
    }
  ]
}
```

客户端必须显示识别后的金额、日期、来源以及错误行，再由用户调用 confirm。confirm 在事务中只创建无错误的行，复用同名有效来源或创建自定义来源，收入记录标为 `entry_method: "import"`；已确认批次再次 confirm 返回同一状态，不重复创建收入。导入不要求 6 或 12 个月最低历史长度。

## 9. 收入形态分析

`GET /api/v1/income-pattern/` 从源记录实时重算，不存储派生快照。月度行使用 `YYYY-MM`，全部金额字段均为两位小数字符串。

```json
{
  "recorded_month_count": 2,
  "history_depth": "two_months",
  "provenance": "calculated_from_user_record",
  "work_cost_basis": "recorded_entries_by_month",
  "months": [{
    "month": "2026-01",
    "gross_income": "4380.00",
    "work_costs": "750.00",
    "usable_income": "3630.00",
    "is_lowest_recorded": false
  }],
  "statistics": {
    "average": "4065.00",
    "median": "4065.00",
    "highest": "4500.00",
    "lowest": "3630.00",
    "range": "870.00",
    "standard_deviation": "435.00"
  },
  "lower_income": {"basis": "recorded_minimum", "months": ["2026-01"]}
}
```

`history_depth` 为 `empty`、`one_month`、`two_months` 或 `three_or_more`。空记录返回 `statistics: null`。单月仍返回事实统计，但由于无法比较，`lower_income.months` 为空。两个及以上记录月会标记所有并列最低月。总体标准差以 `Decimal` 计算，并按 `ROUND_HALF_UP` 保留两位。

Coverage 采用显式确认：

```json
{
  "answer": "yes",
  "slower_months": [1, 3, 8]
}
```

- `answer` 为 `yes`、`no` 或 `not_sure`。
- `yes` 至少需要一个 1–12 的唯一月份，服务端统一排序。
- `no` 与 `not_sure` 无论收到什么值都会清空 `slower_months`。
- 响应通过比较所有记录年份的日历月份编号，分别返回 `represented_slower_months` 和 `unrepresented_slower_months`。
- 对 `no` 与 `not_sure`，`observation` 为 `null`，或只包含记录月数、最低、最高和范围的事实性 `recorded_range`。
- Coverage 按访客一对一隔离持久化；分析结果不持久化。
- 传输校验、模型校验与应用服务共同保证慢月份的规范形态：仅限 1–12 的整数、不得重复、升序保存、`yes` 必须非空，`no`/`not_sure` 必须为空。若遇到不合规的旧数据，响应会安全降级为未知回答，不让非法状态越过契约边界。
- 单笔收入继续遵守其位数上限，但派生金额响应不复用单笔上限；因此同月多个合法记录的聚合值即使超过单笔最大值，也能正常返回两位小数字符串。

API 不返回预测、稳定性、风险或固定阈值结论。

## 10. 住房集成

住房场景请求与财务 API 使用同一个携带 credentials 的 Django session。匿名场景归属于当前 `GuestProfile`，登录场景归属于对应用户；列表、详情、修改和删除不会查询全局 `user = null` 数据池。一个场景内的附加成本分类必须唯一。

权威住房前置检查只需发送空 JSON：

```json
{}
```

后端读取当前 session 持有的收入记录、带日期工作成本记录、当前有效承诺和已确认支出，并复用 Epic 2 的月份聚合与工作成本口径。旧版 v1 客户端仍可发送 `income`、`work_costs`、`commitments` 和 `expenses`；这些可选传输字段只为兼容而接收，不参与计算，客户端状态不能替换持久化事实。

```json
{
  "provenance": "calculated_from_user_record",
  "work_cost_basis": "recorded_entries_by_month",
  "has_existing_shortfall": true,
  "tested_months": 2,
  "largest_existing_gap": 200.0,
  "worst_month": {"year": 2026, "month": 2},
  "months": []
}
```

住房服务内部使用 `Decimal` 并按 half-up 处理金额响应。为保持 v1 兼容，住房端点继续使用既有 numeric JSON 金额字段；finance 领域的金额响应继续使用两位小数字符串。

当客户端提交 `upfront_costs` 与 `cash_on_hand` 时，`POST /api/v1/housing/calculate/` 还会返回权威计算的 `upfront_required`、原样确认的 `cash_on_hand` 和 `upfront_gap`。这些是用于展示的派生结果，不作为 scenario 事实持久化。

正式住房测试流程为：

1. 创建或更新当前归属方的 `/housing/scenarios/` 资源；
2. 请求 `/housing/pre-check/`，以其响应决定导航；
3. 将 `scenario_id` 提交到 `/housing/test-result/`，获得展示用历史测试结果。

测试请求可以携带 `tested_monthly_home_cost`，用于不持久化的付款比较；也可以携带 0 至 90 的 `income_shock_percent`，用于假设收入下降场景。两者都会复用已保存 scenario 的利率、年期、头期、附加成本及后端财务记录，且不会修改 scenario。响应包括测试月度结果、短缺、承担区间、参考房价换算及 `starting_liquidity` 路径。

`POST /api/v1/housing/test/` 仅作为旧版无状态客户端的兼容端点保留。正式前端不再调用它，也不会提交由客户端计算的财务月份副本。

## 11. 兼容与变更

- v1 内允许新增可选字段和新端点；删除字段、改类型或改变既有语义属于破坏性变更。
- 破坏性变更必须通过新版本路径和 ADR 引入。
- `/api/income/` 与 `/api/health/` 是临时兼容别名，不发布在 OpenAPI 中；新代码不得使用。
- `/api/v1/dev/scenarios/` 是默认关闭的本地测试基建，不属于生产 v1 契约且从 OpenAPI 排除；完整保护规则见[测试场景文档](testing/SCENARIO_GIG_DRIVER_12M.cn.md)。
- POST 当前不支持幂等键。前端必须在请求进行中禁用重复提交；在离线同步或自动重试上线前，需要先设计幂等协议。

## 12. 维护方式

修改 serializer、view 或 URL 后运行：

```powershell
.\backend\.venv\Scripts\python.exe backend\manage.py spectacular --validate --file docs\openapi.yaml
```

生成文件必须与代码一同评审和提交。Swagger UI 位于 `/api/docs/`，ReDoc 位于 `/api/redoc/`。
