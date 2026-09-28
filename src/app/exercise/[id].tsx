import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';

import { BodyMap } from '../../components/BodyMap';
import { Badge, Card, EmptyState, Screen, SectionTitle } from '../../components/ui';
import { getBuiltinExercise } from '../../data/exercises';
import { categoryLabels, equipmentLabels } from '../../data/labels';
import { BUILTIN_WORKOUTS } from '../../data/programs';
import { SPORTS } from '../../data/sports';
import { useOnline } from '../../hooks/useOnline';
import { fetchWgerExercise } from '../../lib/wger';
import { colors, font } from '../../theme';
import type { Exercise, MuscleGroup } from '../../types';

export default function ExerciseDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const builtin = getBuiltinExercise(id);
  const { online } = useOnline();
  const [remote, setRemote] = useState<Exercise | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (builtin || !id.startsWith('wger_') || !online) return;
    const controller = new AbortController();
    fetchWgerExercise(Number(id.slice(5)), controller.signal)
      .then(setRemote)
      .catch(() => !controller.signal.aborted && setError('Не удалось загрузить упражнение из wger.de.'));
    return () => controller.abort();
  }, [id, builtin, online]);

  const exercise = builtin ?? remote;
  const load = useMemo(() => {
    const l: Partial<Record<MuscleGroup, number>> = {};
    exercise?.muscles.forEach((m, i) => (l[m] = i === 0 ? 2 : 1));
    return l;
  }, [exercise]);
  const usedIn = BUILTIN_WORKOUTS.filter((w) => w.exercises.some((e) => e.exerciseId === id));

  if (!exercise) {
    if (id.startsWith('wger_') && online && !error) {
      return (
        <Screen edges={[]}>
          <ActivityIndicator color={colors.primary} />
        </Screen>
      );
    }
    return (
      <Screen edges={[]}>
        <EmptyState
          icon="help-circle-outline"
          title="Упражнение не найдено"
          text={error ?? (id.startsWith('wger_') ? 'Для упражнений из wger.de нужен интернет.' : undefined)}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={[]}>
      <Text style={font.h1}>{exercise.name}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Badge label={categoryLabels[exercise.category]} color={colors.primary} />
        <Badge label={exercise.kind === 'time' ? 'На время' : 'На повторения'} />
        {exercise.perSide ? <Badge label="На каждую сторону" /> : null}
        <Badge label={exercise.equipment.length ? exercise.equipment.map((e) => equipmentLabels[e]).join(', ') : 'Без инвентаря'} />
        {exercise.source === 'wger' ? <Badge label="wger.de" color={colors.accent} /> : null}
      </View>
      {exercise.imageUrl ? (
        <Image source={{ uri: exercise.imageUrl }} style={{ width: '100%', height: 220, borderRadius: 16, backgroundColor: '#fff' }} resizeMode="contain" />
      ) : null}
      <Text style={font.body}>{exercise.description}</Text>

      {exercise.tips.length ? (
        <Card style={{ borderColor: colors.warning + '55' }}>
          <SectionTitle title="Подсказки по технике" />
          {exercise.tips.map((t) => (
            <View key={t} style={{ flexDirection: 'row', gap: 8 }}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
              <Text style={[font.body, { flex: 1 }]}>{t}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {exercise.mistakes?.length ? (
        <Card>
          <SectionTitle title="Частые ошибки" />
          {exercise.mistakes.map((t) => (
            <View key={t} style={{ flexDirection: 'row', gap: 8 }}>
              <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
              <Text style={[font.body, { flex: 1 }]}>{t}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <SectionTitle title="Работающие мышцы" />
        <BodyMap load={load} />
      </Card>

      <Card>
        <SectionTitle title="Полезно для" />
        <Text style={font.dim}>{exercise.sports.map((s) => SPORTS[s].name).join(', ')}</Text>
        {usedIn.length ? (
          <>
            <Text style={[font.small, { marginTop: 6 }]}>Встречается в программах:</Text>
            {usedIn.map((w) => (
              <Text key={w.id} style={{ color: colors.primary, fontSize: 15 }} onPress={() => router.push(`/workout/${w.id}`)}>
                {w.title} →
              </Text>
            ))}
          </>
        ) : null}
      </Card>
    </Screen>
  );
}
