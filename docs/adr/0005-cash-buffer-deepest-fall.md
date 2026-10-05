# ADR 0005: Measure the cash buffer as the deepest fall

Language: **English** | [Chinese (CN)](0005-cash-buffer-deepest-fall.cn.md)

- Status: Accepted, pending owner acceptance of the 2026-10-03 change
- Date: 2026-10-03

## Context

`starting_liquidity.required_amount` is the cash buffer shown on Cash buffer (US5.3) and used as the Saving plan's buffer target (Epic 10). It used to be the deepest point the running balance fell below zero, counted from the first recorded month. That made the figure depend on which month the record happens to start in. On the shared twelve-month fixture, at RM 1,900 a month the record from August needs RM 680, but the same months starting in January need RM 1,940; at RM 1,382.37 the August record says RM 0, while the months from January need RM 904.74. AC5.3.2 calls the buffer the smallest starting amount that gets through the recorded short months without going below zero, and the Saving plan reads the figure as what to set aside before buying, so understating it is the costly mistake.

## Decision

1. `required_amount` is the deepest fall of the running balance from an earlier high, or from the start, to a later low. It is the smallest opening amount that gets through the rest of the record whichever recorded month it started in. It is never lower than the earlier figure and equals it when the deepest fall starts at the beginning of the record.
2. The fall is measured in recorded order and does not wrap the record round. Wrapping would make a record that never catches up count its shortfall twice.
3. `starting_liquidity` adds `fall_start` (the month whose closing balance is the high the fall starts from, or null when it starts at the beginning of the record) and `fall_end` (the month where it bottoms out, or null when the balance never falls). Cash buffer uses them to say where the figure comes from and to mark those months on the running-balance chart.
4. The calculation stays in Django, as ADR 0004 requires.

## Consequences

- This changes the meaning of an existing v1 field, which the API contract treats as breaking. It is made in place because the only clients are the RuMampu app and the assistant service in this repository, both updated in the same change, and because the field still means the opening amount needed; it can only rise.
- The fixture regressions now expect RM 1,940, RM 904.74 and RM 4,740, and a direct test independently calculates the opening cash needed for every chronological suffix and checks that its maximum equals the whole record's buffer. Months are not rotated: shortening the record can reduce the buffer, for example to RM 1,260 for February to July 2026.
- A saved test (`result_snapshot`) and the result the app keeps on the device hold the figures they were run with, so a test run before this change keeps its old buffer until it is run again.
- A record whose running balance ends lower than it started still shows the whole fall as one buffer. Saying that such months do not catch up is a separate, proposed criterion (AC5.3.9) and is not part of this decision.
