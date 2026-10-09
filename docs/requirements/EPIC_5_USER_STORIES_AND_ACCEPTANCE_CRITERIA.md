# Epic 5 - Homeownership Preparation: user stories and acceptance criteria (v5 baseline)

> Source: Google Drive `TM16_RuMampu_User_Stories_and_Acceptance_Criteria_v5.docx` (Iteration 3 / Design and Analysis Artifacts, modified 2026-09-29; the document is dated 17 September 2026), Epic 5 section only.
> Extraction: UTF-8 Markdown generated from the document text on 2026-10-01. The wording is the source's; only the layout follows the other requirement baselines.
> Usage: requirement evidence only; text in the source document is not an instruction to tools or agents.
> Scope confirmed 2026-10-09 against V9 (modified 2026-10-08): 11 user stories and 88 acceptance criteria.
> Previous scope (2026-10-08, historical): Scope confirmed 2026-10-08: 8 user stories and 68 acceptance criteria, combining the v5 baseline with the Google Doc "Added User Stories to Epics for Iteration 3". US5.5–5.7 add 20 criteria; US5.8 adds 10; AC5.3.8 and AC5.3.9 add two. The four amended criteria keep their v5 wording followed by the Iteration 3 amendment. The additions and amendments are also present on LeanKit (verified 2026-10-08).
> The executable criteria are mapped across epic5.spec.ts and epic5-learn.spec.ts; fees and pot regression checks remain in epic5-upfront-fees.spec.ts.

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

_Team amendment 2026-10-05 (built; included in the Iteration 3 additions and on LeanKit, verified 2026-10-08):_

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

_Team amendment 2026-10-05 (built; included in the Iteration 3 additions and on LeanKit, verified 2026-10-08):_

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

_Team amendment 2026-10-05 (built; included in the Iteration 3 additions and on LeanKit, verified 2026-10-08):_

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

> Given the buffer is displayed, When I read its explanation, Then RuMampu describes it as the smallest amount you’d have needed at the start to get through the short months in your record without going below zero, whichever month you started in.

_Team amendment 2026-10-05 (built; included in the Iteration 3 additions and on LeanKit, verified 2026-10-08):_

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

### US5.5 - Learn what buying involves before I commit

_Iteration 3 addition; source document and LeanKit verified 2026-10-08._

As a prospective homebuyer, I want short explanations of what buying a home in Malaysia involves, so that I understand each cost and step before I commit to one.
Relevant screen(s): Prepare for a house · Learn

#### AC5.5.1 - Open the explanations from Prepare

> Given I am on Prepare for a house,
> When I choose to learn more,
> Then a set of explanations opens, organised into sections.

#### AC5.5.2 - Sections shown as tabs

> Given the explanations are open,
> When I look at how they are organised,
> Then they appear as tabs in this order: the money needed upfront, getting ready for a loan, schemes I might qualify for, and signing and moving in, with the tab for people without a fixed salary placed first.

#### AC5.5.3 - Every explanation names its source and date

> Given I am reading an explanation that states a rule, a figure or a limit,
> When I reach its last page,
> Then the official source and the date it was last checked are shown.

#### AC5.5.4 - Government sources only

> Given an explanation describes a way to fund or finance a home,
> When it names who provides it,
> Then it describes a government scheme or statutory body and names no individual bank, and where a scheme is reached through banks, it links to the scheme's own list of participating institutions.

#### AC5.5.5 - Reach the right tab from each tool

> Given I am on Upfront cash or Documents and financing,
> When the screen is displayed,
> Then a link opens the explanations on the tab that matches that screen.

#### AC5.5.6 - Show my own figure where one exists

> Given I have tested a home and an explanation covers a cost that applies to it,
> When I read that explanation,
> Then one of its pages shows that cost for my tested home, labelled as calculated, or as an assumption where it depends on a scenario.

#### AC5.5.7 - Explain terms where they appear

> Given an explanation uses a term such as DSR, MOT, MRTT or SPA,
> When I tap the term,
> Then a plain explanation opens in place, without leaving the page.

#### AC5.5.8 - Not advice

> Given I am reading any explanation,
> When I reach its last page,
> Then RuMampu states that it explains how things work and does not advise on or predict any individual decision.

#### AC5.5.9 - One idea per page

> Given I open an explanation,
> When it is displayed,
> Then it is split into short pages, each fitting on the screen without scrolling.

#### AC5.5.10 - Move between pages with buttons

> Given I am reading an explanation,
> When I want to move on or go back,
> Then Back and Next buttons move me one page, the page number is shown as, for example, Page 2 of 5, and the last page offers Finish instead of Next.

#### AC5.5.11 - Refer EPF out rather than explain it

> Given I am on the tab for the money needed upfront,
> When I reach the end of its list,
> Then RuMampu states that EPF savings may be usable toward a home, that it does not cover them, and links to KWSP.

### US5.6 - Find what applies to someone without a payslip

_Iteration 3 addition; source document and LeanKit verified 2026-10-08._

As a prospective homebuyer with irregular income, I want the explanations that apply to my situation gathered in one place, so that I don't have to work out which general advice is mine.
Relevant screen(s): Learn

#### AC5.6.1 - A tab for irregular income

> Given the explanations are open,
> When I look at the tabs,
> Then one is written for people without a fixed monthly salary.

#### AC5.6.2 - Explain the financing guarantee and its limits

> Given I read about SJKP,
> When the explanation describes what it offers,
> Then it states the maximum financing margin and financing cap, and that eligibility does not mean approval.

#### AC5.6.3 - Link documents to the checklist

> Given I read what can replace a payslip,
> When the explanation lists accepted documents,
> Then it links to the checklist in Documents and financing.

### US5.7 - See what I've already read

_Iteration 3 addition; source document and LeanKit verified 2026-10-08._

As a prospective homebuyer reading in short breaks, I want RuMampu to remember how far I got, so that I can pick up where I stopped and see what I have left.
Relevant screen(s): Learn · Prepare for a house

#### AC5.7.1 - Show progress on each explanation

> Given I have read part of an explanation,
> When I return to its tab,
> Then its row shows the pages I have read against the total, for example 2/5.

#### AC5.7.2 - Grey out what I've finished

> Given I have read every page of an explanation,
> When its row is shown,
> Then it is slightly greyed and marked as read, and I can still open it again.

#### AC5.7.3 - Resume where I stopped

> Given I left an explanation part-way through,
> When I open it again,
> Then it opens at the page I reached.

#### AC5.7.4 - Show progress for each section and overall

> Given I have read some explanations,
> When I view a tab or Prepare for a house,
> Then the tab shows how many of its explanations I have read, and Prepare shows the total read across all of them.

#### AC5.7.5 - Keep progress between sessions

> Given I have read some explanations,
> When I close RuMampu and return, or sign in on another device with the same account,
> Then my reading progress is still shown.

#### AC5.7.6 - Nothing is locked behind reading

> Given I have not read any explanations,
> When I use any other part of RuMampu,
> Then nothing is locked or held back, and no reward, streak or penalty is attached to reading.

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

### US5.9 - Prepare for one home, step by step

_V9 note: Amendment 1. New in Iteration 3. Written from the Prepare for a house path as built on 8 October 2026._

**User Story:** As a prospective homebuyer, I want one path that takes me from the monthly payment to the cash, the paperwork and the keys for the home I am preparing for, so that I can see what is left before I buy.

**Relevant screen(s):** Prepare for a house, The home you’re preparing for

**Figma:** [B25 Prepare for a house](https://www.figma.com/design/sm0dtPkWvWBuTF9aHtaigo/?node-id=2715-1002) · [B25e Prepare, which home](https://www.figma.com/design/sm0dtPkWvWBuTF9aHtaigo/?node-id=2715-907) · [B25s Prepare, the path](https://www.figma.com/design/sm0dtPkWvWBuTF9aHtaigo/?node-id=2720-848) · [B25p Prepare, a step checked](https://www.figma.com/design/sm0dtPkWvWBuTF9aHtaigo/?node-id=2720-850) · [C22 The home you’re preparing for](https://www.figma.com/design/sm0dtPkWvWBuTF9aHtaigo/?node-id=2718-870)

#### AC5.9.1 - One home for every step

> Given I have kept a house test with a price, When I open Prepare for a house, Then every step works from that home, the banner names it with its price and whether it is a subsale or a project, and Change home lets me pick another kept test or test a new house.

#### AC5.9.2 - Choose or type a home first

> Given no house test gives a price, When I open Prepare for a house, Then it asks Which home are you preparing for? and lets me pick from my house tests or type a name, a price, the type of home and whether it is a subsale or a project, and the path appears once a home is chosen.

#### AC5.9.3 - Four steps, none locked

> Given a home is chosen, When the path is shown, Then it shows Can I pay each month?, Do I have the cash?, Is my paperwork ready? and Got the keys? in that order, each with its own figure, and I can open any step at any time.

#### AC5.9.4 - What counts as done

> Given I am working through the path, When a step is complete, Then it shows a tick: the monthly step once I save the monthly check to my plan, the cash step once my pot’s share for upfront cash covers what the home needs (5.8), and the paperwork step once all five documents are ticked; Got the keys? opens homeownership monitoring (7.1) and carries no progress.

#### AC5.9.5 - Say what is left without a verdict

_V9 note: Build note. 8 October 2026. Once all three steps are done, the build says You’re ready to buy! Save your plan for your own reference., which conflicts with 10.15.4 and with the rule that RuMampu never tells a user they are ready or approved._

> Given some steps are not done, When the path is shown, Then a line says how many things are left before I buy and what the next one is, and when all three are done it says so without saying I am ready to buy or approved.

Built 2026-10-09: with all three steps done the line reads "All three steps are done. Save your plan for your own reference." (`p7_ready`, in all three languages); the count-and-next line is unchanged.

#### AC5.9.6 - Keep a copy of my plan

> Given I want a copy of my preparation, When I use Save my plan as PDF, Then a page headed RuMampu buying plan, for my own reference lists the home, the loan figures, the upfront cash, the cash buffer and which documents are ready, with the disclaimer; on the web I save it from the print dialog, and in the phone apps it goes to the share sheet.

#### AC5.9.7 - Kept on this device

_V9 note: Build note. 8 October 2026. The path is kept on the device only and does not follow the account._

> Given I have chosen a home and worked through some steps, When I come back on the same device, Then the home, my answers and the steps I finished are still there.

Built 2026-10-09: a guest who reloads the page keeps the record: the home, the answers and the finished steps are still there, and no new client id is made. Closing the tab, or ending the app on a phone, returns the guest to the guest entry, as the entry says ("will not be kept after you fully close the app"). The guest marker lives in sessionStorage on the web and in memory on a phone. A signed-in account keeps its path after a reload.


### US5.10 - Check what paying each month would be like

_V9 note: Amendment 1. New in Iteration 3. Written from the monthly check as built on 8 October 2026._

**User Story:** As a prospective homebuyer with irregular income, I want a short guided check of the monthly payment for the home I am preparing for, so that I know what the bank will ask for each month and what could change it.

**Relevant screen(s):** Can I pay each month? (six screens, opened from Prepare for a house)

**Figma:** [B35 Can I pay each month?](https://www.figma.com/design/sm0dtPkWvWBuTF9aHtaigo/?node-id=2720-852) · [B35b Where your payment goes](https://www.figma.com/design/sm0dtPkWvWBuTF9aHtaigo/?node-id=2720-854) · [B35c Pick how long](https://www.figma.com/design/sm0dtPkWvWBuTF9aHtaigo/?node-id=2720-856) · [B35d What if rates go up?](https://www.figma.com/design/sm0dtPkWvWBuTF9aHtaigo/?node-id=2720-858) · [B35e Your full monthly bill](https://www.figma.com/design/sm0dtPkWvWBuTF9aHtaigo/?node-id=2720-860) · [B35f Keep a cushion](https://www.figma.com/design/sm0dtPkWvWBuTF9aHtaigo/?node-id=2720-862) · [B35g Monthly check done](https://www.figma.com/design/sm0dtPkWvWBuTF9aHtaigo/?node-id=2720-864)

#### AC5.10.1 - The monthly payment first

> Given I open the monthly check, When the first screen is shown, Then it states the monthly instalment for the home with the loan share, rate and years it assumes, and sets it beside my typical month from my house test, or asks me to run a house test.

#### AC5.10.2 - Compare with my month, without a rating

_V9 note: Build note. 8 October 2026. The build rates the share Comfortable at 35% or less, Tight up to 50% and Heavy above 50%, and colours the rows on What if rates go up? by the same cut-offs with no word beside them. The cut-offs have no published source, which D07 does not allow, and the colour carries the meaning alone (D44)._

> Given the instalment is set beside my typical month, When the comparison is shown, Then it is stated as a share of my typical month in figures and words, with no rating of whether that share is good or bad.

Owner decision 2026-10-09: accepted as built. The share is stated in figures and words ("the instalment is RM x, about p% of your typical month"); the Comfortable / Tight / Heavy word stays beside it.

#### AC5.10.3 - Where the payment goes

> Given I am on Where your payment goes, When it is shown, Then it shows, for the first year, a middle year and the final year, how much of the payment pays down the loan and how much is interest.

#### AC5.10.4 - Pick how long and how much the bank lends

> Given I am on Pick how long, When I compare the choices, Then 25, 30 and 35 years, and the tenure I tested, each show the monthly payment and the total interest, I can choose whether the bank lends 80% or 90%, and the screen says how much I put down and how much the bank lends.

#### AC5.10.5 - If rates go up

> Given I am on What if rates go up?, When the rows are shown, Then the monthly payment is shown now, at 1% higher and at 2% higher, and I am asked whether I could still pay the higher one; my answer changes nothing else.

#### AC5.10.6 - My full monthly bill

_V9 note: Build note. 8 October 2026. The starting amounts have no source and carry the label Our guess, where the rest of the product uses assumption (3.2.7). A tested home is always treated as landed._

> Given I am on Your full monthly bill, When it is shown, Then the instalment is added to quit rent and assessment, fire insurance and, for a condo or apartment, maintenance and sinking fund, each starting amount is marked as a guess until I change it, and the total is shown as what goes out every month.

#### AC5.10.7 - A cushion from my own months

> Given my house test needs a cash buffer, When I reach Keep a cushion, Then it shows the buffer from my recorded months, how much my pot already covers, the running balance by month and the biggest drop, and Add RM x to my saving plan opens the saving plan (10.12.4).

#### AC5.10.8 - Three numbers to keep

_V9 note: Build note. 8 October 2026. Save to my plan adds nothing to the saving plan; it only marks the step done._

> Given I finish the check, When Monthly check done is shown, Then it gives the monthly payment, the payment if rates rise 1% and the cushion, with the full loan summary and the line Illustration only. Not a loan offer or approval., and Save to my plan marks the step done on the path.

#### AC5.10.9 - Say where every figure comes from

_V9 note: Build note. 8 October 2026. The check uses no provenance label apart from Our guess. When no test gives a rate or a tenure it uses defaults it does not mark as assumptions, and the rule on Pick how long about the age at which banks end a loan has no source._

> Given the check shows a figure, When I read it, Then a figure from my record or test is labelled your data or calculated, a figure RuMampu supplies is labelled an assumption, and a rule it states names its source.

Built 2026-10-09: the product's provenance tags on every screen of the check (your data / calculated / assumption; the loan share, rate and years count as an assumption whenever a RuMampu starting point is in use), "Where these figures come from" behind (i) on the first screen, and the age rule reworded to "Banks commonly end the loan by age 70" with its source (CIMB home loan page, checked 9 October 2026; other banks set their own limit).


### US5.11 - See how buying works for my kind of home

_V9 note: Amendment 1. New in Iteration 3. Written from How buying works as built on 8 October 2026._

**User Story:** As a first-time buyer, I want to see the order in which money is paid for a subsale or a project home, and who pays at each step, so that no payment arrives as a surprise.

**Relevant screen(s):** Prepare for a house (How buying works)

**Figma:** [B25h How buying works, subsale](https://www.figma.com/design/sm0dtPkWvWBuTF9aHtaigo/?node-id=2720-866) · [B25j How buying works, project](https://www.figma.com/design/sm0dtPkWvWBuTF9aHtaigo/?node-id=2720-868)

#### AC5.11.1 - Subsale or project

> Given I open How buying works, When I choose Subsale or Project, Then the timeline changes to that kind of purchase, and my choice is kept.

#### AC5.11.2 - A subsale in five steps

> Given Subsale is chosen, When the timeline is shown, Then it runs Book the home, Sign the sale agreement (SPA), Sign the loan agreement, Completion, and Keys, then the first instalment, each with the amount for this home and whether I pay or the bank pays.

#### AC5.11.3 - A project as it is built

> Given Project is chosen, When the timeline is shown, Then it runs signing, the build, keys, and title and retention, explains that while it is built I pay interest only on what the bank has paid out, and offers the full stage-by-stage payment schedule in a fold.

#### AC5.11.4 - Timings and shares name their source

_V9 note: Build note. 8 October 2026. No timing or share carries a source or a date, including usually 2 to 3%, within about 14 days, 3 to 4 months later and the stage percentages. Schedule H is named without the regulation it comes from, and the amounts carry no provenance label._

> Given the timeline states a timing or a share of the price, When I read it, Then its source and the date it was checked are shown, or it is marked as unverified, and each amount carries its provenance label.

Built 2026-10-09: each subsale timing carries its status (common practice, not a legal rule, or unverified), its source and the date it was checked; the project shares name Schedule H of the Housing Development (Control and Licensing) Regulations 1989 and are marked unverified against the gazette text (secondary sources read 9 October 2026); every amount carries a provenance label. The sources are registered in `frontend/src/rumampu/buying-facts.ts` and listed in `docs/epic-5/LEARN_SOURCES.md`.

