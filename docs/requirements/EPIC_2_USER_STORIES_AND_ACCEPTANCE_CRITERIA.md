# Epic 2 user stories and acceptance criteria

Language: **English** | [Chinese (CN)](EPIC_2_USER_STORIES_AND_ACCEPTANCE_CRITERIA.cn.md)

- Epic: Income Pattern Analysis
- Scope: 4 user stories, 21 acceptance criteria
- Source snapshot: latest Epic 2 requirements in `TM16_RuMampu_User_Stories_and_Acceptance_Criteria_v7.docx`; AC2.1.1 and AC2.4.3 reflect their amended wording.

## US2.1 — View income month by month

**User story:** As a user with irregular income, I want to see my usable income across recorded months so that I can understand how much my income changes over time.

- **AC2.1.1 — View income month by month:** Given I have recorded income, when I open Income pattern, then it shows the latest saved income for each completed month.
- **AC2.1.2 — Display month labels:** Given multiple months are represented, When the chart is displayed, Then each bar is labelled with its recorded month.
- **AC2.1.3 — Reflect different monthly amounts:** Given my completed-month usable income differs, when I view the chart, then the different amounts are represented by different bar heights.

## US2.2 — Understand my typical and extreme income months

**User story:** As a user, I want summary statistics for my recorded income so that I can understand what a typical month looks like and how far my stronger and weaker months differ.

- **AC2.2.1 — Display average income:** Given completed monthly income exists, when I open Income pattern, then RuMampu displays its average usable income.
- **AC2.2.2 — Display median income:** Given completed monthly income exists, when I review the income summary, then RuMampu displays the median usable income.
- **AC2.2.3 — Display highest income:** Given completed monthly income exists, when I review the income summary, then the highest completed month's usable income is displayed.
- **AC2.2.4 — Display lowest income:** Given completed monthly income exists, when I review the income summary, then the lowest completed month's usable income is displayed.
- **AC2.2.5 — Identify calculated figures:** Given the income statistics are derived from my record, when they are displayed, then they are identified as calculated values.
- **AC2.2.6 — Explain variation:** Given the income pattern contains differences between months, When I view the income-pattern explanation, Then RuMampu communicates the degree of variation using the visible recorded range information.
- **AC2.2.7 — Show the recorded range [v24] NEW:** Given more than one month is recorded, When I view Income pattern, Then the median, highest, lowest and the recorded range are each stated as their own row.
- **AC2.2.8 — Show every recorded month [v24] NEW:** Given more months are recorded than fit across the screen, When I view the month-by-month chart, Then the chart scrolls sideways and says so, rather than dropping months.

## US2.3 — Identify lower-income months

**User story:** As a user, I want RuMampu to identify weaker income months within my recorded history so that I can distinguish them from more typical months.

- **AC2.3.1 — Use the RuMampu low income rule:** Given at least two completed months exist, when I view my income pattern, then RuMampu identifies every month tied at the lowest recorded usable income without a fixed threshold.
- **AC2.3.2 — Explain how lower income months are identified:** Given RuMampu identifies a lower-income month, When I view its explanation, Then it says the month is the lowest usable-income month in my current record and that this is not a financial standard or a prediction.
- **AC2.3.3 — Leave the unfinished month out of the count [v24] NEW:** Given today is within a running month, when RuMampu counts months for the house test and quiet-month analysis, then it excludes that unfinished month and shows its saved amount separately as “month so far”.

## US2.4 — Check whether my recorded history covers normally slower periods

**User story:** As a user whose income may vary during the year, I want to identify months when I usually earn less so that I can see whether my current record includes those periods.

- **AC2.4.1 — Ask about quieter periods:** Given I open Coverage check, when the screen loads, then I am asked whether there are times of year when I usually earn less.
- **AC2.4.2 — Provide three answer choices:** Given I am answering the coverage question, when I view the response options, then I can choose Yes, No, or Not sure.
- **AC2.4.3 — Report only the quiet months that are genuinely missing [v24] AMENDED:** Given I identify months when I usually earn less, When coverage is evaluated, Then RuMampu reports only those months that are not in my recorded history.
- **AC2.4.4 — Select multiple slower months:** Given more than one month is usually slower, when I select those months, then multiple months can remain selected.
- **AC2.4.5 — Warn about uncovered slower months:** Given I identify a normally slower month, When it is not in my recorded history, Then RuMampu displays the warning “You said Mar is usually slower, but your record only runs Jan to Aug.”
- **AC2.4.6 — Confirm represented slower months:** Given I identify a normally slower month, when it exists in completed history, then the interface can indicate that the selected slower period is represented.
- **AC2.4.7 — Respond to No or Not sure:** Given I answer No or Not sure, When RuMampu evaluates my recorded months, Then the interface displays an observation about the month-to-month variation in my record.

## Reconciled calculation boundaries

- Usable income is each month's gross income minus the work-cost entries recorded in that same calendar month.
- The running calendar month is returned separately as month so far. It is excluded from completed-month counts, statistics, lower-income classification, coverage, and the house test.
- The response exposes average, median, highest, lowest, range, and population standard deviation from completed months. One or two completed months remain visible with an explicit limited-history note.
- Lower income means every tied recorded minimum when at least two completed months exist. It is not a prediction or financial standard.
- Coverage compares user-declared slower calendar months with completed recorded calendar months. `No` and `Not sure` expose only the factual completed-month range and cannot establish seasonal representativeness.
- Income pattern is recomputed whenever the screen is opened. Coverage is refreshed after income is recorded, so a named slower month moves from unrepresented to represented without asking the user to resubmit the answer.
- Fixed-percentage rules, coefficient-of-variation scoring, unsupported thresholds, and Low/Moderate/High risk labels are outside the approved calculation boundary.
