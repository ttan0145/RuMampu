# US1.7 acceptance record: Use a receipt as the starting point for an expense

Language: **English** | [Chinese (CN)](US1.7_RECEIPT_STARTING_POINT.cn.md)

- Acceptance date: 2026-08-25
- Status: complete (10/10 AC)
- Requirement: [US1.7 — Use a receipt as the starting point for an expense](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md#us17---use-a-receipt-as-the-starting-point-for-an-expense)

## Acceptance matrix

| Acceptance criterion | Status | Implementation and acceptance evidence |
|---|---|---|
| AC1.7.1 Select a receipt image | Passed | Scan a receipt provides `Take a photo`, `Choose a photo`, and a deterministic sample-receipt entry for acceptance; see the [selection screen](../../output/playwright/epic-1/evidence/ac1.7.1_ac1.7.9__receipt-selection.png). |
| AC1.7.2 Show receipt-reading state | Passed | Selecting the sample displays a shimmer and `Reading the receipt…`; Playwright captured the visible 1.4-second reading stage and [screenshot](../../output/playwright/epic-1/evidence/ac1.7.2__receipt-reading.png). |
| AC1.7.3 Present values for confirmation | Passed | The completed preview shows merchant, date, total, and category and explicitly asks for review before saving. |
| AC1.7.4 Display receipt-derived merchant | Passed | Shop carries `FROM RECEIPT`; the initial merchant is `Kedai Runcit Maju`. |
| AC1.7.5 Display receipt-derived date | Passed | Date carries `FROM RECEIPT` and remains editable. |
| AC1.7.6 Display receipt-derived total | Passed | Total (RM) carries `FROM RECEIPT` and remains editable. |
| AC1.7.7 Choose an expense category | Passed | The review displays every API category; acceptance changed Groceries to Meals. |
| AC1.7.8 Edit before saving | Passed | Merchant became `Kedai Maju edited`, date 2026-08-25, and total RM35.20; see the [edited review](../../output/playwright/epic-1/evidence/ac1.7.3-8__receipt-review-edited.png). |
| AC1.7.9 Retake receipt | Passed | Retake returns to photo/file selection. At that point, the API still has zero expenses. |
| AC1.7.10 Save the confirmed expense | Passed | Add saves `entry_method=receipt`, `merchant=Kedai Maju edited`, and `user_confirmed=true`. After refresh, 25 Aug · Meals · RM35.20 remains; see the [persisted expense](../../output/playwright/epic-1/evidence/ac1.7.10__confirmed-receipt-after-reload.png). |

## Automated and browser acceptance

- Backend `finance` suite: 42 tests passed, adding confirmed receipt-metadata persistence and rejection of unconfirmed receipt data without creating a record.
- Frontend TypeScript check passed.
- Real Playwright acceptance verified selection, reading, review, editing, category choice, Retake, no pre-confirmation persistence, confirmed saving, and refresh persistence.
- The final API record returns exactly RM35.20, 2026-08-25, Meals, `receipt`, the edited merchant, and human-confirmed status.
- The final browser console had no product errors; only Expo Web's development animation-driver warning appeared.
- Local acceptance data and remaining development-server processes were cleaned after verification.

## Prototype and privacy boundary

- The formal criteria explicitly describe a prototype. This implementation provides a visible reading state and sample parsed result; it does not claim production OCR.
- A captured or selected image is used only for the current client preview. This package does not upload or retain the original receipt image before retention/deletion policy exists.
- No financial fact is created before Add. The backend also requires `confirm_receipt=true`, preventing an unconfirmed request from bypassing review.
- The persisted values are those reviewed by the user, with `entry_method=receipt` and `user_confirmed=true` preserving provenance.
