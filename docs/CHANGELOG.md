# Project changelog

Language: **English** | [Chinese (CN)](CHANGELOG.cn.md)

## 2026-08-25 — Epic 1 full-stack completion

Status: complete locally; waiting for owner approval before commit or push

### Delivered

- Established a Django REST Framework modular backend with `/api/v1`, consistent errors, OpenAPI, Swagger/ReDoc, and eight database migrations.
- Completed all eight Epic 1 user stories and 56/56 acceptance criteria:
  - multi-source income, outlier confirmation, and guest persistence;
  - historical monthly income and month-level consistency rules;
  - work costs and three groups of regular financial commitments;
  - manual expenses, expense review, and monthly summaries;
  - receipt starting point, human review, and confirmed saving; and
  - historical-income CSV preview, invalid rows, and confirmed import.
- Connected the Expo frontend to income, work-cost, commitment, expense, and import APIs while retaining English, Bahasa Melayu, and Chinese localisation. English remains the default.
- Extracted and archived searchable requirement snapshots for all 8 Epics/35 user stories/219 acceptance criteria and Epic 1's 8 user stories/56 acceptance criteria.
- Adopted an English-default documentation policy. Chinese documentation is retained under explicit `.cn.md` filenames.

### Tests and acceptance

- Backend `finance` suite: 58 tests passed.
- Frontend TypeScript check passed.
- Migration drift check, OpenAPI generation and validation, and `git diff --check` passed.
- US1.1–US1.8 each have real Playwright browser-acceptance evidence.
- Added the disabled-by-default `my-gig-driver-12m` scenario: approximately 114 ms to create 12 months, 60 income entries, and 240 expenses; income patterns, complete expense months, housing tests, and Epic 5 reuse were verified.

### Notable fixes

- Fixed a session-initialisation race during frontend startup that could create multiple guest profiles for the initial parallel requests.
- Income sources and expense categories prevent isolated accidental deletion while still allowing a guest profile to be deleted as a complete cascade.
- Income imports and receipt-based saves require explicit confirmation; unconfirmed data never becomes a financial fact.

### Current boundaries

- Receipt reading remains a prototype starting point. It does not claim production OCR and does not upload or retain the source image.
- CSV is the only historical import format. XLSX, PDF, bank connections, and automatic column mapping are not implemented.
- User accounts, cross-device synchronisation, and production retention/deletion policies remain future work.
- Epics 2 and 5 can reuse the financial model and deterministic scenario, but their business rules still require delivery against their formal user stories and acceptance criteria.
