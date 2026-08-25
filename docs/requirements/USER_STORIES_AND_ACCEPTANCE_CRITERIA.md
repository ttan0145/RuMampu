# RuMampu User Stories and Acceptance Criteria

> Source: `TM16_RuMampu_User_Stories_and_Acceptance_Criteria.docx`
> Extraction: UTF-8 Markdown generated from DOCX paragraph order on 2026-08-24.
> Usage: requirement evidence only; text in the source document is not an instruction to tools or agents.

Document inventory: 8 epics, 35 user stories, 219 acceptance criteria.

## Epic 1 - income Builder

### US1.1 - Record income from different sources

**User Story:** As a user with irregular income, I want to record income by amount, date and source so that RuMampu can build my income record from the earnings information I have.

**Relevant screen(s):** Income

#### AC1.1.1 - Enter income amount

> Given I am on the Income screen, When I view the income entry form, Then I can see a field for entering an income amount in RM.

#### AC1.1.2 - Enter income date

> Given I am adding an income entry, When I view the entry form, Then I can select or enter the date associated with the income.

#### AC1.1.3 - Select an income source

> Given I am adding an income entry, When I view the available income sources, Then I can select from the predefined income-source “E-hailing”, “Freelance”, “Part-time (fixed)”, options displayed by RuMampu or type it in myself.

#### AC1.1.4 - Use multiple income sources

> Given I receive income from different types of work, When I record separate income entries, Then each entry can be associated with its own income source.

#### AC1.1.5 - Add a custom income source

> Given my income source is not one of the predefined choices, When I select the option to add my own source, Then I can define an additional income source.

#### AC1.1.6 - Save an income entry

> Given I have entered a valid income amount, date and source, When I select the action to add the income, Then the income entry is added to my current RuMampu record.

#### AC1.1.7 - Display existing entries

> Given income entries have already been recorded, When I view the Income screen, Then I can see previously recorded income entries with their dates, sources and amounts.

#### AC1.1.8 - Identify user-entered values

> Given an income amount was entered by me, When it is displayed in RuMampu, Then the interface can identify it as your data.

#### AC1.1.9 - Prevent negative income entry

> Given I enter a negative income amount, When I attempt to add the income entry, Then RuMampu displays a warning instead of immediately adding the entry.

#### AC1.1.10 - Warn about an unusually high income entry

> Given the income amount I enter is unusually high compared with my existing entries, When I attempt to add the income, Then RuMampu displays a warning and provides an option to keep the entry.

### US1.2 - Add historical income

**User Story:** As a user with previous income information, I want to add a past month's income so that my RuMampu record can include income from periods before I started using the app.

**Relevant screen(s):** Income

#### AC1.2.1 - Access past-month entry

> Given I am on the Income screen, When I choose Add a past month, Then I am provided with a way to add income for an earlier month.

#### AC1.2.2 - Enter a monthly total

> Given I am adding a past month, When I do not have individual transaction-level income entries for that month, Then RuMampu allows the month to be represented using one total amount.

#### AC1.2.3 - Include past income in analysis

> Given I successfully add income for a past month, When I return to the RuMampu financial record, Then the recorded-month count can include that additional month.

#### AC1.2.4 - Allow any available history

> Given I have fewer than 6 or 12 months of income history When I build my RuMampu financial record Then RuMampu allows me to continue using whatever historical periods I currently have.

### US1.3 - Record direct work-related costs

**User Story:** As a user, I want to record costs required to earn my income so that RuMampu can distinguish gross earnings from income after work costs.

**Relevant screen(s):** Work costs

#### AC1.3.1 - View work-cost categories

> Given I open the Work costs screen, When the screen loads, Then I can see separate work-cost items.

#### AC1.3.2 - Edit work-cost amounts

> Given a work-cost item is displayed, When I enter or change its amount, Then the new amount is reflected in the visible work-cost information.

#### AC1.3.3 - Record different work costs separately

> Given I have more than one direct cost of earning income, When I record the costs, Then each cost can be represented as a separate item.

#### AC1.3.4 - Add my own work cost

> Given one of my work costs is not represented by an existing item, When I use the custom-cost option, Then I can add another work-cost category.

#### AC1.3.5 - Show income after work costs

> Given RuMampu has income and work-cost information, When I view the Work costs screen, Then the interface displays an Income after work costs figure.

#### AC1.3.6 - Identify calculated income

> Given the income-after-work-costs figure is derived from the information in my record, When the result is displayed, Then it is identified as a calculated figure.

### US1.4 - Record regular financial commitments

**User Story:** As a user, I want to record my regular living costs, debt payments and savings so that RuMampu can represent the commitments I already have.

**Relevant screen(s):** Commitments

#### AC1.4.1 - Record living costs

> Given I open the Commitments screen, When I view the available commitment sections, Then I can record regular living-cost items.

#### AC1.4.2 - Record debt payments

> Given I have recurring debt payments, When I view the debt section, Then I can enter the amounts of those debt commitments.

#### AC1.4.3 - Record savings

> Given I make regular savings contributions, When I view the savings section, Then I can enter my regular savings amount.

#### AC1.4.4 - Keep commitment types visually separated

> Given I have different kinds of financial commitments, When I view the Commitments screen, Then living costs, debt payments and savings are presented as separate groups.

#### AC1.4.5 - Display total commitments

> Given commitment amounts have been entered, When I view the screen, Then RuMampu displays a total commitment amount.

#### AC1.4.6 - Identify total as calculated

> Given the total commitment amount is derived from the individual commitment items, When it is displayed, Then it is identified as calculated.

### US1.5 - Record daily expenses manually

**User Story:** As a user, I want to record individual daily expenses so that RuMampu can build a more detailed picture of my monthly spending.

**Relevant screen(s):** Add expense

#### AC1.5.1 - Enter an expense amount

> Given I open the Add expense screen, When I view the form, Then I can enter an expense amount in RM.

#### AC1.5.2 - Select an expense category

> Given I am recording an expense, When I view the available categories, Then I can select the category that best represents the expense.

#### AC1.5.3 - Use predefined categories

> Given I am selecting a category, When predefined categories are displayed, Then I can choose from categories such as Meals, Groceries, Tolls & parking, Family and Other.

#### AC1.5.4 - Add a custom category

> Given none of the displayed categories describes my expense, When I choose Your own category, Then I can add a category of my own.

#### AC1.5.5 - Enter expense date

> Given I am recording an expense, When I complete the expense form, Then I can specify the date of the expense.

#### AC1.5.6 - Add the expense

> Given I have entered a positive expense amount, When I select Add expense, Then the expense is added to the current financial record.

### US1.6 - Review recorded daily expenses

**User Story:** As a user, I want to see the expenses I have recorded during the month so that I can understand how much spending RuMampu currently knows about.

**Relevant screen(s):** Daily expenses

#### AC1.6.1 - Display current monthly spending

> Given I have recorded expenses, When I open Daily expenses, Then RuMampu displays the amount recorded so far for the latest recorded expense month.

#### AC1.6.2 - Display recorded days

> Given expenses have been entered on different dates, When I view Daily expenses, Then the interface displays how many days have been recorded.

#### AC1.6.3 - Display individual expenses

> Given individual expenses are available, When I view the expense list, Then I can see the relevant recorded expense entries.

#### AC1.6.4 - Access manual expense entry

> Given I want to add another expense, When I select Add expense, Then I can access the manual expense-entry screen.

#### AC1.6.5 - Access receipt-entry flow

> Given I want to use a receipt to create an expense entry, When I select Scan a receipt, Then I can access the receipt preview flow.

#### AC1.6.6 - Access monthly expense summary

> Given I want to review spending by month, When I select Monthly summary, Then the monthly expense summary is displayed.

### US1.7 - Use a receipt as the starting point for an expense

**User Story:** As a user, I want RuMampu to read information from a receipt for me to review so that I can add an expense without manually entering every visible field.

**Relevant screen(s):** Scan a receipt

#### AC1.7.1 - Select a receipt image

> Given I open the Scan a receipt screen, When I start the receipt flow, Then I can take or choose a receipt image.

#### AC1.7.2 - Show receipt-reading state

> Given I have selected a receipt, When the prototype is reading the receipt, Then a visible reading/loading state is displayed.

#### AC1.7.3 - Present values for confirmation

> Given the receipt-reading stage has completed, When the review screen appears, Then the interface displays receipt-derived values for me to check before saving.

#### AC1.7.4 - Display receipt-derived merchant

> Given receipt information is shown for review, When the merchant value is displayed, Then it is visibly identified as being from the receipt.

#### AC1.7.5 - Display receipt-derived date

> Given receipt information is shown for review, When the date value is displayed, Then it is visibly identified as being from the receipt.

#### AC1.7.6 - Display receipt-derived total

> Given receipt information is shown for review, When the total is displayed, Then it is visibly identified as being from the receipt.

#### AC1.7.7 - Choose an expense category

> Given receipt values are being reviewed, When I assign the expense, Then I can select an expense category.

#### AC1.7.8 - Edit before saving

> Given the receipt-derived values may require correction, When I review the form, Then I can modify the displayed values before adding the expense.

#### AC1.7.9 - Retake receipt

> Given I do not want to use the current receipt result, When I select Retake, Then RuMampu returns me to the receipt selection stage.

#### AC1.7.10 - Save the confirmed expense

> Given I have reviewed the receipt-derived values, When I select Add, Then the confirmed expense is added to the current expense record.

### US1.8 - Import historical financial records

**User Story:** As a user with previous financial records, I want to import my historical income information so that I can add past financial periods to RuMampu without entering every record manually.

#### AC1.8.1 - Access historical import

> Given I have previous financial records that I want to add to RuMampu, When I choose the historical import option, Then RuMampu provides a way for me to select a supported file containing my historical records.

#### AC1.8.2 - Import historical income records

> Given I select a supported file containing historical income records, When RuMampu reads the file, Then the recognised historical income records are prepared for me to review before they are added to my financial history.

#### AC1.8.3 - Preview imported records

> Given RuMampu has recognised records from my imported file, When the import preview is displayed, Then I can review the recognised income amounts, dates and income sources before confirming the import.

#### AC1.8.4 - Confirm imported records

> Given I have reviewed the recognised historical records, When I confirm the import, Then the confirmed records are added to my RuMampu financial history.

#### AC1.8.5 - Include imported periods in analysis

> Given historical records have been successfully imported, When RuMampu recalculates my financial information, Then the imported periods are included in the relevant income-pattern and housing-test calculations.

#### AC1.8.6 - Allow import with limited history

> Given my imported file contains fewer than 6 or 12 months of financial history, When I confirm the import, Then RuMampu accepts the available periods without requiring a minimum number of months.

#### AC1.8.7 - Handle records that cannot be recognised

> Given some information in the imported file cannot be recognised or used by RuMampu, When the import is processed, Then RuMampu identifies the affected records instead of silently adding incorrect information.

#### AC1.8.8 - Do not add imported records without confirmation

> Given RuMampu has recognised historical records from my file, When I have not yet confirmed the import, Then those records are not added to my RuMampu financial history.

## Epic 2 - Income Pattern Analysis

### US2.1 - View income month by month

**User Story:** As a user with irregular income, I want to see my usable income across recorded months so that I can understand how much my income changes over time.

**Relevant screen(s):** Income pattern

#### AC2.1.1 - Display monthly income chart

> Given I have income recorded across one or more months, When I open Income pattern, Then a month-by-month visualisation of my recorded income is displayed.

#### AC2.1.2 - Display month labels

> Given multiple months are represented, When the chart is displayed, Then each displayed bar corresponds to a labelled recorded month.

#### AC2.1.3 - Reflect different monthly amounts

> Given my recorded monthly income differs between months, When I view the chart, Then the different amounts are represented by different bar heights.

### US2.2 - Understand my typical and extreme income months

**User Story:** As a user, I want summary statistics for my recorded income so that I can understand what a typical month looks like and how far my stronger and weaker months differ.

**Relevant screen(s):** Income pattern

#### AC2.2.1 - Display average income

> Given recorded monthly income exists, When I open Income pattern, Then RuMampu displays an average income figure.

#### AC2.2.2 - Display median income

> Given recorded monthly income exists, When I review the income summary, Then RuMampu displays the median recorded income.

#### AC2.2.3 - Display highest income

> Given recorded monthly income exists, When I review the income summary, Then the highest recorded monthly income is displayed.

#### AC2.2.4 - Display lowest income

> Given recorded monthly income exists, When I review the income summary, Then the lowest recorded monthly income is displayed.

#### AC2.2.5 - Identify calculated figures

> Given the income statistics are derived from my record, When they are displayed, Then they are identified as calculated values.

#### AC2.2.6 - Explain variation

> Given the income pattern contains differences between months, When I view the income-pattern explanation, Then RuMampu communicates the degree of variation using the visible recorded range information.

### US2.3 - Identify lower-income months

**User Story:** As a user, I want RuMampu to identify weaker income months within my recorded history so that I can distinguish them from more typical months.

**Relevant screen(s):** Income pattern

#### AC2.3.1 - Use the RuMampu low income rule

> Given recorded monthly income exists, When I view my income pattern, Then RuMampu can identify lower income months based on the recorded income history without applying a fixed percentage threshold.

#### AC2.3.2 - Explain how lower income months are identified

> Given RuMampu identifies a lower income month, When I view the explanation Then the interface explains that the result is based on my recorded income history and is not a financial standard

### US2.4 - Check whether my recorded history covers normally slower periods

**User Story:** As a user whose income may vary during the year, I want to identify months when I usually earn less so that I can see whether my current record includes those periods.

**Relevant screen(s):** Coverage check

#### AC2.4.1 - Ask about quieter periods

> Given I open Coverage check, When the screen loads, Then I am asked whether there are times of year when I usually earn less.

#### AC2.4.2 - Provide three answer choices

> Given I am answering the coverage question, When I view the response options, Then I can choose Yes, No, or Not sure.

#### AC2.4.3 - Select slower months

> Given I answer Yes, When RuMampu asks which months are usually slower, Then all twelve months are available for selection.

#### AC2.4.4 - Select multiple slower months

> Given more than one month is usually slower, When I select those months, Then multiple months can remain selected.

#### AC2.4.5 - Warn about uncovered slower months

> Given I identify a normally slower month, When that month is not represented in my current recorded history, Then RuMampu displays a warning that the record has not yet covered that slower month.

#### AC2.4.6 - Confirm represented slower months

> Given I identify a normally slower month, When that month exists in the recorded history, Then the interface can indicate that the selected slower period is represented.

#### AC2.4.7 - Respond to No or Not sure

> Given I answer No or Not sure, When RuMampu evaluates the visible spread of my recorded months, Then the interface displays an observation based on the variation currently present in the record.

## Epic 3 - Housing Cost & Stress Test

### US3.1 - Enter a property and financing scenario

**User Story:** As a prospective homebuyer, I want to enter the property's price and financing information so that I can estimate the monthly instalment to test.

**Relevant screen(s):** The house

#### AC3.1.1 - Enter property price

> Given I open The house screen, When I use the property form, Then I can enter the property price in RM.

#### AC3.1.2 - Enter deposit

> Given I am entering a property scenario, When I complete the financing information, Then I can enter a deposit amount.

#### AC3.1.3 - Display financing amount

> Given a property price and deposit are available, When they are shown in the property form, Then RuMampu displays the financing amount as a calculated value.

#### AC3.1.4 - Enter financing rate

> Given I am defining the financing scenario, When I view the form, Then I can enter an annual financing rate.

#### AC3.1.5 - Enter loan tenure

> Given I am defining the financing scenario, When I view the form, Then I can enter the financing tenure in years.

#### AC3.1.6 - Display monthly instalment

> Given the required property and financing values are available, When RuMampu displays the property scenario, Then a calculated monthly instalment is shown.

#### AC3.1.7 - Use a known monthly payment

> Given I already know the monthly payment for the property, When I choose the known-payment option, Then I can enter that payment instead of relying on the displayed instalment calculation.

### US3.2 - Include recurring homeownership costs

**User Story:** As a user, I want the test to consider recurring homeownership costs in addition to the instalment so that the tested amount represents more than the loan payment alone.

**Relevant screen(s):** Total monthly cost

#### AC3.2.1 - Display instalment within total cost

> Given a monthly instalment exists, When I expand What's inside on the Total monthly cost screen, Then the instalment is displayed as one component of the monthly home cost.

#### AC3.2.2 - Display additional home costs

> Given I am on the Total monthly cost screen, When I expand What's inside, Then the additional recurring home-cost items are displayed separately from the instalment.

#### AC3.2.3 - Edit displayed additional costs

> Given a displayed home-cost item can be changed, When I enter a different amount, Then the visible total monthly home cost updates accordingly.

#### AC3.2.4 - Display total monthly cost

> Given the instalment and additional housing costs are available, When I view the page, Then RuMampu displays the combined total monthly cost as a calculated amount.

#### AC3.2.5 - Start housing test

> Given the total monthly cost is displayed, When I select Run the test, Then RuMampu proceeds to the housing stress-test flow.

### US3.3 - Check my financial position before adding the house

**User Story:** As a user, I want to know whether my recorded months already struggle to cover existing costs before adding a home payment so that I can distinguish an existing shortfall from a housing-related shortfall.

**Relevant screen(s):** Before the house

#### AC3.3.1 - Evaluate existing costs without the home

> Given my current income and commitments are recorded, When RuMampu performs the pre-housing check, Then the result is based on my recorded position before the additional housing cost.

#### AC3.3.2 - Identify an existing short month

> Given one or more recorded months do not cover existing costs, When the pre-housing result is displayed, Then RuMampu identifies that a recorded month was already short.

#### AC3.3.3 - Display existing gap

> Given an existing recorded month was short, When the result is displayed, Then the associated shortfall amount is shown.

#### AC3.3.4 - Redirect to financial inputs

> Given I want to review my existing financial information, When I select Go to Money, Then I can return to the Money area.

### US3.4 - See how the tested home would have performed across recorded months

**User Story:** As a user, I want to compare the tested monthly housing cost against each of my recorded months so that I can see how often the home would have caused a shortfall.

**Relevant screen(s):** Result

#### AC3.4.1 - Display short-month count

> Given I run a housing test using my recorded months, When the Result screen appears, Then RuMampu displays how many recorded months would have run short.

#### AC3.4.2 - Display total tested months

> Given the short-month result is displayed, When I read the result, Then the number of short months is presented relative to the total number of recorded months used.

#### AC3.4.3 - Display largest gap

> Given at least one recorded month would have been short, When I view the result, Then the largest calculated gap is displayed.

#### AC3.4.4 - Display month-by-month chart

> Given recorded monthly data was used in the test, When the Result screen is displayed, Then the result includes a month-by-month chart.

#### AC3.4.5 - Show tested cost as reference

> Given the chart is displayed, When I compare my recorded months against the housing cost, Then the tested monthly home cost is represented by a reference line.

#### AC3.4.6 - Highlight shortfalls

> Given a recorded month does not reach the tested home-cost line, When it appears in the chart, Then the shortfall is visually distinguished.

#### AC3.4.7 - Access further test views

> Given I have completed a housing test, When I view the Result screen, Then I can access Carrying range, Compare payments and If income drops.

### US3.5 - Understand my carrying range

**User Story:** As a user, I want to see a range of monthly payments that my recorded months were able to carry so that I can understand affordability as a range rather than one exact number.

**Relevant screen(s):** Carrying range

#### AC3.5.1 - Display lower carrying amount

> Given a carrying range is available, When I open Carrying range, Then the lower carrying amount is displayed.

#### AC3.5.2 - Display upper carrying amount

> Given a carrying range is available, When I view the screen, Then an upper carrying amount is displayed.

#### AC3.5.3 - Explain the range

> Given the lower and upper values are displayed, When I read the explanation, Then RuMampu explains what the two ends of the range represent.

#### AC3.5.4 - Display the tested payment within the range

> Given a tested home payment exists, When the carrying-range visual is displayed, Then the current tested payment can be shown relative to the range.

#### AC3.5.5 - Convert payment range to an indicative price range

> Given financing-rate and tenure assumptions are available, When the carrying range is displayed, Then RuMampu can show an indicative property-price range corresponding to the payments.

#### AC3.5.6 - State limitation of property-price conversion

> Given an indicative price range is shown, When I read the supporting text, Then RuMampu states that the figure is indicative only and is not a valuation or offer.

## Epic 4 - Cash-Flow Forecast & Adjustment Planner

Scope note: The current prototype supports spending review and adjustment features. It does not visibly contain a full future cash-flow forecasting screen.

### US4.1 - Review monthly expense completeness

**User Story:** As a user, I want to know how complete my recorded spending is for each month so that I understand how much of my monthly cash flow is based on actual recorded expenses.

**Relevant screen(s):** Monthly summary

#### AC4.1.1 - Display monthly expense totals

> Given expenses have been recorded, When I open Monthly summary, Then the relevant monthly expense totals are displayed.

#### AC4.1.2 - Mark fully recorded months

> Given a month satisfies RuMampu's displayed recording rule, When the month appears in Monthly summary, Then it can be marked as fully recorded.

#### AC4.1.3 - Show partially recorded months

> Given a month does not meet the full-recording rule, When it appears in Monthly summary, Then RuMampu shows the number of recorded days and indicates that the remaining part of the month is unknown.

#### AC4.1.4 - Identify months used in the test

> Given a recorded expense month is used in the housing test, When the monthly summary is displayed, Then that month can be labelled used in the test.

#### AC4.1.5 - Explain the full-recording rule

> Given the interface labels a month fully recorded, When I read the rule, Then RuMampu states that 20 logged days constitute a fully recorded month and identifies this as RuMampu's own rule.

### US4.2 - Set monthly and category spending limits

**User Story:** As a user, I want to set spending limits for the month and individual categories so that I can compare my recorded spending against amounts I choose.

**Relevant screen(s):** Spending limits

#### AC4.2.1 - Set whole-month limit

> Given I open Spending limits, When I view the whole-month section, Then I can enter my own monthly spending limit.

#### AC4.2.2 - Set category limit

> Given an expense category is shown, When I enter a limit for that category, Then that category has its own user-defined spending limit.

#### AC4.2.3 - Compare spending with limit

> Given I have recorded spending and set a limit, When the spending-limit view is displayed, Then a visual bar compares spending against that limit.

#### AC4.2.4 - Show amount remaining

> Given recorded spending is below the limit, When I view the limit status, Then RuMampu displays the amount remaining.

#### AC4.2.5 - Show amount over limit

> Given recorded spending exceeds the limit, When I view the limit status, Then RuMampu displays how much the spending is past the limit.

#### AC4.2.6 - Handle no limit

> Given I have not set a limit, When I view the relevant monthly or category section, Then RuMampu indicates that no limit is set.

#### AC4.2.7 - Make ownership of limit clear

> Given I am using Spending limits, When I read the explanatory text, Then RuMampu states that the limits are mine to set and RuMampu only counts against them.

### US4.3 - Compare different monthly home payments

**User Story:** As a user, I want to compare several monthly home-payment amounts against the same recorded months so that I can see how different payment levels affect shortfalls.

**Relevant screen(s):** Compare payments

#### AC4.3.1 - Show three payment scenarios

> Given I open Compare payments, When the page loads, Then three separate payment scenarios are displayed.

#### AC4.3.2 - Edit each payment

> Given a payment scenario is displayed, When I edit its payment amount, Then the scenario uses the updated amount.

#### AC4.3.3 - Use the same recorded months

> Given I compare different payment scenarios, When the results are displayed, Then each scenario is compared against the same recorded months.

#### AC4.3.4 - Display short-month count for each scenario

> Given a payment scenario has been evaluated, When I view the scenario, Then it displays the number of recorded months that would have been short.

#### AC4.3.5 - Display largest gap for each scenario

> Given a payment scenario results in a shortfall, When I view its result, Then its largest calculated gap is displayed.

#### AC4.3.6 - Display a chart for each scenario

> Given the three payment scenarios are shown, When I compare them, Then each scenario has its own visual representation of the recorded months.

### US4.4 - Stress-test an income drop

**User Story:** As a user with variable income, I want to reduce my recorded income by a hypothetical percentage so that I can see how the tested home would have performed under lower income.

**Relevant screen(s):** If income drops

#### AC4.4.1 - Provide 0% scenario

> Given I open If income drops, When the stress-test options appear, Then I can select a 0% drop.

#### AC4.4.2 - Provide 10% scenario

> Given I open If income drops, When the stress-test options appear, Then I can select a 10% income drop.

#### AC4.4.3 - Provide 20% scenario

> Given I open If income drops, When the stress-test options appear, Then I can select a 20% income drop.

#### AC4.4.4 - Provide custom percentage

> Given I want to test another percentage, When I choose Custom, Then I can enter a custom income-drop percentage.

#### AC4.4.5 - Display stressed short-month count

> Given an income-drop percentage has been selected, When the stress-test result is displayed, Then RuMampu shows how many recorded months would have run short under that assumption.

#### AC4.4.6 - Display largest stressed gap

> Given the stress scenario produces one or more short months, When the result is displayed, Then RuMampu shows the largest calculated gap.

#### AC4.4.7 - Display month-by-month stressed chart

> Given a stress scenario has been selected, When I view the result, Then the recorded months are displayed against the tested home cost using the stressed income values.

#### AC4.4.8 - Identify the scenario as an assumption

> Given the income reduction is hypothetical, When the result is displayed, Then the scenario is identified as an assumption.

#### AC4.4.9 - Avoid presenting the stress test as a prediction

> Given I view the explanatory text, When I read what the scenario represents, Then RuMampu states that it is a hypothetical based on recorded months and not a statement about what will happen in the future.

## Epic 5 - Homeownership Preparation

### US5.1 - Access homeownership preparation tools

**User Story:** As a user preparing for homeownership, I want a dedicated preparation area so that I can review cash requirements, financial buffer and documentation.

**Relevant screen(s):** Prepare

#### AC5.1.1 - Show Upfront cash

> Given I open Prepare, When the page loads, Then an Upfront cash option is displayed.

#### AC5.1.2 - Show Cash buffer

> Given I open Prepare, When the page loads, Then a Cash buffer option is displayed.

#### AC5.1.3 - Show Documents & financing

> Given I open Prepare, When the page loads, Then a Documents & financing option is displayed.

#### AC5.1.4 - Navigate to preparation tools

> Given one of the preparation options is visible, When I select it, Then RuMampu opens the corresponding preparation screen.

### US5.2 - Check upfront cash readiness

**User Story:** As a prospective homebuyer, I want to compare the cash I have with the estimated upfront cash requirement so that I can identify an upfront funding gap.

**Relevant screen(s):** Upfront cash

#### AC5.2.1 - Display cash available

> Given cash-on-hand information is available, When I open Upfront cash, Then RuMampu displays You have with the available amount.

#### AC5.2.2 - Identify cash available as user data

> Given the cash amount represents my own entered information, When it is displayed, Then it is labelled as user data.

#### AC5.2.3 - Display cash required

> Given the property and upfront-cost information are available, When I open Upfront cash, Then RuMampu displays You need with a calculated amount.

#### AC5.2.4 - Display upfront gap

> Given the amount available is different from the amount required, When I view the screen, Then RuMampu displays the calculated gap.

#### AC5.2.5 - Visualise available versus required

> Given available and required amounts exist, When I view the upfront chart, Then the available amount is visually compared against the required amount.

#### AC5.2.6 - Highlight an upfront shortfall

> Given available cash is below the required amount, When the chart is displayed, Then the gap is visually distinguishable.

#### AC5.2.7 - Display upfront cost components

> Given the upfront requirement contains individual components, When I view the screen, Then the visible upfront-cost items are listed separately.

#### AC5.2.8 - Handle a zero deposit

> Given the deposit is RM0, When Upfront cash is displayed, Then RuMampu explains that upfront cash may still consist of fees and setup costs.

### US5.3 - Estimate a cash buffer from recorded short months

**User Story:** As a prospective homeowner, I want to see the amount of starting cash that would have been needed to survive the short months in my record so that I can understand a possible cash-buffer requirement.

**Relevant screen(s):** Cash buffer

#### AC5.3.1 - Display cash-buffer amount

> Given recorded monthly information and a home cost scenario are available, When I open Cash buffer, Then RuMampu displays a calculated cash buffer amount.

#### AC5.3.2 - Explain what the buffer represents

> Given the buffer is displayed, When I read its explanation, Then RuMampu describes it as the smallest starting amount that would have been needed to get through the recorded short months without going below zero.

#### AC5.3.3 - Display running balance by month

> Given the buffer has been calculated from recorded months, When I view the Cash buffer screen, Then a running-balance-by-month visual is displayed.

#### AC5.3.4 - State record basis

> Given the buffer is based on my recorded history, When I view its supporting text, Then the record period used is shown.

#### AC5.3.5 - State that it is not a general rule

> Given the cash-buffer result is displayed, When I read the explanatory note, Then RuMampu states that the figure comes from my own record and is not a general rule.

#### AC5.3.6 - Explain the displayed buffer result

> Given RuMampu has calculated a cash buffer amount from my recorded months, When I view the cash buffer screen, Then the displayed buffer amount is accompanied by an explanation of what the amount represents

### US5.4 - Review financing preparation documents

**User Story:** As a prospective homebuyer, I want a checklist of documents and visible financing criteria so that I can understand what information may be useful when preparing for financing.

**Relevant screen(s):** Documents & financing

#### AC5.4.1 - Display document checklist

> Given I open Documents & financing, When the screen loads, Then a checklist of financing-related documents is displayed.

#### AC5.4.2 - Include visible document types

> Given the checklist is displayed, When I review it, Then it includes the document types shown in the design, including bank statements, e-hailing earnings summary, statutory declaration of income, EPF statement and list of existing commitments.

#### AC5.4.3 - Toggle checklist items

> Given a checklist item is displayed, When I select it, Then its checked or unchecked state is visibly updated.

#### AC5.4.4 - Display SJKP published criteria

> Given I am viewing Documents & financing, When I reach the SJKP information section, Then the visible published criteria are displayed.

#### AC5.4.5 - Display source and date

> Given published criteria are shown, When I read the section, Then the source and displayed publication/reference date are also shown.

#### AC5.4.6 - Avoid displaying unsupported approval status

> Given RuMampu's income measure differs from the displayed SJKP income measure, When the 65% check is shown, Then the interface states that the check needs review rather than showing a pass or fail.

#### AC5.4.7 - Display financing disclaimer

> Given I am reviewing the financing information, When I read the disclaimer, Then RuMampu states that it does not apply for the user and cannot tell the user whether a bank will approve them.

## Epic 6 - AI Insights & Alerts

### US6.1 - Scan and categorise expenses from receipts

**User Story:** As a user, I want RuMampu to read information from my receipt and suggest an expense category so that I can record my spending faster without manually entering every detail.

#### AC6.1.1 - Upload or capture a receipt

> Given I want to record an expense using a receipt, When I open the receipt scanning feature, Then I can take a photo or select a receipt image for RuMampu to process.

#### AC6.1.2 - Extract receipt information

> Given I have provided a readable receipt, When RuMampu processes the receipt, Then it displays the recognised merchant, transaction date and total amount for me to review.

#### AC6.1.3 - Suggest an expense category

> Given RuMampu has recognised information from the receipt, When the extracted expense is displayed, Then RuMampu suggests an expense category based on the recognised receipt information.

#### AC6.1.4 - Identify the category as an AI suggestion

> Given RuMampu has suggested an expense category, When I review the suggestion, Then the interface clearly identifies the category as an AI-generated suggestion rather than confirmed user data.

#### AC6.1.5 - Allow the user to change the suggested category

> Given an expense category has been suggested, When I believe another category is more appropriate, Then I can replace the suggested category before saving the expense.

#### AC6.1.6 - Allow correction of extracted information

> Given RuMampu has extracted information from the receipt, When any recognised value is incorrect, Then I can edit the merchant, date, amount or category before saving.

#### AC6.1.7 - Require confirmation before saving

> Given RuMampu has extracted and categorised the receipt information, When I have not yet confirmed the information, Then the expense is not added to my financial record.

#### AC6.1.8 - Save the confirmed expense

> Given I have reviewed and confirmed the receipt information and expense category, When I select Add expense, Then the confirmed expense is added to my RuMampu financial record.

#### AC6.1.9 - Handle unreadable or incomplete receipts

> Given RuMampu cannot confidently recognise some receipt information, When the receipt is processed, Then the affected fields are identified for me to review or complete manually instead of automatically inserting uncertain information.

#### AC6.1.10 - Do not invent missing receipt information

> Given information such as the merchant, date or amount cannot be recognised from the receipt, When the result is displayed, Then RuMampu does not present an invented value as though it came from the receipt.

### US6.2 - Ask RuMampu about my financial situation

**User Story:** As a user, I want to ask RuMampu questions about my recorded financial information so that I can better understand my income, spending and homeownership test results in simple language.

#### AC6.2.1 - Access the AI financial guidance chatbot

> Given I am using RuMampu, When I open the AI financial guidance feature, Then I can access a chat interface where I can enter questions about my financial information.

#### AC6.2.2 - Ask questions in natural language

> Given the chatbot is open, When I enter a financial question using normal conversational language, Then RuMampu can provide a response relevant to the question.

#### AC6.2.3 - Use the user's RuMampu record when relevant

> Given my RuMampu record contains relevant financial information, When I ask a question about my finances, Then the chatbot can use the relevant recorded information when forming its response.

#### AC6.2.4 - Explain financial results in simple language

> Given RuMampu has calculated a financial result such as a shortfall, carrying range or cash buffer, When I ask the chatbot about that result, Then the chatbot can explain what the result means using understandable language.

#### AC6.2.5 - Answer questions about income patterns

> Given income-pattern information exists in my record, When I ask about my stronger, weaker or more variable income periods, Then the chatbot can explain the relevant recorded income pattern.

#### AC6.2.6 - Answer questions about spending

> Given expense information exists in my record, When I ask about my recorded spending, Then the chatbot can explain relevant spending amounts or categories using the information available in RuMampu.

#### AC6.2.7 - Answer questions about housing-test results

> Given I have completed a housing test, When I ask about the result, Then the chatbot can explain relevant information such as short months, largest gaps, tested payments or income-drop scenarios.

#### AC6.2.8 - Acknowledge insufficient information

> Given my RuMampu record does not contain enough information to answer my question reliably, When I ask the chatbot for an explanation, Then it indicates that the available information is limited rather than presenting an unsupported conclusion.

#### AC6.2.9 - Display the AI assistant throughout the logged-in experience

> Given I have logged in to RuMampu, When I navigate between the main RuMampu pages and their related sub-screens, Then the AI assistant access control remains visible and available for me to open.

#### AC6.2.10 - Do not display the assistant before login

> Given I have not logged in to RuMampu, When I view a pre-login screen, Then the logged-in AI financial assistant is not displayed.

#### AC6.2.11 - Open the assistant from any logged-in page

> Given I am viewing any page after logging in, When I select the AI assistant control, Then the AI financial assistant opens without requiring me to navigate to a separate dedicated page first.

#### AC6.2.12 - Preserve the current page when opening the assistant

> Given I open the AI assistant while viewing a RuMampu page, When the assistant is displayed, Then I can continue to identify the page or financial context I opened it from.

#### AC6.2.13 - Avoid presenting guidance as guaranteed financial advice

> Given the chatbot provides financial guidance or explanations, When I read its response, Then RuMampu does not present the response as a guaranteed outcome, loan approval decision or professional financial recommendation.

#### AC6.2.14 - Guide users to relevant RuMampu features

> Given I ask the chatbot where to find a feature or complete an action in RuMampu, When the chatbot identifies the relevant feature, Then it tells me which RuMampu page or section to open and provides the relevant navigation steps.

#### AC6.2.15 - Display the AI assistant next to the language control

> Given I am logged in to RuMampu, When I view a RuMampu page where the top navigation controls are displayed, Then the AI assistant control is shown in the top-right area next to the language selection button.

## Epic 7 - Homeownership Monitoring

### US7.1 - Switch from planning to post-purchase monitoring

**User Story:** As a user who has bought the tested home, I want to switch RuMampu into a post-purchase mode so that I can move from estimated affordability to reviewing actual homeownership results.

**Relevant screen(s):** Switch mode - Iteration 3 preview

#### AC7.1.1 - Identify feature as preview

> Given I access the post-purchase feature from Prepare, When the Switch mode screen is displayed, Then it is labelled as an Iteration 3 preview.

#### AC7.1.2 - Explain the mode change

> Given I am considering the post-purchase mode, When I read the explanation, Then RuMampu states that estimates become actuals.

#### AC7.1.3 - State purchase occurs outside RuMampu

> Given the mode-switch screen is displayed, When I read its explanatory text, Then RuMampu states that the purchase itself happens outside RuMampu.

#### AC7.1.4 - Provide purchase confirmation action

> Given I have bought the home, When I view Switch mode, Then I can select I've bought the home.

#### AC7.1.5 - Show post-purchase options after switching

> Given I have selected that I bought the home, When the post-purchase mode is displayed, Then I can access This month and Earlier test vs what happened.

### US7.2 - Monitor actual income against actual home costs

**User Story:** As a homeowner, I want to compare actual income with actual home costs for the month so that I can see whether the month left me with cash or resulted in a shortfall.

**Relevant screen(s):** This month - Iteration 3 preview

#### AC7.2.1 - Display actual income

> Given I am using the post-purchase preview, When I open This month, Then the actual income for the displayed month is shown.

#### AC7.2.2 - Identify actual income as user data

> Given actual income represents recorded post-purchase information, When it is displayed, Then it is identified as user data.

#### AC7.2.3 - Display actual home costs

> Given I am reviewing the displayed month, When the page is shown, Then the actual home costs for that month are displayed.

#### AC7.2.4 - Display monthly cash position

> Given actual income and actual home costs are displayed for the month,

> When RuMampu compares the two amounts

> Then the interface displays the resulting monthly cash position

#### AC7.2.5 - Show negative monthly position

> Given actual home costs exceed actual income, When RuMampu displays the monthly result, Then the interface shows Short by.

### US7.3 - Compare the earlier test with actual homeownership results

**User Story:** As a homeowner, I want to compare my earlier RuMampu stress test with what actually happened after buying so that I can understand how the test compared with my real experience.

**Relevant screen(s):** Earlier test vs what happened - Iteration 3 preview

#### AC7.3.1 - Display earlier-test short-month count

> Given an earlier test exists, When I open Earlier test vs what happened, Then RuMampu displays the number of short months identified by that earlier test.

#### AC7.3.2 - Display actual post-purchase short-month count

> Given post-purchase monthly information is available, When I view the comparison, Then RuMampu displays how many of the post-purchase months have actually run short.

#### AC7.3.3 - Keep test and actual results distinct

> Given both results appear on the same screen, When I read them, Then the earlier calculated test result and the post-purchase user-data result are visually distinguished.

#### AC7.3.4 - Explain missing historical coverage where applicable

> Given i open Earlier test vs what happened, When the comparison context is displayed, Then RuMampu can explain that a period experienced after buying was not included in the recorded history.

#### AC7.3.5 - Encourage continued recording

> Given the user has entered post-purchase information, When the comparison screen is displayed, Then the interface communicates that continued recording allows the same record to keep being used.

## Epic 8 - Privacy, Accounts & Saved History

Scope note: The current prototype only supports the record and kept-test portion of this epic. It does not visibly contain account creation, login, privacy controls, cloud sync, or permanent cross-session storage.

### US8.1 - Review my current RuMampu record

**User Story:** As a user, I want to see how much financial information is currently in my RuMampu record so that I know what the application's results are based on.

**Relevant screen(s):** Your record

#### AC8.1.1 - Display recorded month count

> Given I have financial entries in RuMampu, When I open Your record, Then the number of recorded months is displayed.

#### AC8.1.2 - Display entry count

> Given financial entries exist, When I view Your record, Then the number of individual entries is displayed.

#### AC8.1.3 - Display latest entry date

> Given one or more entries exist, When I view Your record, Then the latest recorded entry date is displayed.

#### AC8.1.4 - Explain that new entries update other screens

> Given I am viewing the current record, When I read the explanatory text, Then RuMampu states that screens update as information is added.

#### AC8.1.5 - State current-session limitation

> Given I am using this prototype version, When I view Your record, Then RuMampu explicitly states that the record lives only in the current session.

### US8.2 - Keep a housing test in the current record

**User Story:** As a user, I want to keep a completed housing test so that I can review the test again within my current RuMampu session.

**Relevant screen(s):** Result, Your record

#### AC8.2.1 - Provide keep-test action

> Given I have completed a housing test, When I view the Result screen, Then a Keep this test action is available.

#### AC8.2.2 - Confirm kept status

> Given I select Keep this test, When RuMampu accepts the action, Then the interface can indicate that the test has been kept.

#### AC8.2.3 - Display kept tests in Your record

> Given one or more tests have been kept, When I open Your record, Then a Kept tests section displays those tests.

#### AC8.2.4 - Handle no kept tests

> Given I have not kept any test, When I open Your record, Then RuMampu tells me that no test has been kept and directs me to run one from the Test tab.

#### AC8.2.5 - Do not imply permanent storage

> Given I keep a test in this prototype, When its status is shown in Your record, Then the interface does not imply that the test is permanently stored beyond the current session.

### US8.3 - Select interface language

**User Story:** As a user, I want to select my preferred interface language so that I can use RuMampu in the language I am most comfortable with.

**Relevant screen:** Language selection

#### AC8.3.1 - Open language selection

> Given I am using RuMampu When I select the Language control, Then the available interface-language options are displayed.

#### AC8.3.2 - Select an interface language

> Given the language options are displayed, When I select one of the available languages, Then RuMampu displays the interface using the selected language

#### AC8.3.3 - Show the selected language

> Given I have selected an interface language When I continue using RuMampu Then the selected language is visibly reflected in the interface

### US8.4 - Navigate the RuMampu interface

**User Story:** As a user, I want consistent navigation throughout RuMampu so that I can move between the main areas and return to previous screens easily. Relevant screen(s): Home, Money, Test, Prepare and linked sub-screens

#### AC8.4.1 - Display bottom navigation

> Given I am viewing a main RuMampu screen, When the screen loads, Then the bottom navigation displays the Home, Money, Test and Prepare options.

#### AC8.4.2 - Navigate to Home

> Given the bottom navigation is displayed, When I select Home, Then RuMampu opens the Home screen.

#### AC8.4.3 - Navigate to Money

> Given the bottom navigation is displayed, When I select Money, Then RuMampu opens the Money area.

#### AC8.4.4 - Navigate to Test

> Given the bottom navigation is displayed, When I select Test, Then RuMampu opens the housing-test area.

#### AC8.4.5 - Navigate to Prepare

> Given the bottom navigation is displayed, When I select Prepare, Then RuMampu opens the Homeownership Preparation area.

#### AC8.4.6 - Return to the previous screen

> Given I have navigated from one RuMampu screen to another, When I select Back, Then RuMampu returns me to the previous screen.

### US8.5 - Use consistent interface colours and visual states

**User Story:** As a user, I want RuMampu to use a consistent colour palette and visual styling so that I can distinguish actions, information and financial states throughout the application. Relevant screen(s): All RuMampu screens

#### AC8.5.1 - Use the primary RuMampu colour

> Given I am viewing the RuMampu interface, When primary branding or prominent interface elements are displayed, Then the interface uses the primary RuMampu colour #E5E5E5 consistently.

#### AC8.5.2 - Use the primary action colour consistently

> Given a primary action button is displayed, When I view the button, Then it uses the designated primary action colour #4A9195

#### AC8.5.9 - Use a consistent primary text colour

> Given headings, financial values or other primary information are displayed, When I view the content, Then the text uses the designated primary text colour #3C5152

#### AC8.5.15 - Use the standard bar-chart colour

> Given RuMampu displays a bar chart containing recorded financial values, When a bar does not represent a shortfall, Then the bar is displayed using #3C5152.

#### AC8.5.16 - Highlight shortfalls in bar charts

> Given a bar chart contains a month or scenario with a calculated shortfall, When the shortfall is displayed within the chart, Then the shortfall portion is visually highlighted using #F1592A.
