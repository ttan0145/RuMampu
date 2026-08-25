# US2.4 acceptance record: Coverage check

Language: **English** | [Chinese (CN)](US2.4_COVERAGE_CHECK.cn.md)

| Acceptance criterion | Status | Implementation and evidence |
| --- | --- | --- |
| AC2.4.1 Ask about quieter periods | Passed | Coverage check opens with the approved question. |
| AC2.4.2 Provide three answer choices | Passed | Typed choices are `yes`, `no`, and `not_sure`, displayed as Yes, No, and Not sure. |
| AC2.4.3 Select slower months | Passed | Choosing Yes exposes all calendar months 1–12. |
| AC2.4.4 Select multiple slower months | Passed | Multiple unique months remain selected and are sorted by the server. |
| AC2.4.5 Warn about uncovered slower months | Passed | The authoritative response lists `unrepresented_slower_months`, displayed as a warning after Check coverage succeeds. |
| AC2.4.6 Confirm represented slower months | Passed | `represented_slower_months` are shown separately after successful confirmation. |
| AC2.4.7 Respond to No or Not sure | Passed | Both clear selected months and display only count, lowest, highest, and recorded range, with an explicit seasonal-representativeness limitation. |

The one-to-one `IncomeCoverage` row is guest isolated. Serializer, model, service, and database tests cover required selection, type, uniqueness, ordering, 1–12, clearing, fail-safe reads, persistence, cross-year calendar matching, and cross-guest isolation. Playwright verifies one authoritative initial GET, disabled controls while loading, explicit Check, refresh persistence, factual No/Not sure output, and failed-PUT behaviour that preserves both the last confirmed result and the retryable draft.
