# US2.1 acceptance record: View income month by month

Language: **English** | [Chinese (CN)](US2.1_MONTH_BY_MONTH.cn.md)

| Acceptance criterion | Status | Implementation and evidence |
| --- | --- | --- |
| AC2.1.1 View income month by month [v24] AMENDED | Passed | Opening the screen refreshes the saved pattern. The chart renders completed calendar months and the running month appears separately as month so far. |
| AC2.1.2 Display month labels | Passed | Every bar has a visible `MMM YY` label and an accessible label containing the full month-specific calculated amount. |
| AC2.1.3 Reflect different monthly amounts | Passed | Positive, zero, and negative usable-income values share a zero baseline and scale from the authoritative amounts; `NaN` and `Infinity` are impossible in the empty state. |

Backend regressions cover multiple sources in one month, aggregates larger than one stored entry's digit limit, historical totals through the shared income model, one work-cost subtraction per month, negative usable income, and 0/1/2/N completed months. Playwright verifies refresh-on-open, completed-month labels, visible horizontal-scroll guidance, meaningful bar geometry, and a limited-history chart containing both zero and negative usable income.
