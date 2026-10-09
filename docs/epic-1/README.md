# Epic 1 implementation and acceptance index

Language: **English** | [Chinese (CN)](README.cn.md)

Updated: 2026-10-08

Epic 1 uses the user story as the delivery unit and the acceptance criterion as the verification unit. A story is marked complete only when code, automated tests, real-interface acceptance, and affected documentation agree.

Current baseline matches v7: 9 stories and 72 criteria. The first 67 criteria previously passed a 13-test browser run. This turn implemented the US1.9 flow and privacy-plan supplements using the user's confirmed Groq path; 20 targeted backend tests passed. The US1.9 browser acceptance did not run because the frontend test server did not become ready. The synthetic flow does not certify recognition accuracy on real bank statements. The coordinator will finish the integrated Epic 1/2 regression. See the [2026-10-08 Epic 1 report](EPIC_1_COMPLETION_REPORT.md#current-v7-acceptance-overview).

| User story | AC count | Status | Acceptance record |
|---|---:|---|---|
| US1.1 Record income from different sources | 12 | Passed (12/12) | [US1.1 record](US1.1_RECORD_INCOME.md) |
| US1.2 Add historical income | 4 | Passed (4/4) | [US1.2 record](US1.2_HISTORICAL_INCOME.md) |
| US1.3 Record direct work-related costs | 13 | Passed (13/13; includes editing and bidirectional moves) | [US1.3 record](US1.3_WORK_COSTS.md) |
| US1.4 Record regular financial commitments | 6 | Passed (6/6; includes savings) | [US1.4 record](US1.4_COMMITMENTS.md) |
| US1.5 Record daily expenses manually | 8 | Passed (8/8) | [US1.5 record](US1.5_MANUAL_EXPENSES.md) |
| US1.6 Review recorded daily expenses | 6 | Passed (6/6) | [US1.6 record](US1.6_EXPENSE_REVIEW.md) |
| US1.7 Use a receipt as the starting point for an expense | 10 | Passed (10/10) | [US1.7 record](US1.7_RECEIPT_STARTING_POINT.md) |
| US1.8 Import historical financial records | 8 | Passed (8/8) | [US1.8 record](US1.8_HISTORICAL_IMPORT.md) |
| US1.9 Read a bank statement or e-statement into entries | 5 | Implemented; 20 focused backend tests passed; browser acceptance not run | [US1.9 acceptance record](US1.9_BANK_STATEMENT_SCAN.md) |

See the [formal Epic 1 US/AC snapshot](../requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md).
