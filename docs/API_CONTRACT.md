# RuMampu API contract

Language: **English** | [Chinese (CN)](API_CONTRACT.cn.md)

- Status: v1 baseline
- Base path: `/api/v1/`
- Machine-readable version: [openapi.yaml](openapi.yaml)

## 1. General conventions

- Ordinary requests and responses use UTF-8 JSON; file-upload endpoints use `multipart/form-data`.
- JSON fields use `snake_case`.
- Primary resource IDs are integers; public guest IDs are UUIDs.
- Monetary responses use two-decimal strings such as `"777.25"`; clients must not rely on binary floating-point precision.
- Calendar dates use `YYYY-MM-DD`; timestamps use timezone-aware ISO 8601.
- The current identity boundary is the Django session cookie. Web clients must send credentials.
- Successful responses return resources or resource arrays directly without a redundant `data` wrapper.

## 2. Error shape

Every DRF endpoint returns errors as:

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

`code` is the stable client-control field. `message` is an English fallback only; production UI should localise by code. `fields` is present only for field-level errors; additional information belongs in `context`.

Current stable error codes:

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `validation_error` | One or more request fields are invalid |
| 404 | `not_found` | The resource does not exist |
| 405 | `method_not_allowed` | The HTTP method is unsupported |
| 409 | `income_outlier_confirmation_required` | Unusually high income needs explicit confirmation |
| 415 | `unsupported_media_type` | The Content-Type is unsupported |
| 429 | `throttled` | The request rate is limited when throttling is enabled |

Example outlier response:

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

After confirmation, the client retries the same data with `confirm_outlier: true`.

## 3. Current endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/health/` | Service health and API version |
| GET | `/api/v1/income/record/` | Current guest's income sources and entries |
| GET | `/api/v1/income/sources/` | Active income sources |
| POST | `/api/v1/income/sources/` | Create a custom income source |
| GET | `/api/v1/income/entries/` | Income entries |
| POST | `/api/v1/income/entries/` | Create itemised income or a historical monthly total |
| POST | `/api/v1/income-imports/preview/` | Upload CSV and create a row preview without income entries |
| GET | `/api/v1/income-imports/{id}/` | Read the current guest's import batch and row results |
| POST | `/api/v1/income-imports/{id}/confirm/` | Confirm a batch and create recognised historical entries |
| GET | `/api/v1/work-costs/` | Current guest's active work-cost items |
| POST | `/api/v1/work-costs/` | Create a custom work-cost item |
| PATCH | `/api/v1/work-costs/{id}/` | Update one work cost's monthly amount |
| GET | `/api/v1/commitments/` | Current guest's active financial commitments |
| PATCH | `/api/v1/commitments/{id}/` | Update one commitment's monthly amount |
| GET | `/api/v1/expense-categories/` | Current guest's active expense categories |
| POST | `/api/v1/expense-categories/` | Create a custom expense category |
| GET | `/api/v1/expenses/` | Current guest's daily expenses |
| POST | `/api/v1/expenses/` | Create a daily expense manually or from confirmed receipt values |
| GET | `/api/v1/income-pattern/` | Recalculate the current guest's month-by-month income pattern |
| GET | `/api/v1/income-coverage/` | Read the current guest's confirmed slower-period coverage answer |
| PUT | `/api/v1/income-coverage/` | Confirm and evaluate a slower-period coverage answer |

The OpenAPI schema is authoritative for complete request and response field definitions.

In addition to sources and entries, `GET /api/v1/income/record/` returns `recorded_month_count`: the number of distinct financial months in the current guest's record.

## 4. Create-income examples

```json
{
  "source_id": 1,
  "amount": "880.50",
  "date": "2026-08-24",
  "entry_method": "manual",
  "confirm_outlier": false
}
```

Response:

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

`entry_method` may be:

- `manual`: one itemised income entry; `source_id` is required; or
- `historical_total`: the user knows only the month's total; `source_id` is omitted or `null`.

Historical monthly-total example:

```json
{
  "amount": "2750.00",
  "date": "2019-01-15",
  "entry_method": "historical_total",
  "source_id": null
}
```

A historical monthly total must belong to a month before the current month. Each month uses one income-recording convention: a whole-month total cannot be mixed with itemised income, and two monthly totals cannot be saved for the same month. A client may ask for `YYYY-MM` and send an agreed date inside that month; analysis and `recorded_month_count` group by year and month.

## 5. Work costs

Default and custom work costs are independent resources. `monthly_amount` follows the two-decimal string convention; `0.00` is allowed and negative values are not. The frontend localises defaults by stable `slug`; custom items use the user-provided `name`.

Create a custom item:

```json
{
  "name": "Equipment rental",
  "monthly_amount": "200.00"
}
```

Update an amount:

```json
{
  "monthly_amount": "400.00"
}
```

Current work-cost amounts represent monthly costs. The income-pattern application service subtracts all active work costs once from each recorded month's aggregated gross income and identifies the result as calculated.

## 6. Financial commitments

Default commitments are grouped by `commitment_type`: `living`, `debt`, or `savings`. Each item uses `monthly_amount`, allows `0.00`, and rejects negative values. Stable `slug` values support frontend localisation.

Example response item:

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

Update an amount:

```json
{
  "monthly_amount": "700.00"
}
```

The client sums all current active items and labels total commitments as calculated; the source items remain user data. v1 does not expose custom-commitment creation or retain historical versions of commitment amounts.

## 7. Daily expenses

Predefined and custom expense categories are independent, guest-isolated resources. The frontend localises predefined categories by stable `slug`; custom categories use the user-provided `name`.

Create a custom category:

```json
{
  "name": "Pet supplies"
}
```

Create a manual expense:

```json
{
  "amount": "36.60",
  "date": "2026-08-25",
  "category_id": 6
}
```

The amount must be greater than zero, the date a valid `YYYY-MM-DD` calendar date, and `category_id` owned by the current guest. A manual response includes `entry_method: "manual"`.

Save after reviewing a receipt preview:

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

`entry_method=receipt` requires `confirm_receipt=true`; otherwise the API returns a field validation error and creates no record. A successful response retains the edited `merchant`, `entry_method: "receipt"`, and `user_confirmed: true`. The source image is not uploaded to the API.

## 8. Historical-income CSV import

Import follows a two-stage preview/confirm protocol. The client first sends `file` as `multipart/form-data` to `/api/v1/income-imports/preview/`. The server stores the parsed batch and row results but creates no `IncomeEntry` yet.

Current support:

- UTF-8 with a `.csv` extension, at most 2 MB;
- at most 1,000 data rows;
- required case-insensitive `amount`, `date`, and `source` columns;
- `amount` greater than zero with at most two decimal places;
- `date` as a valid `YYYY-MM-DD` calendar date before today;
- trimmed `source` between 1 and 120 characters; and
- `monthly_total_conflict` when a month already uses `historical_total`, preventing mixed conventions.

Example preview response:

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

The client displays parsed amounts, dates, sources, and invalid rows before the user confirms. Confirmation creates only valid rows in one transaction, reuses an active same-name source or creates a custom source, and marks entries with `entry_method: "import"`. Confirming an already confirmed batch returns the same state without duplicates. Import has no minimum history of six or twelve months.

## 9. Income-pattern analysis

`GET /api/v1/income-pattern/` recalculates analysis from source records; no derived snapshot is stored. Monthly rows use `YYYY-MM`, and every monetary field is a two-decimal string.

```json
{
  "recorded_month_count": 2,
  "history_depth": "two_months",
  "provenance": "calculated_from_user_record",
  "monthly_work_cost_total": "750.00",
  "work_cost_basis": "current_active_monthly_snapshot",
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

`history_depth` is `empty`, `one_month`, `two_months`, or `three_or_more`. Empty records return `statistics: null`. With one month the factual statistics remain available, but `lower_income.months` stays empty because no comparison exists. With two or more months, all tied recorded minima are marked. Population standard deviation is calculated with `Decimal` and rounded `ROUND_HALF_UP` to two decimals.

Coverage uses explicit confirmation:

```json
{
  "answer": "yes",
  "slower_months": [1, 3, 8]
}
```

- `answer` is `yes`, `no`, or `not_sure`.
- `yes` requires at least one unique month from 1 through 12; the server sorts the list.
- `no` and `not_sure` clear `slower_months` regardless of submitted values.
- The response separates `represented_slower_months` and `unrepresented_slower_months` by comparing calendar month numbers across all recorded years.
- For `no` and `not_sure`, `observation` is either `null` or a factual `recorded_range` containing only month count, lowest, highest, and range.
- Coverage is isolated and persisted one-to-one per guest profile. Analysis results are not persisted.
- Transport validation, model validation, and the application service all enforce canonical slower months: integer values 1–12, unique, sorted, required for `yes`, and empty for `no`/`not_sure`. A malformed legacy row is returned fail-safe as an unknown answer rather than escaping the response contract.
- Stored income amounts retain their per-entry digit limit, while derived monetary response fields do not reuse that limit; valid same-month aggregates can therefore exceed one entry's maximum and still return a two-decimal string.

The API does not return prediction, stability, risk, or fixed-threshold conclusions.

## 10. Compatibility and change policy

- v1 may add optional fields and endpoints. Removing fields, changing types, or changing existing semantics is breaking.
- Breaking changes require a new version path and ADR.
- `/api/income/` and `/api/health/` are temporary compatibility aliases excluded from OpenAPI; new code must not use them.
- `/api/v1/dev/scenarios/` is disabled-by-default local test infrastructure, not part of the production v1 contract, and excluded from OpenAPI. See the [test-scenario document](testing/SCENARIO_GIG_DRIVER_12M.md) for safeguards.
- POST endpoints do not currently accept idempotency keys. The frontend disables duplicate submission while a request is pending; an idempotency protocol must precede offline synchronisation or automatic retries.

## 11. Maintenance

After changing a serializer, view, or URL, run:

```powershell
.\backend\.venv\Scripts\python.exe backend\manage.py spectacular --validate --file docs\openapi.yaml
```

Review and commit the generated file with the code change. Swagger UI is available at `/api/docs/`; ReDoc at `/api/redoc/`.
