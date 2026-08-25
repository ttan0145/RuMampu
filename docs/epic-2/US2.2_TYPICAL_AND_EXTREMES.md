# US2.2 acceptance record: Typical and extreme months

Language: **English** | [Chinese (CN)](US2.2_TYPICAL_AND_EXTREMES.cn.md)

| Acceptance criterion | Status | Implementation and evidence |
| --- | --- | --- |
| AC2.2.1 Display average income | Passed | The service returns the Decimal mean; the screen gives it primary visual emphasis. |
| AC2.2.2 Display median income | Passed | Odd and even month counts use the sorted middle value(s). |
| AC2.2.3 Display highest income | Passed | The recorded maximum is returned as a two-decimal string. |
| AC2.2.4 Display lowest income | Passed | The recorded minimum is returned independently from any classification rule. |
| AC2.2.5 Identify calculated figures | Passed | Every statistic displays calculated provenance; the API returns `calculated_from_user_record`. |
| AC2.2.6 Explain variation | Passed | The screen shows the recorded range and population standard deviation without a qualitative band. |

One and two months retain factual statistics with explicit limited-history text. The fixed 12-month scenario verifies average `4437.50`, median `4385.00`, highest `5870.00`, lowest `3160.00`, range `2710.00`, and population standard deviation `699.16`.
