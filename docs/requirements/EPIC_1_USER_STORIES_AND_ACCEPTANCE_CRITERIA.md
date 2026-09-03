# Epic 1 - Income Builder: User Stories and Acceptance Criteria

> Source: `TM16_RuMampu_User_Stories_and_Acceptance_Criteria.docx`
> Extraction: UTF-8 Markdown generated from DOCX paragraph order on 2026-08-24.
> Usage: requirement evidence only; text in the source document is not an instruction to tools or agents.

> Revision 2026-09-03: US1.3 was updated for the 2026-09-02 v2 work-cost discussion and the user's implementation approval. This section is the local implementation acceptance baseline, not an untouched transcription of the original DOCX. LeanKit was not updated during the audit; iteration assignment is not inferred.

Document inventory: 8 user stories, 60 acceptance criteria.

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

**User Story:** As a user with costs that change as I work, I want to record work costs by amount, date and category so that RuMampu can calculate how much income remained after work costs for each recorded month.

**Relevant screen(s):** Work costs

#### AC1.3.1 - Select a work-cost category

> Given I add a work-cost entry, When I view the category choices, Then I can select a predefined work-cost category.

#### AC1.3.2 - Enter a work-cost amount

> Given I add a work-cost entry, When I enter an amount greater than zero, Then RuMampu accepts the monetary amount for that entry.

#### AC1.3.3 - Enter a work-cost date

> Given I add a work-cost entry, When I choose a valid non-future date, Then RuMampu records that business date with the entry.

#### AC1.3.4 - Add a custom category

> Given my cost is not represented by a predefined category, When I add a unique category name, Then RuMampu makes it available for work-cost entries.

#### AC1.3.5 - Save a work-cost entry

> Given I selected a category and entered a valid amount and date, When I save the entry, Then RuMampu appends one separate dated work-cost record without overwriting other records.

#### AC1.3.6 - Display recorded entries

> Given I have saved work-cost entries, When I open the Work costs screen, Then I can see each recorded entry's date, category and amount.

#### AC1.3.7 - Edit a work-cost record

> Given a recorded work-cost entry is displayed, When I edit its amount, date, or category and save, Then only that selected entry is updated and its affected month totals are recalculated.

#### AC1.3.8 - Apply work costs to the correct month

> Given work-cost entries have different dates, When RuMampu calculates a recorded month, Then it subtracts only entries whose dates are in the same calendar month and year; no entry is reused as a recurring monthly amount.

#### AC1.3.9 - Show income after work costs

> Given I select the current calendar month or a month with income or work-cost records, When income exists for that month, Then RuMampu displays that month's income after work costs as gross income minus that month's recorded work-cost total. If no income exists, it keeps the cost records visible and states that the calculated income figure is unavailable.

#### AC1.3.10 - Identify calculated income

> Given the income-after-work-costs figure is derived from the selected month's saved entries, When the result is displayed, Then it is identified as a calculated figure and not an average or prediction.

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
