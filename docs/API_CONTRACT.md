# RuMampu API contract

Language: **English** | [Chinese (CN)](API_CONTRACT.cn.md)

- Status: v1 baseline
- Base path: `/api/v1/`
- Machine-readable version: [openapi.yaml](openapi.yaml)

## 1. General conventions

- Ordinary requests and responses use UTF-8 JSON; file-upload endpoints use `multipart/form-data`.
- JSON fields use `snake_case`.
- Primary resource IDs are integers; public guest IDs are UUIDs.
- Finance-domain monetary responses use two-decimal strings such as `"777.25"`; the existing housing numeric-response exception is documented in section 10. Clients must not perform authoritative calculations with binary floating point.
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
| PATCH | `/api/v1/income/entries/{id}/` | Update one itemised or historical income entry |
| DELETE | `/api/v1/income/entries/{id}/` | Delete one current-guest income entry |
| POST | `/api/v1/income-imports/preview/` | Upload CSV and create a row preview without income entries |
| GET | `/api/v1/income-imports/{id}/` | Read the current guest's import batch and row results |
| POST | `/api/v1/income-imports/{id}/confirm/` | Confirm a batch and create recognised historical entries |
| GET | `/api/v1/work-costs/` | Current guest's active work-cost categories |
| POST | `/api/v1/work-costs/` | Create a custom work-cost category |
| GET, POST | `/api/v1/work-costs/entries/` | List or create dated work-cost entries |
| PATCH | `/api/v1/work-costs/entries/{id}/` | Update one dated work-cost entry |
| GET | `/api/v1/work-costs/summary/?month=YYYY-MM` | Calculate the selected month's factual work-cost summary |
| GET | `/api/v1/commitments/` | Current guest's active financial commitments |
| PATCH | `/api/v1/commitments/{id}/` | Update one commitment's monthly amount |
| GET | `/api/v1/expense-categories/` | Current guest's active expense categories |
| POST | `/api/v1/expense-categories/` | Create a custom expense category |
| GET | `/api/v1/expenses/` | Current guest's daily expenses |
| POST | `/api/v1/expenses/` | Create a daily expense manually or from confirmed receipt values |
| GET | `/api/v1/income-pattern/` | Recalculate the current guest's month-by-month income pattern |
| GET | `/api/v1/income-coverage/` | Read the current guest's confirmed slower-period coverage answer |
| PUT | `/api/v1/income-coverage/` | Confirm and evaluate a slower-period coverage answer |
| POST | `/api/v1/housing/calculate/` | Calculate financing, instalment, and total monthly housing cost |
| POST | `/api/v1/housing/pre-check/` | Evaluate the current guest record before housing costs |
| GET/POST | `/api/v1/housing/scenarios/` | List or create current-owner housing scenarios |
| GET/PUT/PATCH/DELETE | `/api/v1/housing/scenarios/{id}/` | Read, update, or delete a housing scenario |
| POST | `/api/v1/housing/test-result/` | Test a current-owner scenario against the authoritative finance record |

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

`DELETE /api/v1/income/entries/{id}/` removes only the current guest's selected entry and returns `204`; a missing or other-guest entry returns `404`. If it was the month's last income entry, the now-empty financial period is removed while dated work-cost entries remain. Work-cost, income-pattern, and coverage views must then refresh from the updated record.

## 5. Work costs

Default and custom work-cost categories are independent resources. The frontend localises defaults by stable `slug`; custom categories use the user-provided `name`. Categories do not carry an ongoing monetary amount.

The read-only `legacy_monthly_amount` field continues to preserve the former undated estimate for review. Following the user-approved UI adjustment, the Work costs screen no longer displays the legacy notice or amounts. These values remain excluded from calculations and are never automatically converted into dated entries.

Create a custom category:

```json
{
  "name": "Equipment rental"
}
```

Create a dated entry:

```json
{
  "category_id": 1,
  "amount": "200.00",
  "date": "2026-09-02"
}
```

`amount` must be greater than zero and `date` cannot be in the future. Multiple entries with the same category and month remain separate facts. `PATCH /api/v1/work-costs/entries/{id}/` may change `category_id`, `amount`, or `date`; it updates only that entry. Guest isolation applies to categories and entries.

`GET /api/v1/work-costs/summary/?month=2026-09` returns the selected month, its recorded gross income, its recorded work-cost total, and `income_after_work_costs` only when income exists for that month. It also returns `available_months`, containing the current month and months that have income or work-cost records. The calculation is `gross income for YYYY-MM − work-cost entries dated in the same YYYY-MM`; no entry becomes a recurring monthly deduction, and no cross-month average is substituted.

Omitting `month` uses the server's current local calendar month. If supplied, it must be exact ASCII `YYYY-MM`, with year 0001–9999 and month 01–12; blank, whitespace, non-padded, and year-zero inputs return a field-level 400 error. No-income results use `null`, not zero; zero and negative calculated results are preserved. A client must not display an old result under a new month while loading or after a failed refresh.

A confirmed POST/PATCH response is a successful write even if the follow-up GET fails. Apply the confirmed record, clear the submitted draft, and offer a GET-only refresh. Never retry POST automatically. A lost POST response is still ambiguous because v1 has no idempotency keys; reconcile the list before manually re-entering a payment.

Release gate: this worktree changes the former v1 category/monthly-amount contract and the analysis basis. It is not a backward-compatible deployment. A versioned API/migration rollout is still required by section 11 before releasing to existing clients; local test success does not waive that gate.

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

## 10. Housing integration

Housing scenario requests use the same credentialed Django session as the finance APIs. An anonymous scenario belongs to the current `GuestProfile`; an authenticated scenario belongs to its user. List, detail, update, and delete operations never query a global pool of `user = null` rows. Each additional-cost category must be unique within a scenario.

The authoritative pre-housing request is an empty JSON object:

```json
{}
```

The backend reads the session-owned income entries, dated work-cost entries, current active commitments, and confirmed expenses. It reuses the Epic 2 month aggregation and work-cost basis. Older v1 clients may still send `income`, `work_costs`, `commitments`, and `expenses`; those optional transport fields are accepted but ignored so client state cannot replace persisted facts.

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

Housing services use `Decimal` internally and round monetary outputs half-up. The housing endpoints retain their existing numeric JSON response fields during v1 compatibility; finance-domain monetary responses continue to use two-decimal strings.

`POST /api/v1/housing/calculate/` also returns the authoritative `upfront_required`, echoed `cash_on_hand`, and `upfront_gap` when the client supplies `upfront_costs` and `cash_on_hand`. These are derived display results and are not persisted as scenario facts.

The formal housing-test flow is:

1. create or update the current-owner `/housing/scenarios/` resource;
2. request `/housing/pre-check/` for the navigation decision; and
3. submit its `scenario_id` to `/housing/test-result/` for the displayed historical result.

The test-result request may include `tested_monthly_home_cost` for a non-persisted payment comparison and `income_shock_percent` from 0 through 90 for a hypothetical income-drop case. Both reuse the saved scenario's rate, tenure, deposit, additional costs, and the backend finance record. They do not mutate the scenario. The response includes the tested monthly result, shortfalls, carrying range, indicative price conversion, and `starting_liquidity` path.

`POST /api/v1/housing/test/` remains a compatibility endpoint for older stateless clients. The formal frontend does not call it and does not submit a client-derived copy of financial months.

## 11. Compatibility and change policy

- v1 may add optional fields and endpoints. Removing fields, changing types, or changing existing semantics is breaking.
- Breaking changes require a new version path and ADR.
- `/api/income/` and `/api/health/` are temporary compatibility aliases excluded from OpenAPI; new code must not use them.
- `/api/v1/dev/scenarios/` is disabled-by-default local test infrastructure, not part of the production v1 contract, and excluded from OpenAPI. See the [test-scenario document](testing/SCENARIO_GIG_DRIVER_12M.md) for safeguards.
- POST endpoints do not currently accept idempotency keys. The frontend disables duplicate submission while a request is pending; an idempotency protocol must precede offline synchronisation or automatic retries.

## 12. Maintenance

After changing a serializer, view, or URL, run:

```powershell
.\backend\.venv\Scripts\python.exe backend\manage.py spectacular --validate --file docs\openapi.yaml
```

Review and commit the generated file with the code change. Swagger UI is available at `/api/docs/`; ReDoc at `/api/redoc/`.
