# US2.2 acceptance record: Typical and extreme months

Language: **English** | [Chinese (CN)](US2.2_TYPICAL_AND_EXTREMES.cn.md)

| Acceptance criterion | Status | Implementation and evidence |
| --- | --- | --- |
| AC2.2.1 Display average income | Passed | The service returns the Decimal mean across completed months; the screen gives it primary visual emphasis. |
| AC2.2.2 Display median income | Passed | Odd and even completed-month counts use the sorted middle value(s). |
| AC2.2.3 Display highest income | Passed | The completed-month maximum is returned as a two-decimal string. |
| AC2.2.4 Display lowest income | Passed | The completed-month minimum is returned independently from any classification rule. |
| AC2.2.5 Identify calculated figures | Passed | Every statistic displays calculated provenance; the API returns `calculated_from_user_record`. |
| AC2.2.6 Explain variation | Passed | The screen explains variation with the recorded range and does not add a qualitative risk band. |
| AC2.2.7 Show the recorded range [v24] NEW | Passed | The range appears as its own labelled statistic, backed by the completed-month API result. |
| AC2.2.8 Show every recorded month [v24] NEW | Passed | Completed-month bars remain in a horizontal scroller; a visible hint appears when the chart is wider than its viewport. |

One and two completed months retain factual statistics with explicit limited-history text. The running month is excluded from all six statistics and appears separately as month so far. The fixed 12-month scenario verifies average `4437.50`, median `4385.00`, highest `5870.00`, lowest `3160.00`, range `2710.00`, and population standard deviation `699.16`.
