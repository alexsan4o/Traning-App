import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { WorkoutTimeline } from '../../components/WorkoutTimeline';
import { SportIcon } from '../../components/WorkoutCard';
import { Button, Card, Chip, ChipGroup, EmptyState, Field, IconButton, Screen, SectionTitle, Segmented, Stepper } from '../../components/ui';
import { ALL_GOALS, ALL_LEVELS, goalLabels, levelLabels } from '../../data/labels';
import { SPORT_LIST } from '../../data/sports';
import { notify } from '../../lib/confirm';
import { uid } from '../../lib/id';
import { estimateMinutes } from '../../lib/workout';
import { useAppStore } from '../../store/useAppStore';
import { useDraftStore } from '../../store/useDraftStore';
import { colors, font, spacing } from '../../theme';
import type { WorkoutExercise } from '../../types';

export default function EditWorkout() {
  const draft = useDraftStore((s) => s.draft);
  const setDraft = useDraftStore((s) => s.setDraft);
  const patchDraft = useDraftStore((s) => s.patchDraft);
  const profile = useAppStore((s) => s.profile);
  const saveWorkout = useAppStore((s) => s.saveWorkout);
  const isExisting = useAppStore((s) => !!draft && s.workouts.some((w) => w.id === draft.id));

  useEffect(() => {
    if (!useDraftStore.getState().draft) {
      const now = new Date().toISOString();
      setDraft({
        id: uid('w_'),
        title: '',
        description: '',
        sport: profile.sport,
        goal: 'strength',
        level: profile.level,
        exercises: [],
        tips: [],
        source: 'custom',
        createdAt: now,
        updatedAt: now,
      });
    }
    return () => setDraft(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!draft) return <Screen edges={[]}>{null}</Screen>;

  const updateItem = (itemUid: string, patch: Partial<WorkoutExercise>) =>
    patchDraft({ exercises: draft.exercises.map((e) => (e.uid === itemUid ? { ...e, ...patch } : e)) });

  const move = (index: number, delta: number) => {
    const list = [...draft.exercises];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    patchDraft({ exercises: list });
  };

  const remove = (itemUid: string) => patchDraft({ exercises: draft.exercises.filter((e) => e.uid !== itemUid) });

  const save = () => {
    if (!draft.title.trim()) return notify('Введите название тренировки');
    if (!draft.exercises.length) return notify('Добавьте хотя бы одно упражнение');
    const toSave = { ...draft, title: draft.title.trim() };
    saveWorkout(toSave);
    if (isExisting) router.back();
    else router.replace(`/workout/${toSave.id}`);
  };

  return (
    <Screen edges={[]}>
      <Field label="Название" placeholder="Например: Шея и хват перед гонкой" value={draft.title} onChangeText={(title) => patchDraft({ title })} />
      <Field
        label="Описание"
        placeholder="Цель и как выполнять"
        value={draft.description}
        onChangeText={(description) => patchDraft({ description })}
        multiline
        style={{ minHeight: 60, textAlignVertical: 'top' }}
      />

      <Card>
        <Text style={font.small}>Вид спорта</Text>
        <ChipGroup>
          {SPORT_LIST.map((s) => (
            <Chip
              key={s.id}
              label={s.name}
              color={s.color}
              selected={draft.sport === s.id}
              onPress={() => patchDraft({ sport: s.id })}
              icon={<SportIcon sport={s.id} size={12} />}
            />
          ))}
        </ChipGroup>
        <Text style={font.small}>Цель</Text>
        <ChipGroup>
          {ALL_GOALS.map((g) => (
            <Chip key={g} label={goalLabels[g]} selected={draft.goal === g} onPress={() => patchDraft({ goal: g })} />
          ))}
        </ChipGroup>
        <Text style={font.small}>Уровень</Text>
        <Segmented options={ALL_LEVELS.map((l) => ({ value: l, label: levelLabels[l] }))} value={draft.level} onChange={(level) => patchDraft({ level })} />
      </Card>

      {draft.exercises.length ? (
        <Card>
          <SectionTitle title={`~${estimateMinutes(draft)} мин`} />
          <WorkoutTimeline workout={draft} />
        </Card>
      ) : null}

      <SectionTitle title={`Упражнения (${draft.exercises.length})`} />
      {draft.exercises.length === 0 ? (
        <EmptyState icon="list-outline" title="Пока пусто" text="Добавьте упражнения из библиотеки или онлайн-базы." />
      ) : (
        draft.exercises.map((e, i) => (
          <Card key={e.uid}>
            <View style={styles.header}>
              <Text style={[font.h3, { flex: 1 }]} numberOfLines={2}>
                {i + 1}. {e.name}
              </Text>
              <IconButton icon="arrow-up" label="Выше" size={18} onPress={() => move(i, -1)} />
              <IconButton icon="arrow-down" label="Ниже" size={18} onPress={() => move(i, 1)} />
              <IconButton icon="trash-outline" label="Удалить" size={18} color={colors.danger} onPress={() => remove(e.uid)} />
            </View>
            <View style={styles.steppers}>
              <Stepper label="Подходы" value={e.sets} min={1} max={20} onChange={(sets) => updateItem(e.uid, { sets })} />
              {e.kind === 'reps' ? (
                <Stepper label="Повторы" value={e.reps ?? 10} min={1} max={200} onChange={(reps) => updateItem(e.uid, { reps })} />
              ) : (
                <Stepper
                  label="Секунды"
                  value={e.durationSec ?? 30}
                  step={5}
                  min={5}
                  max={3600}
                  onChange={(durationSec) => updateItem(e.uid, { durationSec })}
                />
              )}
              <Stepper label="Отдых, с" value={e.restSec} step={15} min={0} max={600} onChange={(restSec) => updateItem(e.uid, { restSec })} />
              <Stepper
                label="Вес, кг"
                value={e.weightKg ?? 0}
                step={2.5}
                min={0}
                max={500}
                onChange={(w) => updateItem(e.uid, { weightKg: w > 0 ? w : undefined })}
              />
            </View>
          </Card>
        ))
      )}

      <Button title="Добавить упражнения" icon="add" variant="secondary" onPress={() => router.push('/exercise-picker')} />
      <Button title="Сохранить тренировку" icon="checkmark" onPress={save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  steppers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between' },
});
