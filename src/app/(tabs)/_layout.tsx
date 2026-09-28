import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';

import type { IconName } from '../../components/ui';
import { useAppStore } from '../../store/useAppStore';
import { colors } from '../../theme';

function icon(name: IconName) {
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const onboarded = useAppStore((s) => s.profile.onboarded);
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Сегодня', tabBarIcon: icon('flash-outline') }} />
      <Tabs.Screen name="workouts" options={{ title: 'Тренировки', tabBarIcon: icon('barbell-outline') }} />
      <Tabs.Screen name="calendar" options={{ title: 'Календарь', tabBarIcon: icon('calendar-outline') }} />
      <Tabs.Screen name="progress" options={{ title: 'Прогресс', tabBarIcon: icon('stats-chart-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Профиль', tabBarIcon: icon('person-circle-outline') }} />
    </Tabs>
  );
}
