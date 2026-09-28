import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Card, Chip, ChipGroup, EmptyState, Notice, Screen } from '../components/ui';
import { categoryLabels, muscleLabels } from '../data/labels';
import { findAlternatives, swapExercise } from '../lib/alternatives';
import { describeTarget, cloneWorkout } from '../lib/workout';
import { useAppStore, useWorkout } from '../store/useAppStore';
import { useDraftStore } from '../store/useDraftStore';
import { chart, colors, font, phaseOf, radius, spacing } from '../theme';
import type { Exercise, WorkoutExercise } from '../types';

/**
 * Замена упражнения на похожее.
 * mode=workout — в сохранённой тренировке (для библиотечной создаётся копия в «Мои»),
 * mode=draft — в конструкторе, mode=session — только в текущей тренировке.
 */
type Mode = 'workout' | 'draft' | 'session';

export default function ExerciseSwap() {
  const { mode, workoutId, uid } = useLocalSearchParams<{ mode: Mode; workoutId?: string; uid: string }>();
  const workout = useWorkout(workoutId);
  const draft = useDraftStore((s) => s.draft);
  const patchDraft = useDraftStore((s) => s.patchDraft);
  const active = useAppStore((s) => s.activeSession);
  const updateActive = useAppStore((s) => s.updateActive);
  const saveWorkout = useAppStore((s) => s.saveWorkout);
  const isOwn = useAppStore((s) => s.workouts.some((w) => w.id === workoutId));
  const profile = useAppStore((s) => s.profile);
  const [onlyMine, setOnlyMine] = useState(profile.equipment.length > 0);

  const list: WorkoutExercise[] = useMemo(() => {
    if (mode === 'draft') return draft?.exercises ?? [];
    const base = workout?.exercises ?? [];
    return mode === 'session' ? base.map((e) => active?.overrides?.[e.uid] ?? e) : base;
  }, [mode, draft, workout, active?.overrides]);
  const current = list.find((e) => e.uid === uid);

  const alternatives = useMemo(
    () =>
      current
        ? findAlternatives(current, {
            equipment: profile.equipment,
            sport: profile.sport,
            excludeIds: list.map((e) => e.exerciseId),
            onlyAvailable: onlyMine,
          })
        : [],
    [current, list, profile.equipment, profile.sport, onlyMine],
  );

  if (!current) {
    return (
      <Screen edges={[]}>
        <EmptyState icon="swap-horizontal" title="Упражнение не найдено" />
      </Screen>
    );
  }

  const apply = (ex: Exercise) => {
    const replaced = swapExercise(current, ex);
    const mapList = (items: WorkoutExercise[]) => items.map((e) => (e.uid === uid ? replaced : e));

    if (mode === 'draft') {
      if (draft) patchDraft({ exercises: mapList(draft.exercises) });
      router.back();
      return;
    }
    if (mode === 'session' && active) {
      updateActive({
        overrides: { ...active.overrides, [uid]: replaced },
        logs: active.logs.map((l) =>
          l.uid === uid
            ? { ...l, exerciseId: replaced.exerciseId, name: replaced.name, category: replaced.category, kind: replaced.kind, muscles: replaced.muscles }
            : l,
        ),
      });
      router.back();
      return;
    }
    if (mode === 'workout' && workout) {
      if (isOwn) {
        saveWorkout({ ...workout, exercises: mapList(workout.exercises) });
        router.back();
      } else {
        // Программы из библиотеки не меняем — сохраняем вашу версию в «Мои».
        const copy = cloneWorkout({ ...workout, exercises: mapList(workout.exercises) }, {
          source: 'custom',
          title: `${workout.title} (моя версия)`,
        });
        saveWorkout(copy);
        router.replace(`/workout/${copy.id}`);
      }
    }
  };

  const hint =
    mode === 'session'
      ? 'Замена действует только в этой тренировке. Программа останется прежней.'
      : mode === 'workout' && !isOwn
        ? 'Это программа из библиотеки: замена сохранится в вашей копии в разделе «Мои».'
        : 'Подходы и отдых сохранятся, объём пересчитается под новое упражнение.';

  return (
    <Screen edges={['bottom']}>
      <Card>
        <Text style={font.small}>Сейчас в комплексе</Text>
        <Text style={font.h3}>{current.name}</Text>
        <Text style={font.dim}>
          {current.sets} × {describeTarget(current)} · {current.muscles.map((m) => muscleLabels[m]).join(', ')}
        </Text>
      </Card>
      <Notice text={hint} />
      <ChipGroup>
        <Chip label="Только моё оборудование" selected={onlyMine} onPress={() => setOnlyMine(!onlyMine)} />
      </ChipGroup>

      {alternatives.length ? (
        alternatives.map(({ exercise, reasons, available }) => (
          <Pressable
            key={exercise.id}
            onPress={() => apply(exercise)}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
            accessibilityLabel={`Заменить на ${exercise.name}`}
          >
            <View style={[styles.phaseDot, { backgroundColor: chart.phase[phaseOf(exercise.category)] }]} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[font.body, { fontWeight: '600' }]}>{exercise.name}</Text>
              <Text style={font.small}>{reasons.join(' · ')}</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Badge label={categoryLabels[exercise.category]} />
                {!available ? <Badge label="Нет оборудования" color={colors.warning} /> : null}
              </View>
            </View>
            <Pressable hitSlop={8} onPress={() => router.push(`/exercise/${exercise.id}`)} accessibilityLabel="Подробнее">
              <Ionicons name="information-circle-outline" size={22} color={colors.textDim} />
            </Pressable>
          </Pressable>
        ))
      ) : (
        <EmptyState
          icon="search-outline"
          title="Похожих упражнений не нашлось"
          text={onlyMine ? 'Снимите фильтр оборудования или добавьте оборудование в профиле.' : undefined}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  phaseDot: { width: 10, height: 10, borderRadius: 5 },
});
