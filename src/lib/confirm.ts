import { Alert, Platform } from 'react-native';

/** Подтверждение действия: Alert на iOS/Android, window.confirm в браузере (там Alert не работает). */
export function confirm(title: string, message: string, onConfirm: () => void, confirmText = 'Удалить') {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Отмена', style: 'cancel' },
    { text: confirmText, style: 'destructive', onPress: onConfirm },
  ]);
}

export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    globalThis.alert?.(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
