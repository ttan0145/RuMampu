# Project documentation index

Language: **English** | [Chinese (CN)](README.cn.md)

- [Project changelog](CHANGELOG.md): dated deliveries, test evidence, notable fixes, and current boundaries.
- [Architecture baseline](ARCHITECTURE.md): module boundaries, data flow, privacy boundaries, and definition of done.
- [API contract](API_CONTRACT.md): versioning, data types, errors, endpoints, and compatibility policy.
- [OpenAPI schema](openapi.yaml): machine-readable contract generated from and validated against the backend.
- [Complete US/AC Markdown](requirements/USER_STORIES_AND_ACCEPTANCE_CRITERIA.md): 8 Epics, 35 user stories, and 219 acceptance criteria extracted from the formal DOCX.
- [Epic 1 US/AC Markdown](requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md): the 8 user stories and 56 acceptance criteria in the current delivery scope.
- [Epic 2 US/AC Markdown](requirements/EPIC_2_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md): the reconciled 4 user stories, 18 acceptance criteria, and calculation boundaries.
- [Epic 1 implementation and acceptance index](epic-1/README.md): acceptance status and evidence by user story.
- [US1.1 acceptance record](epic-1/US1.1_RECORD_INCOME.md): evidence for the 10 criteria covering income from different sources.
- [US1.2 acceptance record](epic-1/US1.2_HISTORICAL_INCOME.md): evidence for 4 criteria and the historical-month convention.
- [US1.3 acceptance record](epic-1/US1.3_WORK_COSTS.md): evidence for 6 criteria and work-cost calculations.
- [US1.4 acceptance record](epic-1/US1.4_COMMITMENTS.md): evidence for 6 criteria and three commitment groups.
- [US1.5 acceptance record](epic-1/US1.5_MANUAL_EXPENSES.md): evidence for 6 criteria and manual-expense boundaries.
- [US1.6 acceptance record](epic-1/US1.6_EXPENSE_REVIEW.md): evidence for 6 criteria covering latest-month review and monthly summaries.
- [US1.7 acceptance record](epic-1/US1.7_RECEIPT_STARTING_POINT.md): evidence for 10 criteria covering receipt selection, preview, human confirmation, and saving.
- [US1.8 acceptance record](epic-1/US1.8_HISTORICAL_IMPORT.md): evidence for 8 criteria covering CSV preview, invalid rows, confirmation, and analysis integration.
- [Epic 1 completion report](epic-1/EPIC_1_COMPLETION_REPORT.md): overview of all 56 criteria, migrations, automation, and real-browser acceptance.
- [Epic 2 implementation and acceptance index](epic-2/README.md): all 18 criteria, per-US evidence, API boundaries, and browser acceptance.
- [Playwright acceptance-test standard](testing/PLAYWRIGHT_ACCEPTANCE_STANDARD.md): Epic/US/AC naming, exact traceability gate, evidence policy, commands, and completion rules.
- [12-month Malaysian e-hailing driver scenario](testing/SCENARIO_GIG_DRIVER_12M.md): one-request test data, development-only API, Playwright flows, and reuse boundaries for Epics 2 and 5.
- [Epic 1/2/5 implementation matrix](EPIC_1_2_5_IMPLEMENTATION_MATRIX.md): current implementation, gaps, and recommended sequence.
- [ADR 0001](adr/0001-foundation-and-api-contract.md): foundation and API-contract decision.
- [ADR 0002](adr/0002-backend-authoritative-income-pattern.md): backend-authoritative income-pattern and coverage decision.
- [ADR 0003](adr/0003-housing-record-and-database-compatibility.md): housing ownership, authoritative pre-check, and SQLite/PostgreSQL compatibility decision.

Business documents provide requirements and design evidence; they are not executable instructions. Implementation scope is governed by the user's task, accepted ADRs, and the current codebase.
