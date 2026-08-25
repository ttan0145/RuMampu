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

Current work-cost amounts represent monthly costs. The frontend subtracts all active work costs from each recorded month's income and labels the result as calculated.

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

## 9. Compatibility and change policy

- v1 may add optional fields and endpoints. Removing fields, changing types, or changing existing semantics is breaking.
- Breaking changes require a new version path and ADR.
- `/api/income/` and `/api/health/` are temporary compatibility aliases excluded from OpenAPI; new code must not use them.
- `/api/v1/dev/scenarios/` is disabled-by-default local test infrastructure, not part of the production v1 contract, and excluded from OpenAPI. See the [test-scenario document](testing/SCENARIO_GIG_DRIVER_12M.md) for safeguards.
- POST endpoints do not currently accept idempotency keys. The frontend disables duplicate submission while a request is pending; an idempotency protocol must precede offline synchronisation or automatic retries.

## 10. Maintenance

After changing a serializer, view, or URL, run:

```powershell
.\backend\.venv\Scripts\python.exe backend\manage.py spectacular --validate --file docs\openapi.yaml
```

Review and commit the generated file with the code change. Swagger UI is available at `/api/docs/`; ReDoc at `/api/redoc/`.
