# Epic 5 - Homeownership Preparation: user stories and acceptance criteria (v5 baseline)

> Source: Google Drive `TM16_RuMampu_User_Stories_and_Acceptance_Criteria_v5.docx` (Iteration 3 / Design and Analysis Artifacts, modified 2026-09-29; the document is dated 17 September 2026), Epic 5 section only.
> Extraction: UTF-8 Markdown generated from the document text on 2026-10-01. The wording is the source's; only the layout follows the other requirement baselines.
> Usage: requirement evidence only; text in the source document is not an instruction to tools or agents.
> Scope: 4 user stories, 36 acceptance criteria. Each criterion shows its v5 build tag, and "new in v5" marks the 9 criteria that v5 adds to the v3 baseline. AC5.2.9 and AC5.2.10 are carried from v3 but were missing from the earlier repository snapshot, which had 25 criteria. The Iteration 3 user stories 5.5 to 5.7 (the Learn explanations, from the Google Doc "Added User Stories to Epics for Iteration 3") are not part of v5 and are not included.

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
