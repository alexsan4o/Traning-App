import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActivityHeatmap } from '../../components/ActivityHeatmap';
import { BodyMap } from '../../components/BodyMap';
import { BarList, ColumnChart, LineChart } from '../../components/charts';
import { SportIcon } from '../../components/WorkoutCard';
import { Button, Card, EmptyState, Screen, SectionTitle, Segmented, Stat } from '../../components/ui';
import { categoryLabels, muscleLabels } from '../../data/labels';
import { formatClock, formatDateTime, plural } from '../../lib/date';
import {
  categoryLoad,
  exerciseProgress,
  muscleLoad,
  personalRecords,
  sessionTotals,
  weeklyStats,
} from '../../lib/stats';
import { useAppStore } from '../../store/useAppStore';
import { chart, colors, font, radius, spacing } from '../../theme';
import type { Category, MuscleGroup } from '../../types';

type Metric = 'minutes' | 'count' | 'volume';
const METRIC_UNIT: Record<Metric, string> = { minutes: 'мин', count: 'трен.', volume: 'кг' };

export default function Progress() {
  const sessions = useAppStore((s) => s.sessions);
  const reactions = useAppStore((s) => s.reactionResults);
  const [metric, setMetric] = useState<Metric>('minutes');
  const [exerciseId, setExerciseId] = useState<string | null>(null);

  const weeks = useMemo(() => weeklyStats(sessions, 8), [sessions]);
  const totals = useMemo(() => {
    const all = sessions.map(sessionTotals);
    return {
      minutes: sessions.reduce((a, s) => a + s.durationSec / 60, 0),
      volume: all.reduce((a, t) => a + t.volumeKg, 0),
      sets: all.reduce((a, t) => a + t.sets, 0),
    };
  }, [sessions]);
  const load = useMemo(() => muscleLoad(sessions, 28), [sessions]);
  const categories = useMemo(() => categoryLoad(sessions, 28), [sessions]);
  const records = useMemo(() => personalRecords(sessions), [sessions]);
  const activeExercise = exerciseId ?? records[0]?.exerciseId ?? null;
  const points = useMemo(
    () => (activeExercise ? exerciseProgress(sessions, activeExercise) : []),
    [sessions, activeExercise],
  );

  if (!sessions.length) {
    return (
      <Screen>
        <Text style={font.h1}>Прогресс</Text>
        <EmptyState
          icon="stats-chart-outline"
          title="Пока нет данных"
          text="Завершите первую тренировку — здесь появятся графики нагрузки, карта мышц, рекорды и история."
          action={<Button title="Выбрать тренировку" icon="barbell-outline" onPress={() => router.push('/workouts')} />}
        />
        <ReactionCard reactions={reactions} />
      </Screen>
    );
  }

  const columnData = weeks.map((w) => ({
    label: `${w.weekStart.getDate()}.${String(w.weekStart.getMonth() + 1).padStart(2, '0')}`,
    value: metric === 'minutes' ? w.minutes : metric === 'count' ? w.count : w.volumeKg,
  }));

  const muscleItems = (Object.entries(load) as [MuscleGroup, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([m, v]) => ({ key: m, label: muscleLabels[m], value: Math.round(v) }));
  const categoryItems = (Object.entries(categories) as [Category, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([c, v]) => ({ key: c, label: categoryLabels[c], value: v }));
  const activeRecord = records.find((r) => r.exerciseId === activeExercise);

  return (
    <Screen>
      <Text style={font.h1}>Прогресс</Text>
      <View style={styles.row}>
        <Stat value={sessions.length} label={plural(sessions.length, 'тренировка', 'тренировки', 'тренировок')} />
        <Stat value={`${Math.round(totals.minutes / 6) / 10} ч`} label="общее время" />
        <Stat
          value={!totals.volume ? '—' : totals.volume >= 1000 ? `${Math.round(totals.volume / 100) / 10} т` : `${totals.volume} кг`}
          label="поднятый объём"
        />
      </View>

      <Card>
        <SectionTitle title="Нагрузка по неделям" />
        <Segmented<Metric>
          options={[
            { value: 'minutes', label: 'Минуты' },
            { value: 'count', label: 'Тренировки' },
            { value: 'volume', label: 'Объём, кг' },
          ]}
          value={metric}
          onChange={setMetric}
        />
        <ColumnChart
          key={metric}
          data={columnData}
          unit={METRIC_UNIT[metric]}
          accessibilityLabel={`Нагрузка по неделям: ${columnData.map((d) => `${d.label} — ${d.value}`).join(', ')}`}
        />
      </Card>

      <Card>
        <SectionTitle title="Активность" />
        <ActivityHeatmap sessions={sessions} />
      </Card>

      <Card>
        <SectionTitle title="Нагрузка на мышцы" />
        <Text style={font.dim}>Выполненные подходы за 28 дней</Text>
        <BodyMap load={load} />
        {muscleItems.length ? <BarList items={muscleItems} unit="подх." /> : null}
      </Card>

      {categoryItems.length ? (
        <Card>
          <SectionTitle title="Типы нагрузки" />
          <Text style={font.dim}>Подходы за 28 дней по типу упражнений</Text>
          <BarList items={categoryItems} unit="подх." />
        </Card>
      ) : null}

      {records.length ? (
        <Card>
          <SectionTitle title="Прогресс в упражнении" />
          <View style={styles.chips}>
            {records.slice(0, 12).map((r) => (
              <Pressable
                key={r.exerciseId}
                onPress={() => setExerciseId(r.exerciseId)}
                style={[styles.chip, r.exerciseId === activeExercise && styles.chipActive]}
              >
                <Text style={[styles.chipText, r.exerciseId === activeExercise && { color: colors.text }]} numberOfLines={1}>
                  {r.name}
                </Text>
              </Pressable>
            ))}
          </View>
          {points.length ? (
            <LineChart
              key={activeExercise ?? ''}
              points={points.map((p) => ({ label: formatDateTime(p.date).split(',')[0], value: p.value }))}
              unit={points[points.length - 1].unit}
              accessibilityLabel={`Прогресс: ${points.map((p) => `${p.value} ${p.unit}`).join(', ')}`}
            />
          ) : null}
          {activeRecord ? (
            <View style={styles.row}>
              {activeRecord.maxWeightKg ? <Stat value={`${activeRecord.maxWeightKg} кг`} label="макс. вес" /> : null}
              {activeRecord.kind === 'reps' ? <Stat value={activeRecord.maxReps} label="макс. повторов" /> : null}
              {activeRecord.kind === 'time' ? <Stat value={`${activeRecord.maxDurationSec} с`} label="лучшее время" /> : null}
              <Stat value={activeRecord.sessions} label={plural(activeRecord.sessions, 'тренировка', 'тренировки', 'тренировок')} />
            </View>
          ) : null}
        </Card>
      ) : null}

      <ReactionCard reactions={reactions} />

      <SectionTitle title="История" />
      {sessions.slice(0, 15).map((s) => {
        const t = sessionTotals(s);
        return (
          <Card key={s.id} onPress={() => router.push(`/session/${s.id}`)}>
            <View style={styles.row}>
              <SportIcon sport={s.sport} size={18} />
              <View style={{ flex: 1 }}>
                <Text style={font.h3} numberOfLines={1}>
                  {s.title}
                </Text>
                <Text style={font.dim}>
                  {formatDateTime(s.finishedAt)} · {formatClock(s.durationSec)} · {t.sets} подх.
                  {s.rpe ? ` · RPE ${s.rpe}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

function ReactionCard({ reactions }: { reactions: { date: string; bestMs: number; avgMs: number }[] }) {
  const sorted = [...reactions].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1];
  const best = reactions.length ? Math.min(...reactions.map((r) => r.bestMs)) : null;
  return (
    <Card>
      <SectionTitle title="Реакция" />
      <Text style={font.dim}>Важна для пилотов, вратарей, теннисистов и бойцов. Хороший результат — меньше 250 мс.</Text>
      {last ? (
        <View style={styles.row}>
          <Stat value={`${last.avgMs} мс`} label="последний средний" />
          <Stat value={`${best} мс`} label="личный рекорд" color={colors.primary} />
          <Stat value={reactions.length} label={plural(reactions.length, 'тест', 'теста', 'тестов')} />
        </View>
      ) : null}
      {reactions.length > 1 ? (
        <LineChart
          points={sorted
            .slice(-20)
            .map((r) => ({ label: formatDateTime(r.date).split(',')[0], value: r.avgMs }))}
          unit="мс"
          height={140}
          accessibilityLabel="Средняя реакция по тестам"
        />
      ) : null}
      <Button title="Пройти тест реакции" icon="flash-outline" variant="secondary" onPress={() => router.push('/reaction')} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: 'transparent',
    maxWidth: 200,
  },
  chipActive: { borderColor: chart.series },
  chipText: { color: colors.textDim, fontSize: 13 },
});
