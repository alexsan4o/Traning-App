import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_KEY = 'anthropic_api_key';

// В вебе SecureStore недоступен — используем локальное хранилище браузера.
const useFallback = Platform.OS === 'web';

export async function getApiKey(): Promise<string | null> {
  try {
    return useFallback ? await AsyncStorage.getItem(API_KEY) : await SecureStore.getItemAsync(API_KEY);
  } catch {
    return null;
  }
}

export async function setApiKey(value: string): Promise<void> {
  const trimmed = value.trim();
  if (!trimmed) return clearApiKey();
  if (useFallback) await AsyncStorage.setItem(API_KEY, trimmed);
  else await SecureStore.setItemAsync(API_KEY, trimmed);
}

export async function clearApiKey(): Promise<void> {
  if (useFallback) await AsyncStorage.removeItem(API_KEY);
  else await SecureStore.deleteItemAsync(API_KEY);
}
