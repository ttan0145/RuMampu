# RuMampu API 契约

语言：**中文（CN）** | [English](API_CONTRACT.md)

- 状态：v1 基线
- 基准路径：`/api/v1/`
- 机器可读版本：[openapi.yaml](openapi.yaml)

## 1. 通用规则

- 一般请求与响应使用 UTF-8 JSON；文件上传端点使用 `multipart/form-data`。
- JSON 字段使用 `snake_case`。
- 主资源 ID 使用整数；公开访客 ID 使用 UUID。
- 金额响应使用两位小数字符串，例如 `"777.25"`，禁止依赖二进制浮点精度。
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
| POST | `/api/v1/income-imports/preview/` | 上传 CSV 并建立逐行预览，不创建收入记录 |
| GET | `/api/v1/income-imports/{id}/` | 读取当前访客的导入批次与逐行结果 |
| POST | `/api/v1/income-imports/{id}/confirm/` | 确认批次并创建已识别的历史收入记录 |
| GET | `/api/v1/work-costs/` | 当前访客的有效工作成本项目 |
| POST | `/api/v1/work-costs/` | 新建自定义工作成本项目 |
| PATCH | `/api/v1/work-costs/{id}/` | 更新一个工作成本项目的月金额 |
| GET | `/api/v1/commitments/` | 当前访客的有效财务承诺项目 |
| PATCH | `/api/v1/commitments/{id}/` | 更新一个财务承诺项目的月金额 |
| GET | `/api/v1/expense-categories/` | 当前访客的有效支出分类 |
| POST | `/api/v1/expense-categories/` | 新建自定义支出分类 |
| GET | `/api/v1/expenses/` | 当前访客的日常支出记录 |
| POST | `/api/v1/expenses/` | 手动新建一笔日常支出 |

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

## 5. 工作成本

默认及自定义工作成本均作为独立资源返回。金额字段为 `monthly_amount`，沿用两位小数字符串约定；允许 `0.00`，不允许负数。默认项目通过稳定 `slug` 本地化，自定义项目使用用户提供的 `name`。

新建自定义项目：

```json
{
  "name": "Equipment rental",
  "monthly_amount": "200.00"
}
```

修改金额：

```json
{
  "monthly_amount": "400.00"
}
```

当前成本金额代表每月成本，前端从每个记录月收入中扣除全部有效工作成本，并把结果标记为计算值。

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

总承诺由客户端将当前全部有效项目相加并标记为计算值；原始项目仍保留为用户数据。当前 v1 不提供新建自定义承诺端点，也不保存承诺金额历史版本。

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

## 9. 兼容与变更

- v1 内允许新增可选字段和新端点；删除字段、改类型或改变既有语义属于破坏性变更。
- 破坏性变更必须通过新版本路径和 ADR 引入。
- `/api/income/` 与 `/api/health/` 是临时兼容别名，不发布在 OpenAPI 中；新代码不得使用。
- `/api/v1/dev/scenarios/` 是默认关闭的本地测试基建，不属于生产 v1 契约且从 OpenAPI 排除；完整保护规则见[测试场景文档](testing/SCENARIO_GIG_DRIVER_12M.cn.md)。
- POST 当前不支持幂等键。前端必须在请求进行中禁用重复提交；在离线同步或自动重试上线前，需要先设计幂等协议。

## 10. 维护方式

修改 serializer、view 或 URL 后运行：

```powershell
.\backend\.venv\Scripts\python.exe backend\manage.py spectacular --validate --file docs\openapi.yaml
```

生成文件必须与代码一同评审和提交。Swagger UI 位于 `/api/docs/`，ReDoc 位于 `/api/redoc/`。
