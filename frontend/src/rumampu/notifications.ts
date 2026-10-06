import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'bill-reminders';

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
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  const hour = match ? Number(match[1]) : 9;
  const minute = match ? Number(match[2]) : 0;
  return Notifications.scheduleNotificationAsync({
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
      type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
      channelId: CHANNEL_ID,
      day: Math.min(28, Math.max(1, Math.round(day))),
      hour,
      minute,
    },
  });
}

export async function cancelReminder(identifier: string | null | undefined): Promise<void> {
  if (!identifier || Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(identifier);
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
