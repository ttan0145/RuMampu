# US2.4 acceptance record: Coverage check

Language: **English** | [Chinese (CN)](US2.4_COVERAGE_CHECK.cn.md)

| Acceptance criterion | Status | Implementation and evidence |
| --- | --- | --- |
| AC2.4.1 Ask about quieter periods | Passed | Coverage check opens with the approved question. |
| AC2.4.2 Provide three answer choices | Passed | Typed choices are `yes`, `no`, and `not_sure`, displayed as Yes, No, and Not sure. |
| AC2.4.3 Report only the quiet months that are genuinely missing [v24] AMENDED | Passed | The saved slower-month answer is compared with completed months; only selected months absent from that set appear in the gap callout. |
| AC2.4.4 Select multiple slower months | Passed | Multiple unique months remain selected and are sorted by the server. |
| AC2.4.5 Warn about uncovered slower months | Passed | The authoritative response lists `unrepresented_slower_months`, displayed as a warning after the answer is saved. |
| AC2.4.6 Confirm represented slower months | Passed | `represented_slower_months` are shown separately after successful confirmation. |
| AC2.4.7 Respond to No or Not sure | Passed | Both clear selected months and display completed-month facts only, with an explicit seasonal-representativeness limitation. |

The one-to-one `IncomeCoverage` row is guest isolated. Serializer, model, service, and database tests cover required selection, type, uniqueness, ordering, 1–12, clearing, fail-safe reads, persistence, cross-year calendar matching, and cross-guest isolation. The running month is returned separately and never represents a named slower month until it is complete. Playwright verifies one authoritative initial GET, disabled controls while loading, auto-save persistence, factual No/Not sure output, and failed-PUT behaviour that preserves both the last confirmed result and the retryable draft.
