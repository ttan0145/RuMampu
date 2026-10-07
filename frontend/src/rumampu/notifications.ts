import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { nextBillReminderDates } from './reminder-date';

const CHANNEL_ID = 'bill-reminders';
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
    name: 'Bill reminders',
    description: 'Private reminders that something is waiting in RuMampu.',
    importance: Notifications.AndroidImportance.DEFAULT,
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

export async function schedulePrivateBillReminder(billId: string, day: number, time: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  await ensureChannel();
  // A repeating day-31 calendar trigger skips short months on native platforms.
  // Use a rolling window of concrete dates instead. Eight dates keep six bill
  // reminders below iOS's pending-notification limit; Android can safely keep
  // two years. Saving/editing a reminder refreshes the window.
  const horizon = Platform.OS === 'ios' ? 8 : 24;
  const dates = nextBillReminderDates(day, time, new Date(), horizon);
  const identifiers: string[] = [];
  try {
    for (const date of dates) {
      identifiers.push(await Notifications.scheduleNotificationAsync({
        content: {
          title: 'RuMampu',
          // AC8.23.1: no amount, bill name, shortfall, balance, or guilt language
          // may appear outside the protected app.
          body: 'Something is waiting in RuMampu.',
          // Identifying values stay in protected app data, never in title/body.
          data: { route: 'commit', billId },
          sound: false,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          channelId: CHANNEL_ID,
          date,
        },
      }));
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

export function listenForNotificationOpen(onOpen: (data: { route: string; billId?: string }) => void): () => void {
  if (Platform.OS === 'web') return () => undefined;
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    const route = response.notification.request.content.data?.route;
    const billId = response.notification.request.content.data?.billId;
    if (typeof route === 'string') onOpen({
      route,
      ...(typeof billId === 'string' ? { billId } : {}),
    });
  });
  return () => subscription.remove();
}
