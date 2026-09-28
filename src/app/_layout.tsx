import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useSyncExternalStore } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { setupNotifications } from '../lib/feedback';
import { useAppStore } from '../store/useAppStore';
import { colors } from '../theme';

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
  },
};

const subscribeHydration = (cb: () => void) => useAppStore.persist.onFinishHydration(cb);
const getHydrated = () => useAppStore.persist.hasHydrated();

function useHydrated(): boolean {
  return useSyncExternalStore(subscribeHydration, getHydrated, getHydrated);
}

export default function RootLayout() {
  const hydrated = useHydrated();

  useEffect(() => {
    setupNotifications().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        {hydrated ? (
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.text,
              headerTitleStyle: { fontWeight: '700' },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.bg },
              headerBackTitle: 'Назад',
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="generate" options={{ title: 'Генератор тренировки' }} />
            <Stack.Screen name="workout/[id]" options={{ title: 'Тренировка' }} />
            <Stack.Screen name="workout/edit" options={{ title: 'Конструктор' }} />
            <Stack.Screen name="workout/play" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="workout/summary" options={{ title: 'Итоги', headerBackVisible: false, gestureEnabled: false }} />
            <Stack.Screen name="exercise/[id]" options={{ title: 'Упражнение' }} />
            <Stack.Screen name="exercise-picker" options={{ title: 'Добавить упражнения', presentation: 'modal' }} />
            <Stack.Screen name="session/[id]" options={{ title: 'Запись тренировки' }} />
            <Stack.Screen name="reaction" options={{ title: 'Тест реакции' }} />
            <Stack.Screen name="import" options={{ title: 'Импорт', presentation: 'modal' }} />
          </Stack>
        ) : (
          <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
