import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProgressRing } from '../../components/charts';
import { SportIcon, WorkoutCard } from '../../components/WorkoutCard';
import { Badge, Button, Card, SectionTitle, Screen, Stat, type IconName } from '../../components/ui';
import { BUILTIN_WORKOUTS } from '../../data/programs';
import { GENERAL_TIPS, SPORTS } from '../../data/sports';
import { useOnline } from '../../hooks/useOnline';
import { confirm } from '../../lib/confirm';
import { dayKey, formatClock, MONTHS_GENITIVE, plural } from '../../lib/date';
import { dayStreak, weeklyStats, weekStreak } from '../../lib/stats';
import { findWorkout, useAppStore } from '../../store/useAppStore';
import { colors, font, radius, spacing } from '../../theme';

const WEEKDAYS_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

export default function Today() {
  const profile = useAppStore((s) => s.profile);
  const sessions = useAppStore((s) => s.sessions);
  const schedule = useAppStore((s) => s.schedule);
  const workouts = useAppStore((s) => s.workouts);
  const catalog = useAppStore((s) => s.catalog);
  const favoriteIds = useAppStore((s) => s.favoriteIds);
  const active = useAppStore((s) => s.activeSession);
  const discardActive = useAppStore((s) => s.discardActive);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const { online } = useOnline();

  const now = new Date();
  const today = dayKey(now);
  const sport = SPORTS[profile.sport];

  const week = useMemo(() => weeklyStats(sessions, 1)[0], [sessions]);
  const streak = useMemo(() => dayStreak(sessions), [sessions]);
  const weeks = useMemo(() => weekStreak(sessions, profile.weeklyTarget), [sessions, profile.weeklyTarget]);

  const doneToday = sessions.filter((s) => dayKey(s.finishedAt) === today);
  const doneIds = new Set(doneToday.map((s) => s.workoutId));
  // Запланированная тренировка, уже выполненная сегодня, из плана уходит.
  const todayPlan = schedule
    .filter((s) => s.date === today && !doneIds.has(s.workoutId))
    .map((s) => ({ entry: s, workout: findWorkout({ workouts, catalog }, s.workoutId) }))
    .filter((x) => x.workout);

  const suggestion = useMemo(() => {
    const recent = new Set(sessions.slice(0, 5).map((s) => s.workoutId));
    const pool = BUILTIN_WORKOUTS.filter((w) => w.sport === profile.sport);
    return pool.find((w) => !recent.has(w.id)) ?? pool[0] ?? BUILTIN_WORKOUTS[0];
  }, [sessions, profile.sport]);

  const tips = [...sport.tips, ...GENERAL_TIPS];
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const tip = tips[dayOfYear % tips.length];
  const activeWorkout = active ? findWorkout({ workouts, catalog }, active.workoutId) : undefined;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={font.small}>
            {WEEKDAYS_FULL[now.getDay()]}, {now.getDate()} {MONTHS_GENITIVE[now.getMonth()]}
          </Text>
          <Text style={font.h1}>{profile.name ? `Привет, ${profile.name}!` : 'Привет!'}</Text>
        </View>
        <Badge label={online ? 'Онлайн' : 'Офлайн'} color={online ? colors.success : colors.textDim} />
      </View>

      {active && activeWorkout ? (
        <Card style={{ borderColor: colors.primary }}>
          <Text style={font.h3}>Незавершённая тренировка</Text>
          <Text style={font.dim}>
            {activeWorkout.title} · начата {new Date(active.startedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <View style={styles.row}>
            <Button
              title="Продолжить"
              icon="play"
              style={{ flex: 1 }}
              onPress={() => router.push({ pathname: '/workout/play', params: { id: activeWorkout.id } })}
            />
            <Button
              title="Сбросить"
              variant="secondary"
              onPress={() => confirm('Сбросить тренировку?', 'Выполненные подходы не сохранятся.', discardActive, 'Сбросить')}
            />
          </View>
        </Card>
      ) : null}

      <Card>
        <View style={styles.row}>
          <ProgressRing size={96} progress={week.count / Math.max(1, profile.weeklyTarget)}>
            <Text style={styles.ringValue}>
              {week.count}/{profile.weeklyTarget}
            </Text>
            <Text style={font.small}>за неделю</Text>
          </ProgressRing>
          <View style={{ flex: 1, gap: spacing.sm }}>
            <View style={styles.row}>
              <Stat value={streak} label={`${plural(streak, 'день', 'дня', 'дней')} подряд`} color={streak ? colors.warning : colors.text} />
              <Stat value={weeks} label={`${plural(weeks, 'неделя', 'недели', 'недель')} с целью`} />
            </View>
            <Stat value={`${week.minutes} мин`} label="время тренировок на этой неделе" />
          </View>
        </View>
      </Card>

      <SectionTitle title="План на сегодня" />
      {todayPlan.length ? (
        todayPlan.map(({ entry, workout }) => (
          <WorkoutCard
            key={entry.id}
            workout={workout!}
            favorite={favoriteIds.includes(workout!.id)}
            onToggleFavorite={() => toggleFavorite(workout!.id)}
            onPress={() => router.push(`/workout/${workout!.id}`)}
          />
        ))
      ) : doneToday.length ? (
        <Card>
          <View style={styles.row}>
            <Ionicons name="checkmark-circle" size={28} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={font.h3}>Тренировка выполнена</Text>
              <Text style={font.dim}>
                {doneToday.map((s) => `${s.title} (${formatClock(s.durationSec)})`).join(', ')}
              </Text>
            </View>
          </View>
        </Card>
      ) : (
        <>
          <Text style={font.dim}>На сегодня ничего не запланировано. Рекомендуем:</Text>
          <WorkoutCard
            workout={suggestion}
            favorite={favoriteIds.includes(suggestion.id)}
            onToggleFavorite={() => toggleFavorite(suggestion.id)}
            onPress={() => router.push(`/workout/${suggestion.id}`)}
          />
        </>
      )}

      <View style={styles.quickGrid}>
        <QuickAction icon="sparkles" label="Сгенерировать" hint={online ? 'ИИ или офлайн' : 'офлайн-генератор'} onPress={() => router.push('/generate')} />
        <QuickAction icon="construct-outline" label="Конструктор" hint="своя тренировка" onPress={() => router.push('/workout/edit')} />
        <QuickAction icon="flash-outline" label="Тест реакции" hint="для пилотов и игроков" onPress={() => router.push('/reaction')} />
        <QuickAction icon="calendar-outline" label="Запланировать" hint="в календаре" onPress={() => router.push('/calendar')} />
      </View>

      <Card style={{ borderColor: colors.warning + '55' }}>
        <View style={styles.row}>
          <Ionicons name="bulb" size={22} color={colors.warning} />
          <Text style={font.h3}>Совет дня</Text>
        </View>
        <Text style={font.body}>{tip}</Text>
        <View style={styles.row}>
          <SportIcon sport={profile.sport} size={14} />
          <Text style={font.small}>Ключевые качества: {sport.qualities.join(', ').toLowerCase()}</Text>
        </View>
      </Card>
    </Screen>
  );
}

function QuickAction({ icon, label, hint, onPress }: { icon: IconName; label: string; hint: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quick, pressed && { opacity: 0.7 }]} accessibilityRole="button">
      <Ionicons name={icon} size={24} color={colors.primary} />
      <Text style={styles.quickLabel}>{label}</Text>
      <Text style={font.small}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ringValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  quick: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  quickLabel: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
