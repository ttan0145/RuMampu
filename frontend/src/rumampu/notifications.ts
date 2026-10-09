import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Lang, STRINGS } from './strings';
import {
  nextBillReminderDates, nextReminderDate, parseReminderTime, reminderRepeat,
  type RecordReminderKind, type ReminderRule,
} from './reminder-date';

const CHANNEL_ID = 'record-reminders';
const IDENTIFIER_BUNDLE_PREFIX = 'rumampu-bill-reminders-v1:';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Record reminders',
    description: 'Private reminders to record your income or expenses.',
    // HIGH lets Android show the reminder as a pop-up banner, not only in the shade.
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    sound: null,
  });
}

export async function askForNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}

export function notificationSchedulingSupported(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}

/* What the notification says, in the app's language, and which entry screen it
   opens. Neither line carries an amount or a balance (8.23). */
const KIND_CONTENT: Record<RecordReminderKind, { key: string; route: string }> = {
  income: { key: 'nt_push_income', route: 'income' },
  expenses: { key: 'nt_push_expenses', route: 'expenses' },
};

export async function scheduleRecordReminder(
  kind: RecordReminderKind,
  rule: ReminderRule,
  lang: Lang,
): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  await ensureChannel();
  const time = parseReminderTime(rule.time);
  if (!time) throw new RangeError('Reminder time must use 24-hour HH:MM format.');
  const content = {
    title: 'RuMampu',
    // AC8.23.1: no amount, shortfall, balance, or guilt language may appear
    // outside the protected app.
    body: String(STRINGS[lang][KIND_CONTENT[kind].key] ?? STRINGS.en[KIND_CONTENT[kind].key]),
    data: { route: KIND_CONTENT[kind].route },
    sound: false,
  };
  const triggers: Notifications.NotificationTriggerInput[] = [];
  switch (reminderRepeat(rule)) {
    case 'daily':
      // One native repeating notification: no pending-count limit to manage.
      triggers.push({ type: Notifications.SchedulableTriggerInputTypes.DAILY, channelId: CHANNEL_ID, hour: time.hour, minute: time.minute });
      break;
    case 'weekly':
      // Expo counts weekdays from 1 = Sunday; the saved rule uses Date.getDay() (0 = Sunday).
      triggers.push({
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY, channelId: CHANNEL_ID,
        weekday: (rule.weekday ?? 1) + 1, hour: time.hour, minute: time.minute,
      });
      break;
    case 'once': {
      const date = nextReminderDate(rule, new Date());
      // A one-off date that has already passed has nothing left to schedule.
      if (!date) return null;
      triggers.push({ type: Notifications.SchedulableTriggerInputTypes.DATE, channelId: CHANNEL_ID, date });
      break;
    }
    default: {
      // A repeating day-31 calendar trigger skips short months on native platforms.
      // Use a rolling window of concrete dates instead, well below iOS's
      // pending-notification limit; Android can safely keep two years. Opening
      // the app or saving a reminder refreshes the window.
      const horizon = Platform.OS === 'ios' ? 8 : 24;
      for (const date of nextBillReminderDates(rule.day, rule.time, new Date(), horizon)) {
        triggers.push({ type: Notifications.SchedulableTriggerInputTypes.DATE, channelId: CHANNEL_ID, date });
      }
    }
  }
  const identifiers: string[] = [];
  try {
    for (const trigger of triggers) {
      identifiers.push(await Notifications.scheduleNotificationAsync({ content, trigger }));
    }
  } catch (error) {
    await Promise.all(identifiers.map(identifier => Notifications.cancelScheduledNotificationAsync(identifier)));
    throw error;
  }
  return IDENTIFIER_BUNDLE_PREFIX + JSON.stringify(identifiers);
}

export async function cancelReminder(identifier: string | null | undefined): Promise<void> {
  if (!identifier || Platform.OS === 'web') return;
  let identifiers = [identifier];
  if (identifier.startsWith(IDENTIFIER_BUNDLE_PREFIX)) {
    try {
      const decoded: unknown = JSON.parse(identifier.slice(IDENTIFIER_BUNDLE_PREFIX.length));
      if (Array.isArray(decoded) && decoded.every(value => typeof value === 'string')) identifiers = decoded;
    } catch { /* Preserve compatibility with old single notification identifiers. */ }
  }
  await Promise.all(identifiers.map(value => Notifications.cancelScheduledNotificationAsync(value)));
}

export async function cancelEveryReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export function listenForNotificationOpen(onOpen: (data: { route: string }) => void): () => void {
  if (Platform.OS === 'web') return () => undefined;
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    const route = response.notification.request.content.data?.route;
    if (typeof route === 'string') onOpen({ route });
  });
  return () => subscription.remove();
}
