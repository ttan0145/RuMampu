# Epic 2 user stories and acceptance criteria

Language: **English** | [Chinese (CN)](EPIC_2_USER_STORIES_AND_ACCEPTANCE_CRITERIA.cn.md)

- Epic: Income Pattern Analysis
- Scope: 4 user stories, 18 acceptance criteria
- Source snapshot: `TM16_RuMampu_Project_Report.xlsx`, reconciled with the Calculation Spec and Boundaries sheets on 2026-08-25

## US2.1 — View income month by month

**User story:** As a user with irregular income, I want to see my usable income across recorded months so that I can understand how much my income changes over time.

- **AC2.1.1 — Display monthly income chart:** Given I have income recorded across one or more months, when I open Income pattern, then a month-by-month visualisation of my recorded income is displayed.
- **AC2.1.2 — Display month labels:** Given multiple months are represented, when the chart is displayed, then each displayed bar corresponds to a labelled recorded month.
- **AC2.1.3 — Reflect different monthly amounts:** Given my recorded monthly income differs between months, when I view the chart, then the different amounts are represented by different bar heights.

## US2.2 — Understand my typical and extreme income months

**User story:** As a user, I want summary statistics for my recorded income so that I can understand what a typical month looks like and how far my stronger and weaker months differ.

- **AC2.2.1 — Display average income:** Given recorded monthly income exists, when I open Income pattern, then RuMampu displays an average income figure.
- **AC2.2.2 — Display median income:** Given recorded monthly income exists, when I review the income summary, then RuMampu displays the median recorded income.
- **AC2.2.3 — Display highest income:** Given recorded monthly income exists, when I review the income summary, then the highest recorded monthly income is displayed.
- **AC2.2.4 — Display lowest income:** Given recorded monthly income exists, when I review the income summary, then the lowest recorded monthly income is displayed.
- **AC2.2.5 — Identify calculated figures:** Given the income statistics are derived from my record, when they are displayed, then they are identified as calculated values.
- **AC2.2.6 — Explain variation:** Given the income pattern contains differences between months, when I view the income-pattern explanation, then RuMampu communicates the degree of variation using visible recorded-range information.

## US2.3 — Identify lower-income months

**User story:** As a user, I want RuMampu to identify weaker income months within my recorded history so that I can distinguish them from more typical months.

- **AC2.3.1 — Use the recorded-history rule:** Given recorded monthly income exists, when I view my income pattern, then RuMampu can identify lower-income months from the recorded history without a fixed percentage threshold.
- **AC2.3.2 — Explain the identification:** Given RuMampu identifies a lower-income month, when I view the explanation, then the interface explains that the result is based on my recorded history and is not a financial standard.

## US2.4 — Check whether my recorded history covers normally slower periods

**User story:** As a user whose income may vary during the year, I want to identify months when I usually earn less so that I can see whether my current record includes those periods.

- **AC2.4.1 — Ask about quieter periods:** Given I open Coverage check, when the screen loads, then I am asked whether there are times of year when I usually earn less.
- **AC2.4.2 — Provide three answer choices:** Given I am answering the coverage question, when I view the response options, then I can choose Yes, No, or Not sure.
- **AC2.4.3 — Select slower months:** Given I answer Yes, when RuMampu asks which months are usually slower, then all twelve months are available for selection.
- **AC2.4.4 — Select multiple slower months:** Given more than one month is usually slower, when I select those months, then multiple months can remain selected.
- **AC2.4.5 — Warn about uncovered slower months:** Given I identify a normally slower month, when that month is not represented in my current recorded history, then RuMampu warns that the record has not covered that slower month.
- **AC2.4.6 — Confirm represented slower months:** Given I identify a normally slower month, when that month exists in the recorded history, then the interface can indicate that the selected slower period is represented.
- **AC2.4.7 — Respond to No or Not sure:** Given I answer No or Not sure, when RuMampu evaluates the visible spread of my recorded months, then the interface displays a factual observation based on the variation currently present in the record.

## Reconciled calculation boundaries

- Usable income is monthly gross income minus the current active monthly work-cost total.
- The response exposes average, median, highest, lowest, range, and population standard deviation. One or two recorded months remain visible with an explicit limited-history note.
- Lower income means the tied recorded minimum when at least two months exist. It is not a prediction or financial standard.
- Coverage compares user-declared slower calendar months with recorded calendar months. `No` and `Not sure` expose only the factual recorded range and cannot establish seasonal representativeness.
- Fixed-percentage rules, coefficient-of-variation scoring, unsupported thresholds, and Low/Moderate/High risk labels are outside the approved calculation boundary.
