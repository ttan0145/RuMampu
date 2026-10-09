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

/* Calendar-style reminders: every day at a time, every week on a weekday, every
   month on a day (the original rule), or once on a chosen date. A saved
   reminder without `repeat` is monthly, so reminders saved before this change
   keep working unchanged. `day` is always kept (1 to 31) for that reason. */
export type ReminderRepeat = 'daily' | 'weekly' | 'monthly' | 'once';
export const REMINDER_REPEATS: ReminderRepeat[] = ['daily', 'weekly', 'monthly', 'once'];

export interface ReminderRule {
  repeat?: ReminderRepeat;
  day: number;
  time: string;
  /** 0 = Sunday … 6 = Saturday, as in Date.getDay(). Weekly only. */
  weekday?: number;
  /** YYYY-MM-DD. Once only. */
  date?: string;
}

export function reminderRepeat(rule: Pick<ReminderRule, 'repeat'>): ReminderRepeat {
  return rule.repeat ?? 'monthly';
}

export function isValidReminderWeekday(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 6;
}

export function isValidReminderDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1
    && date.getDate() === Number(match[3]);
}

/** Shape check shared by local storage, account sync and the reminder sheet. */
export function isValidReminderRule(value: Record<string, unknown>): boolean {
  if (!isValidReminderDay(value.day as number)) return false;
  if (typeof value.time !== 'string' || !parseReminderTime(value.time)) return false;
  if (value.repeat !== undefined && !REMINDER_REPEATS.includes(value.repeat as ReminderRepeat)) return false;
  if (value.weekday !== undefined && !isValidReminderWeekday(value.weekday)) return false;
  if (value.date !== undefined && !isValidReminderDate(value.date)) return false;
  if (value.repeat === 'weekly' && value.weekday === undefined) return false;
  if (value.repeat === 'once' && value.date === undefined) return false;
  return true;
}

/** The moment a one-off reminder fires, in local time. */
export function onceReminderDate(date: string, time: string): Date {
  const parsedTime = parseReminderTime(time);
  if (!isValidReminderDate(date) || !parsedTime) throw new RangeError('A one-off reminder needs a valid date and time.');
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, parsedTime.hour, parsedTime.minute, 0, 0);
}

/** The next time this reminder fires after `now`, or null for a one-off in the past. */
export function nextReminderDate(rule: ReminderRule, now: Date): Date | null {
  const parsedTime = parseReminderTime(rule.time);
  if (!parsedTime) return null;
  const at = (base: Date, addDays: number) => new Date(
    base.getFullYear(), base.getMonth(), base.getDate() + addDays, parsedTime.hour, parsedTime.minute, 0, 0,
  );
  switch (reminderRepeat(rule)) {
    case 'once': {
      if (!rule.date || !isValidReminderDate(rule.date)) return null;
      const when = onceReminderDate(rule.date, rule.time);
      return when.getTime() > now.getTime() ? when : null;
    }
    case 'daily': {
      const today = at(now, 0);
      return today.getTime() > now.getTime() ? today : at(now, 1);
    }
    case 'weekly': {
      const weekday = isValidReminderWeekday(rule.weekday) ? rule.weekday : 1;
      const ahead = (weekday - now.getDay() + 7) % 7;
      const candidate = at(now, ahead);
      return candidate.getTime() > now.getTime() ? candidate : at(now, ahead + 7);
    }
    default:
      return nextBillReminderDates(rule.day, rule.time, now, 1)[0];
  }
}

/* What a reminder asks the person to record. Each kind has one reminder,
   saved under its own key in notificationPreferences.reminders. */
export type RecordReminderKind = 'income' | 'expenses';
export const RECORD_REMINDER_KINDS: RecordReminderKind[] = ['income', 'expenses'];

export function isRecordReminderKind(value: string): value is RecordReminderKind {
  return (RECORD_REMINDER_KINDS as string[]).includes(value);
}
