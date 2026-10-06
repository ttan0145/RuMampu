# Iteration 3 Epic 7 and Epic 8

This implementation covers Epic 7 and the Epic 8 work after US8.17.

## Homeownership monitoring

- The mode change is persisted locally for guests and in account state for signed-in users.
- The purchase month is required and persisted, separating planning history from post-purchase monitoring.
- Actual monthly income reuses the canonical work-cost summary: recorded gross income minus dated work costs.
- Actual home costs are stored in `HomeownershipMonth` and remain isolated by guest or account profile.
- The comparison keeps the earlier calculated test visually separate from post-purchase user data and identifies post-purchase months that were outside the earlier test history.

## Notifications

- Each bill has an inline reminder control with its own day (1 to 28), time and enabled state.
- Android and iOS schedule local notifications; web keeps the configuration visible and explains that scheduling requires the mobile app.
- Notification permission is requested only when the first reminder is enabled.
- Lock-screen content is deliberately generic and contains no bill name, amount, balance, or shortfall.
- Opening a reminder presents a prefilled expense for confirmation; it writes nothing until the user confirms.
- Reminder settings and notification identifiers remain on the device. Logout and record deletion cancel all scheduled reminders.
- Profile contains independent switches for bill reminders and record safety warnings.

The Android app must be rebuilt after adding `expo-notifications`; Expo config plugins are applied at build time.

## Record retention

- Any profile-owned API action refreshes `last_active_at`.
- A guest returning after four inactive months sees the former removal date; that visit itself keeps the record active.
- The retention command emails accounts after five inactive months and records successful delivery.
- At six inactive months, an account is removed only if that email was recorded as sent. Guests that never return are removed at six months.

Run this command once per day in the deployment scheduler:

```bash
python manage.py process_record_retention
```

Use `--dry-run` to report counts without sending email or deleting records.
