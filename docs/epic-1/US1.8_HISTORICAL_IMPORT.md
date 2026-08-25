# US1.8 acceptance record: Import historical financial records

Language: **English** | [Chinese (CN)](US1.8_HISTORICAL_IMPORT.cn.md)

- Acceptance date: 2026-08-25
- Status: complete (8/8 AC)
- Requirement: [US1.8 — Import historical financial records](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md#us18---import-historical-financial-records)

## Acceptance matrix

| Acceptance criterion | Status | Implementation and acceptance evidence |
|---|---|---|
| AC1.8.1 Access historical import | Passed | Income provides `Import income from CSV`; the import screen accepts a supported CSV through the system document picker. See the [entry screen](../../output/playwright/us1.8/01-import-start.png). |
| AC1.8.2 Import historical income records | Passed | The backend reads UTF-8 CSV and persists a preview batch with parsed rows for review before confirmation. |
| AC1.8.3 Preview imported records | Passed | The preview shows amount, date, source, and raw values. All three valid rows in the acceptance file can be inspected individually. |
| AC1.8.4 Confirm imported records | Passed | `Confirm and add 3 records` transactionally creates the three valid rows with `entry_method=import` and shows the result. |
| AC1.8.5 Include imported periods in analysis | Passed | Income pattern shows May/Jun and mean RM1,275. The housing test uses the same two months and returns `1 of 2`. See the [income pattern](../../output/playwright/us1.8/03-income-pattern.png) and [housing result](../../output/playwright/us1.8/04-housing-result.png). |
| AC1.8.6 Allow import with limited history | Passed | Acceptance imports only two months. The API returns `recorded_month_count=2` and analysis continues without a six- or twelve-month minimum. |
| AC1.8.7 Handle records that cannot be recognised | Passed | Invalid amount and date rows show their row numbers, raw values, and specific errors and are not silently stored; see the [preview with invalid rows](../../output/playwright/us1.8/02-preview-with-errors.png). |
| AC1.8.8 Do not add imported records without confirmation | Passed | After preview but before confirmation, Playwright reads the same session and receives exactly `entries=0` and `recorded_month_count=0`. |

## File and confirmation protocol

- Supported input is UTF-8 `.csv` with required `amount,date,source` columns, at most 2 MB and 1,000 data rows.
- Amounts are positive with no more than two decimal places; dates are valid calendar days before today; source is non-empty and no longer than 120 characters.
- Preview creates `IncomeImportBatch` and `IncomeImportRow`, not income facts.
- Confirm imports only valid rows, reuses an active same-name source or creates a custom source, and is repeat-safe for the same batch.
- If a month already uses a historical monthly total, the row is marked as a conflict to prevent mixing itemised and whole-month conventions.

## Automated and browser acceptance

- Backend `finance` suite: 51 tests passed. Import coverage includes no persistence during preview, invalid rows, confirmation, limited history, custom sources, repeated confirmation, guest isolation, file limits, monthly-total conflicts, and guest cascade deletion.
- Frontend TypeScript check passed.
- Playwright used a real file picker with five sample rows: three valid and two invalid. Counts changed from zero before confirmation to three entries, two months, and RM2,550 after confirmation.
- After reload, the API still returned three entries, two months, and RM2,550, proving persistence rather than transient frontend state.
- The final browser console had zero errors; only Expo Web's development animation-driver warning appeared.
- Local guest, batch, row, income, and session data were removed after acceptance, and development servers were stopped.

## Non-goals

- XLSX, PDF, images, bank-specific templates, and automatic column mapping are unsupported and require separate parsing and acceptance scope.
- Import is a historical-income entry point, not a bank connection, cross-device synchronisation, or identity system.
- Invalid rows are never guessed or silently corrected, so unreliable parsing cannot become a financial fact.
