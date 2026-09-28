import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

import { useAppStore } from '../store/useAppStore';

const isWeb = Platform.OS === 'web';

export function tap() {
  if (isWeb || !useAppStore.getState().settings.vibration) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function tick() {
  if (isWeb || !useAppStore.getState().settings.vibration) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function success() {
  if (isWeb || !useAppStore.getState().settings.vibration) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function say(text: string) {
  if (!useAppStore.getState().settings.voice) return;
  try {
    Speech.stop();
    Speech.speak(text, { language: 'ru-RU', rate: 1.05 });
  } catch {
    // Синтез речи недоступен — молча пропускаем.
  }
}

// ——— Уведомления об окончании отдыха (если приложение свёрнуто) ———

let configured = false;

export async function setupNotifications(): Promise<void> {
  if (isWeb || configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('rest-timer', {
      name: 'Таймер отдыха',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 150, 300],
    }).catch(() => {});
  }
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

let scheduledId: string | null = null;

export async function scheduleRestEnd(seconds: number, nextName?: string): Promise<void> {
  await cancelRestEnd();
  if (isWeb || seconds < 5 || !useAppStore.getState().settings.restNotifications) return;
  try {
    if (!(await ensurePermission())) return;
    scheduledId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Отдых окончен 💪',
        body: nextName ? `Следующий подход: ${nextName}` : 'Пора к следующему подходу',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.round(seconds),
        channelId: 'rest-timer',
      },
    });
  } catch {
    scheduledId = null;
  }
}

export async function cancelRestEnd(): Promise<void> {
  if (isWeb || !scheduledId) return;
  const id = scheduledId;
  scheduledId = null;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}
