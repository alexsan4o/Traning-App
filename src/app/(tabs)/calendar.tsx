import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CalendarMonth, type DayMarks } from '../../components/CalendarMonth';
import { SportIcon } from '../../components/WorkoutCard';
import { Button, Card, Chip, ChipGroup, IconButton, Screen, SectionTitle, Stat } from '../../components/ui';
import { BUILTIN_WORKOUTS } from '../../data/programs';
import { addDays, dayKey, formatClock, formatDay, parseDayKey, plural } from '../../lib/date';
import { estimateMinutes } from '../../lib/workout';
import { findWorkout, useAppStore } from '../../store/useAppStore';
import { colors, font, radius, spacing } from '../../theme';
import type { Workout } from '../../types';

export default function CalendarScreen() {
  const sessions = useAppStore((s) => s.sessions);
  const schedule = useAppStore((s) => s.schedule);
  const workouts = useAppStore((s) => s.workouts);
  const catalog = useAppStore((s) => s.catalog);
  const favoriteIds = useAppStore((s) => s.favoriteIds);
  const profileSport = useAppStore((s) => s.profile.sport);
  const scheduleWorkout = useAppStore((s) => s.scheduleWorkout);
  const unschedule = useAppStore((s) => s.unschedule);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState(dayKey(now));
  const [picking, setPicking] = useState(false);
  const [repeat, setRepeat] = useState(false);

  const marks = useMemo(() => {
    const map = new Map<string, DayMarks>();
    const get = (k: string) => map.get(k) ?? { done: 0, planned: 0 };
    for (const s of sessions) {
      const k = dayKey(s.finishedAt);
      map.set(k, { ...get(k), done: get(k).done + 1 });
    }
    for (const p of schedule) map.set(p.date, { ...get(p.date), planned: get(p.date).planned + 1 });
    return map;
  }, [sessions, schedule]);

  const monthStats = useMemo(() => {
    const inMonth = sessions.filter((s) => {
      const d = new Date(s.finishedAt);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    return {
      count: inMonth.length,
      minutes: inMonth.reduce((acc, s) => acc + Math.round(s.durationSec / 60), 0),
      days: new Set(inMonth.map((s) => dayKey(s.finishedAt))).size,
    };
  }, [sessions, year, month]);

  const daySessions = sessions.filter((s) => dayKey(s.finishedAt) === selected);
  const dayPlan = schedule
    .filter((p) => p.date === selected)
    .map((p) => ({ entry: p, workout: findWorkout({ workouts, catalog }, p.workoutId) }));

  const candidates = useMemo(() => {
    const favs = [...workouts, ...BUILTIN_WORKOUTS].filter((w) => favoriteIds.includes(w.id));
    const rest = [...workouts, ...BUILTIN_WORKOUTS.filter((w) => w.sport === profileSport || w.sport === 'general')];
    const seen = new Set<string>();
    return [...favs, ...rest].filter((w) => (seen.has(w.id) ? false : (seen.add(w.id), true)));
  }, [workouts, favoriteIds, profileSport]);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const plan = (w: Workout) => {
    const base = parseDayKey(selected);
    const count = repeat ? 4 : 1;
    for (let i = 0; i < count; i++) scheduleWorkout(dayKey(addDays(base, i * 7)), w.id);
    setPicking(false);
  };

  const isPast = selected < dayKey(now);

  return (
    <Screen>
      <Text style={font.h1}>Календарь</Text>
      <Card>
        <CalendarMonth
          year={year}
          month={month}
          marks={marks}
          selected={selected}
          onSelect={(k) => {
            setSelected(k);
            setPicking(false);
          }}
          onPrev={() => shiftMonth(-1)}
          onNext={() => shiftMonth(1)}
        />
      </Card>

      <View style={styles.row}>
        <Stat value={monthStats.count} label={`${plural(monthStats.count, 'тренировка', 'тренировки', 'тренировок')} за месяц`} />
        <Stat value={monthStats.days} label={plural(monthStats.days, 'активный день', 'активных дня', 'активных дней')} />
        <Stat value={monthStats.minutes} label={plural(monthStats.minutes, 'минута', 'минуты', 'минут')} />
      </View>

      <SectionTitle title={formatDay(selected)} />

      {daySessions.map((s) => (
        <Card key={s.id} onPress={() => router.push(`/session/${s.id}`)}>
          <View style={styles.row}>
            <SportIcon sport={s.sport} />
            <View style={{ flex: 1 }}>
              <Text style={font.h3}>{s.title}</Text>
              <Text style={font.dim}>
                Выполнено · {formatClock(s.durationSec)}
                {s.rpe ? ` · RPE ${s.rpe}` : ''}
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          </View>
        </Card>
      ))}

      {dayPlan.map(({ entry, workout }) => (
        <Card key={entry.id}>
          <View style={styles.row}>
            {workout ? <SportIcon sport={workout.sport} /> : null}
            <Pressable style={{ flex: 1 }} onPress={() => workout && router.push(`/workout/${workout.id}`)}>
              <Text style={font.h3}>{workout?.title ?? 'Тренировка удалена'}</Text>
              <Text style={font.dim}>Запланировано{workout ? ` · ~${estimateMinutes(workout)} мин` : ''}</Text>
            </Pressable>
            <IconButton icon="close" label="Убрать из плана" color={colors.textFaint} onPress={() => unschedule(entry.id)} />
          </View>
          {workout && !isPast ? (
            <Button
              title="Начать"
              icon="play"
              small
              onPress={() => router.push({ pathname: '/workout/play', params: { id: workout.id } })}
            />
          ) : null}
        </Card>
      ))}

      {!daySessions.length && !dayPlan.length ? (
        <Text style={font.dim}>{isPast ? 'В этот день тренировок не было.' : 'На этот день ничего не запланировано.'}</Text>
      ) : null}

      {!isPast ? (
        picking ? (
          <Card>
            <Text style={font.h3}>Выберите тренировку</Text>
            <ChipGroup>
              <Chip label="Повторять 4 недели" selected={repeat} onPress={() => setRepeat(!repeat)} />
            </ChipGroup>
            {candidates.map((w) => (
              <Pressable key={w.id} onPress={() => plan(w)} style={({ pressed }) => [styles.pickRow, pressed && { opacity: 0.7 }]}>
                <SportIcon sport={w.sport} size={16} />
                <View style={{ flex: 1 }}>
                  <Text style={[font.body, { fontWeight: '600' }]} numberOfLines={1}>
                    {w.title}
                  </Text>
                  <Text style={font.small}>~{estimateMinutes(w)} мин</Text>
                </View>
                {favoriteIds.includes(w.id) ? <Ionicons name="star" size={16} color={colors.warning} /> : null}
              </Pressable>
            ))}
            <Button title="Отмена" variant="ghost" onPress={() => setPicking(false)} />
          </Card>
        ) : (
          <Button title="Запланировать тренировку" icon="add-circle-outline" variant="secondary" onPress={() => setPicking(true)} />
        )
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
});
