export const MIN_REMINDER_DAY = 1;
export const MAX_REMINDER_DAY = 31;

export function isValidReminderDay(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_REMINDER_DAY && value <= MAX_REMINDER_DAY;
}

export function parseReminderTime(time: string): { hour: number; minute: number } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}

/** Return the requested day, or the month's last calendar day when it is shorter. */
export function billReminderDateForMonth(
  year: number,
  month: number,
  day: number,
  time: string,
): Date {
  if (!isValidReminderDay(day)) throw new RangeError('Reminder day must be a whole number from 1 to 31.');
  const parsedTime = parseReminderTime(time);
  if (!parsedTime) throw new RangeError('Reminder time must use 24-hour HH:MM format.');
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay), parsedTime.hour, parsedTime.minute, 0, 0);
}

/** Build a rolling set of real dates so short months are never silently skipped. */
export function nextBillReminderDates(
  day: number,
  time: string,
  now: Date,
  count: number,
): Date[] {
  if (!Number.isInteger(count) || count < 1) throw new RangeError('Reminder date count must be positive.');
  const dates: Date[] = [];
  for (let offset = 0; dates.length < count; offset += 1) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const candidate = billReminderDateForMonth(
      monthStart.getFullYear(),
      monthStart.getMonth(),
      day,
      time,
    );
    if (candidate.getTime() > now.getTime()) dates.push(candidate);
  }
  return dates;
}
