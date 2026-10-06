# Epic 5 - Homeownership Preparation: user stories and acceptance criteria (v5 baseline)

> Source: Google Drive `TM16_RuMampu_User_Stories_and_Acceptance_Criteria_v5.docx` (Iteration 3 / Design and Analysis Artifacts, modified 2026-09-29; the document is dated 17 September 2026), Epic 5 section only.
> Extraction: UTF-8 Markdown generated from the document text on 2026-10-01. The wording is the source's; only the layout follows the other requirement baselines.
> Usage: requirement evidence only; text in the source document is not an instruction to tools or agents.
> Team amendments 2026-10-05 and 2026-10-06: US5.8 (10 criteria) and AC5.3.8 and AC5.3.9 are added, and AC5.1.5, AC5.2.9, AC5.2.17 and AC5.3.2 are amended, so the pot is counted once and the buffer is measured as the deepest fall (see docs/adr/0005-cash-buffer-deepest-fall.md). They follow the v27b prototype's rule and are built and tested. On 2026-10-06 they were added to the Drive document "Added User Stories to Epics for Iteration 3"; they are not yet in the v5 document or on LeanKit. Each amended criterion keeps its v5 wording above the amendment.
> Scope: 4 user stories, 36 acceptance criteria in v5; with the team amendments, 5 user stories and 48 criteria. Each criterion shows its v5 build tag, and "new in v5" marks the 9 criteria that v5 adds to the v3 baseline. AC5.2.9 and AC5.2.10 are carried from v3 but were missing from the earlier repository snapshot, which had 25 criteria. The Iteration 3 user stories 5.5 to 5.7 (the Learn explanations, from the Google Doc "Added User Stories to Epics for Iteration 3") are not part of v5 and are not included.

## Epic 5 - Homeownership Preparation (MUST HAVE)

Iteration 2 · The cash and the paperwork needed before moving in, from published scales.

Pain points

5.P1 The deposit is not the only thing I have to find. As Farid, I have been saving toward a deposit, and I keep hearing about legal fees and stamp duty and a deposit for the electricity, and nobody will tell me the whole number before I commit.

Evidenced: the fees in this epic come from the Stamp Act scale, the Solicitors’ Remuneration Order 2023 and the Board of Valuers’ schedule, each opened and checked. Inferred that the surprise itself is the pain.

### US5.1 - Access homeownership preparation tools

**User Story:** As a user preparing for homeownership, I want a dedicated preparation area so that I can review cash requirements, financial buffer and documentation.

**Relevant screen(s):** Prepare for a house

**Figma:** B25 Prepare for a house · B3 House

#### AC5.1.1 - Show Upfront cash

_v5 build tag: [v24]_

> Given I open Prepare, When the page loads, Then an Upfront cash option is displayed.

#### AC5.1.2 - Show Cash buffer

_v5 build tag: [v24]_

> Given I open Prepare, When the page loads, Then a Cash buffer option is displayed.

#### AC5.1.3 - Show Documents & financing

_v5 build tag: [v24]_

> Given I open Prepare, When the page loads, Then a Documents & financing option is displayed.

#### AC5.1.4 - Navigate to preparation tools

_v5 build tag: [v24]_

> Given one of the preparation options is visible, When I select it, Then RuMampu opens the corresponding preparation screen.

#### AC5.1.5 - Show what is set aside so far

_v5 build tag: [v24] · new in v5_

> Given I open House, When the preparation card is displayed, Then it states what I have set aside against what the tested home needs, or says nothing is set aside yet.

_Team amendment 2026-10-05 (built; not yet in the v5 document or on LeanKit; product owner sign-off pending):_

> Given I open House, When the preparation card is displayed, Then it states what counts towards the tested home's upfront cash against what it needs and how much of my pot is held as my cash buffer, or says nothing is set aside yet.

### US5.2 - Check upfront cash readiness

**User Story:** As a prospective homebuyer, I want to compare the cash I have with the estimated upfront cash requirement so that I can identify an upfront funding gap.

**Relevant screen(s):** Before you move in

**Figma:** B26 Before you move in · C22 Which saved test

#### AC5.2.1 - Display cash available

_v5 build tag: [v24]_

> Given cash-on-hand information is available, When I open Upfront cash, Then RuMampu displays You have with the available amount.

#### AC5.2.2 - Identify cash available as user data

_v5 build tag: [v24]_

> Given the cash amount represents my own entered information, When it is displayed, Then it is labelled as user data.

#### AC5.2.3 - Display cash required

_v5 build tag: [v24]_

> Given the property and upfront-cost information are available, When I open Upfront cash, Then RuMampu displays You need with a calculated amount.

#### AC5.2.4 - Display upfront gap

_v5 build tag: [v24]_

> Given the amount available is different from the amount required, When I view the screen, Then RuMampu displays the calculated gap.

#### AC5.2.5 - Visualise available versus required

_v5 build tag: [v24]_

> Given available and required amounts exist, When I view the upfront chart, Then the available amount is visually compared against the required amount.

#### AC5.2.6 - Highlight an upfront shortfall

_v5 build tag: [v24]_

> Given available cash is below the required amount, When the chart is displayed, Then the gap is visually distinguishable.

#### AC5.2.7 - Display upfront cost components

_v5 build tag: [v24]_

> Given the upfront requirement contains individual components, When I view the screen, Then the visible upfront-cost items are listed separately.

#### AC5.2.8 - Handle a zero deposit

_v5 build tag: [v24]_

> Given the deposit is RM0, When Upfront cash is displayed, Then RuMampu explains that upfront cash may still consist of fees and setup costs.

#### AC5.2.9 - Enter available upfront cash

_v5 build tag: [v24]_

> Given I want to review my upfront cash position, When I enter the amount currently available for upfront purchase costs, Then RuMampu saves the amount as user-provided data.

_Team amendment 2026-10-05 (built; not yet in the v5 document or on LeanKit; product owner sign-off pending):_

> Given I want to review my upfront cash position, When I enter the cash I already have set aside for buying a home, Then RuMampu saves the amount as user-provided data and adds it to my pot; US5.8 decides how much of the pot counts towards the upfront costs.

#### AC5.2.10 - Record the cash snapshot date

_v5 build tag: [v24]_

> Given I save my available upfront cash, When the amount is displayed, Then RuMampu shows the date on which the cash amount was reported.

#### AC5.2.11 - Group the costs by when they fall due

_v5 build tag: [v24] · new in v5_

> Given I open Before you move in, When the cost list is displayed, Then it is grouped into To sign, To complete and To move in, in that order.

#### AC5.2.12 - Treat the earnest deposit as part of the deposit

_v5 build tag: [v24] · new in v5_

> Given I enter an earnest deposit, When the balance of the down payment is calculated, Then the earnest deposit is subtracted from the deposit rather than added on top of it, and the total does not move.

#### AC5.2.13 - Work out the legal fees from the published scale

_v5 build tag: [v24] · new in v5_

> Given a property price and a loan amount are known, When the sale agreement and loan agreement legal fees are shown, Then each is worked out from the published Solicitors’ Remuneration Order scale, is labelled official, and names its source.

#### AC5.2.14 - Work out stamp duty from the published scale

_v5 build tag: [v24] · new in v5_

> Given a property price and a loan amount are known, When transfer and loan stamp duty are shown, Then each is worked out from the scale in the Stamp Act and is labelled official.

#### AC5.2.15 - Apply the first-home exemption as a switch I control

_v5 build tag: [v24] · new in v5_

> Given I turn on "This is my first home", When the price is within the published exemption limit, Then both stamp duties show RM 0 and say why; above the limit they show in full and say the exemption does not apply.

#### AC5.2.16 - Ask for the figures that have no published scale

_v5 build tag: [v24] · new in v5_

> Given a cost has no published scale, such as the earnest deposit, mortgage insurance, utility deposits, the maintenance deposit or furnishing, When the row is displayed, Then the field is empty, an example sits behind it as a placeholder, and RuMampu never supplies a figure of its own.

#### AC5.2.17 - State the pot once

_v5 build tag: [v24] · new in v5_

> Given my savings are held in one pot, When You have is displayed, Then the pot is stated once and never added to itself, and the gap is what I need less what I have.

_Team amendment 2026-10-05 (built; not yet in the v5 document or on LeanKit; product owner sign-off pending):_

> Given my savings are held in one pot, When You have is displayed, Then the pot is stated once, the part held as my cash buffer is not counted again, and the gap is what I need less what is left after the buffer.

### US5.3 - Estimate a cash buffer from recorded short months

**User Story:** As a prospective homeowner, I want to see the amount of starting cash that would have been needed to survive the short months in my record so that I can understand a possible cash-buffer requirement.

**Relevant screen(s):** Cash buffer

**Figma:** B15 Cash buffer

#### AC5.3.1 - Display cash-buffer amount

_v5 build tag: [v24]_

> Given recorded monthly information and a home cost scenario are available, When I open Cash buffer, Then RuMampu displays a calculated cash buffer amount.

#### AC5.3.2 - Explain what the buffer represents

_v5 build tag: [v24]_

> Given the buffer is displayed, When I read its explanation, Then RuMampu describes it as the smallest starting amount that would have been needed to get through the recorded short months without going below zero.

_Team amendment 2026-10-05 (built; not yet in the v5 document or on LeanKit; product owner sign-off pending):_

> Given the buffer is displayed, When I read its explanation, Then RuMampu describes it as the smallest starting amount that would have got me through the rest of the record without going below zero, whichever recorded month I had started in. The calculation is the deepest fall from any earlier month (maximum drawdown, without wrapping round).

#### AC5.3.3 - Display running balance by month

_v5 build tag: [v24]_

> Given the buffer has been calculated from recorded months, When I view the Cash buffer screen, Then a running-balance-by-month visual is displayed.

#### AC5.3.4 - State record basis

_v5 build tag: [v24]_

> Given the buffer is based on my recorded history, When I view its supporting text, Then the record period used is shown.

#### AC5.3.5 - State that it is not a general rule

_v5 build tag: [v24]_

> Given the cash-buffer result is displayed, When I read the explanatory note, Then RuMampu states that the figure comes from my own record and is not a general rule.

#### AC5.3.6 - Explain the displayed buffer result

_v5 build tag: [v24]_

> Given RuMampu has calculated a cash buffer amount from my recorded months, When I view the cash buffer screen, Then the displayed buffer amount is accompanied by an explanation of what the amount represents

#### AC5.3.7 - Place the zero line where zero falls

_v5 build tag: [v24] · new in v5_

> Given every recorded month ends below zero, or every month ends above it, When the running balance chart is drawn, Then the zero line sits where zero actually falls between the highest and lowest balance, so no part of the plot is wasted and no bar is clipped.

#### AC5.3.8 - Mark where the deepest fall starts and ends

_Team amendment 2026-10-05 · Should · not in v5_

> Given the buffer is displayed, When I view the running balance, Then the month the deepest fall starts from and the month it reaches bottom are named and marked on the chart.

#### AC5.3.9 - Say when the months do not catch up

_Team amendment 2026-10-05 · Must · not in v5_

> Given my running balance ends the record lower than it started, When the buffer is displayed, Then RuMampu states in ringgit how far the recorded months fell short over the whole record, and that a one-off buffer would not cover a further year like it, without saying whether I can afford the home.

### US5.4 - Review financing preparation documents

**User Story:** As a prospective homebuyer, I want a checklist of documents and visible financing criteria so that I can understand what information may be useful when preparing for financing.

**Relevant screen(s):** Documents and financing

**Figma:** B27 Documents and financing

#### AC5.4.1 - Display document checklist

_v5 build tag: [v24]_

> Given I open Documents & financing, When the screen loads, Then a checklist of financing-related documents is displayed.

#### AC5.4.2 - Include visible document types

_v5 build tag: [v24]_

> Given the checklist is displayed, When I review it, Then it includes the document types shown in the design, including bank statements, e-hailing earnings summary, statutory declaration of income, EPF statement and list of existing commitments.

#### AC5.4.3 - Toggle checklist items

_v5 build tag: [v24]_

> Given a checklist item is displayed, When I select it, Then its checked or unchecked state is visibly updated.

#### AC5.4.4 - Display SJKP published criteria

_v5 build tag: [v24]_

> Given I am viewing Documents & financing, When I reach the SJKP information section, Then the visible published criteria are displayed.

#### AC5.4.5 - Display source and date

_v5 build tag: [v24]_

> Given published criteria are shown, When I read the section, Then the source and displayed publication/reference date are also shown.

#### AC5.4.6 - Avoid displaying unsupported approval status

_v5 build tag: [v24]_

> Given RuMampu's income measure differs from the displayed SJKP income measure, When the 65% check is shown, Then the interface states that the check needs review rather than showing a pass or fail.

#### AC5.4.7 - Display financing disclaimer

_v5 build tag: [v24]_

> Given I am reviewing the financing information, When I read the disclaimer, Then RuMampu states that it does not apply for the user and cannot tell the user whether a bank will approve them.

### US5.8 - Count my savings once across the cash buffer and the upfront costs

_Team amendment 2026-10-05 · new user story · not in v5_

**User Story:** As a prospective homebuyer whose income changes from month to month, I want RuMampu to set aside my cash buffer first and count only the rest towards the upfront costs, so that the same ringgit is never counted for two goals.

**Relevant screen(s):** Before you move in, Cash buffer, House, Home, Saving plan

**Figma:** B26 Before you move in · B15 Cash buffer · B3 House (rule as in the v27b prototype)

#### AC5.8.1 - Hold the buffer first

_Must_

> Given I have kept a house test whose cash buffer is above RM 0, and my pot holds money, When RuMampu works out what I have for the upfront costs, Then it first holds the smaller of my pot and the buffer, and counts only what is left towards the upfront costs.

#### AC5.8.2 - One reading on every screen

_Must_

> Given part of my pot is held as my cash buffer, When I view Before you move in, House and the Saving plan, Then each shows the same amount held and the same amount towards the upfront costs, the two add up to my pot, and Home states what is still to go for the buffer and the upfront cash together.

#### AC5.8.3 - Say what is held

_Must_

> Given part of my pot is held as my cash buffer, When You have is displayed, Then RuMampu says how much of my pot is held as my cash buffer and that only the rest counts here.

#### AC5.8.4 - Show how much of the buffer is covered

_Must_

> Given a cash buffer above RM 0 has been calculated, When I open Cash buffer, Then RuMampu shows how much of the buffer my pot already covers and how much is still to set aside.

#### AC5.8.5 - Nothing is held without a buffer

_Must_

> Given I have no kept house test, or the cash buffer is RM 0, When You have is displayed, Then nothing is held and my whole pot counts towards the upfront costs.

#### AC5.8.6 - Amounts, not a verdict

_Must_

> Given my pot does not cover the cash buffer and the upfront costs together, When the shortfall is shown, Then it is stated in ringgit only, and RuMampu does not say whether I can or cannot afford the home.

#### AC5.8.7 - Say when the held amount changes

_Should_

> Given I keep a newer house test with a different cash buffer, When You have is next displayed, Then RuMampu says that the amount held has changed and why, and my pot is untouched.

#### AC5.8.8 - Go on to the saving plan

_Should_

> Given part of the cash buffer is still to set aside, When I view how much is covered, Then I can open the Saving plan from Cash buffer.

#### AC5.8.9 - Using the buffer takes it off the pot

_Should · added 2026-10-06 after team review_

> Given part of my pot is held as my cash buffer, When I use money from the buffer, Then the amount is taken off my pot, the buffer is refilled from the rest of the pot first, and what counts towards the upfront costs goes down by the amount used.

Example: a RM 10,000 pot with a RM 3,000 buffer holds RM 3,000 and counts RM 7,000 towards upfront costs. After using RM 1,000, the pot is RM 9,000, the buffer is still RM 3,000, and RM 6,000 counts towards upfront costs. Built 2026-10-06: Cash buffer has "I used some of my safety money", which records the amount (up to what the buffer holds) and confirms it calmly. The placement was chosen by the developer, as v27b4 has no design for it, and is shared with the team for review.

#### AC5.8.10 - Name my safety money

_Should · added 2026-10-06 at the team's request; built_

> Given I have a cash buffer, When I give it a name of my own, Then RuMampu uses that name wherever it refers to the buffer, keeps it with my plan, and goes back to the default name ("safety money") if I clear it.

Built on Cash buffer: "Name it" under the title, at most 30 characters. Every on-screen string that refers to the buffer reads the name; the page title stays "Cash buffer".
