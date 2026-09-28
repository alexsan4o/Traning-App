import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

import { notify } from './confirm';

/** Поделиться текстом: системное меню на телефоне, буфер обмена в браузере. */
export async function shareText(text: string, title: string): Promise<void> {
  if (Platform.OS === 'web') {
    await Clipboard.setStringAsync(text);
    notify('Скопировано в буфер обмена', 'Вставьте текст в «Импорт» на другом устройстве.');
    return;
  }
  try {
    await Share.share({ message: text, title });
  } catch {
    await Clipboard.setStringAsync(text);
    notify('Скопировано в буфер обмена');
  }
}
