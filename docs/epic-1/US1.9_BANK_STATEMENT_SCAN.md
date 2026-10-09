# US1.9 Bank Statement Income Scan Acceptance Record

Date: 2026-10-08  
Baseline: Epic 1 v7, AC1.9.1–AC1.9.5  
Current implementation: Groq income-image reading; dedicated pre-upload disclosure version `groq-statement-scan-2026-10-08-v1`

## Acceptance status

| AC | Result | Implementation and reviewable evidence |
|---|---|---|
| AC1.9.1 — Told before upload | Implemented; browser behavior remains unverified | A dedicated Groq disclosure appears before image selection. It names the processor, processing geography, retention exceptions and current ZDR state, with links to Groq's official data and DPA pages. Prior generic AI consent cannot bypass it. See `frontend/src/rumampu/assistant.tsx`, `state.tsx`, `persist.ts`, `strings.ts`, and `ai-disclosure.ts`. |
| AC1.9.2 — Transactions only | Implemented; API/backend tests cover the field allow-list; browser test not run | The Groq output schema, normalizer, and serializer constrain fields. The UI shows only date, amount, source, and confidence cues. Service/API tests cover rejection of extra model fields. A scan is capped at 20 income candidates. See `backend/finance/receipt_service.py`, `serializers.py`, and `frontend/src/rumampu/screens/money.tsx`. |
| AC1.9.3 — Review before save | Implemented; backend persistence boundary test passed; browser test not run | Results remain unsaved drafts. Missing dates are not replaced with today; missing-date and low-confidence rows start unchecked. A row must have a valid date, amount, and user-selected source, be selected, and be confirmed before persistence. Only selected rows are saved. |
| AC1.9.4 — Documented as a processor | Both plan supplements have been added and manually inspected; automated assertion not run | Codebase supplements to the Iteration 2 Security Risk & Privacy Plan and Data Management Plan both record Groq, transfer/processing geography, and retention. The Security Plan also records Global ZDR and Inference APIs ZDR as disabled. See the [Security Plan supplement](../privacy/ITERATION_2_SECURITY_RISK_PRIVACY_PLAN.cn.md) and [Data Management Plan supplement](../privacy/ITERATION_2_DATA_MANAGEMENT_PLAN.cn.md). |
| AC1.9.5 — Failure is not silent | Implemented; backend failure/no-persistence test passed; browser fallback test not run | A read failure is visible, states that nothing was saved, and offers an “Enter income manually” fallback. Browser verification of the error and manual-entry UI remains pending. |

## Acceptance limits

The planned Playwright flow uses an embedded 1×1 synthetic PNG and a controlled route response or error, but it did not reach test execution this turn. No real personal financial data was uploaded to Groq, and the online model was not called. Backend tests use a controlled Groq client substitute. The tests therefore verify the API field allow-list and persistence boundary; they do not establish real bank-statement recognition accuracy or live Groq end-to-end availability.

The current feature reads income/earnings rows. It does not claim PDF parsing, classification of all outflows, or import of every statement line. Users confirm transaction date, amount, and source; lender eligibility, affordability, and credibility assessments are neither imported nor displayed. For production processing and retention, see the [official Groq data policy](https://console.groq.com/docs/your-data) and [DPA](https://console.groq.com/docs/legal/customer-data-processing-addendum) cited by both plans: inference inputs/outputs are not retained by default; troubleshooting or abuse investigations may retain them for up to 30 days, longer when legally required; retained customer data is stored on US GCP, while processing may occur in the US and other operating countries. ZDR is not enabled for the current account, so zero retention is not promised.

## Verification command

```powershell
$env:PLAYWRIGHT_BACKEND_PORT = '18767'
$env:PLAYWRIGHT_FRONTEND_PORT = '18768'
npx playwright test e2e/epic1.spec.ts --grep '@us1\.9' --output ..\output\playwright\epic1-supervised\us1.9\final\test-results --reporter=line
```

Actual results: `npm run typecheck` passed; `node scripts/check-e2e-traceability.mjs` reported Epic 1 as 72 executable, 0 deferred; `backend/.venv/Scripts/python.exe manage.py test finance.test_receipt_scan --verbosity 2` passed 20 tests. Playwright only attempted isolated service startup: backend health returned 200, the frontend server did not become ready, and the run was stopped before test execution per scope direction. US1.9 browser acceptance is therefore unrun; see [run.log](../../output/playwright/epic1-supervised/us1.9/final/run.log). The coordinator will decide on integrated regression; mapping alone is not run evidence.
