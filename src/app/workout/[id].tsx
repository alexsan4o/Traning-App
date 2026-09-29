import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BodyMap } from '../../components/BodyMap';
import { ExerciseItem } from '../../components/ExerciseItem';
import { WorkoutTimeline } from '../../components/WorkoutTimeline';
import { SportIcon } from '../../components/WorkoutCard';
import { Badge, Button, Card, Chip, ChipGroup, Divider, EmptyState, Field, IconButton, Notice, Screen, SectionTitle, Stat } from '../../components/ui';
import { goalLabels, levelLabels, sourceLabels } from '../../data/labels';
import { SPORTS } from '../../data/sports';
import { getBuiltinExercise } from '../../data/exercises';
import { useOnline } from '../../hooks/useOnline';
import { AiError, askCoach } from '../../lib/ai';
import { exportWorkout } from '../../lib/catalog';
import { confirm, notify } from '../../lib/confirm';
import { addDays, dayKey, formatDateTime, formatDay, plural } from '../../lib/date';
import { getApiKey } from '../../lib/secure';
import { shareText } from '../../lib/share';
import { adaptToLevel, cloneWorkout, estimateMinutes, totalSets } from '../../lib/workout';
import { useAppStore, useWorkout } from '../../store/useAppStore';
import { useDraftStore } from '../../store/useDraftStore';
import { colors, font, spacing } from '../../theme';
import type { MuscleGroup } from '../../types';

export default function WorkoutDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workout = useWorkout(id);
  const isOwn = useAppStore((s) => s.workouts.some((w) => w.id === id));
  const favorite = useAppStore((s) => s.favoriteIds.includes(id));
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const deleteWorkout = useAppStore((s) => s.deleteWorkout);
  const saveWorkout = useAppStore((s) => s.saveWorkout);
  const scheduleWorkout = useAppStore((s) => s.scheduleWorkout);
  const aiEnabled = useAppStore((s) => s.settings.aiEnabled);
  const userLevel = useAppStore((s) => s.profile.level);
  const sessions = useAppStore((s) => s.sessions);
  const history = useMemo(() => sessions.filter((x) => x.workoutId === id), [sessions, id]);
  const setDraft = useDraftStore((s) => s.setDraft);
  const { online } = useOnline();

  const [apiKey, setKey] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  useEffect(() => {
    getApiKey().then(setKey);
  }, []);

  const load = useMemo(() => {
    const l: Partial<Record<MuscleGroup, number>> = {};
    for (const e of workout?.exercises ?? []) {
      e.muscles.forEach((m, i) => (l[m] = (l[m] ?? 0) + e.sets * (i === 0 ? 1 : 0.5)));
    }
    return l;
  }, [workout]);

  if (!workout) {
    return (
      <Screen edges={[]}>
        <EmptyState icon="alert-circle-outline" title="Тренировка не найдена" text="Возможно, она была удалена." />
      </Screen>
    );
  }

  const edit = () => {
    setDraft(isOwn ? { ...workout } : cloneWorkout(workout, { source: 'custom', title: `${workout.title} (копия)` }));
    router.push('/workout/edit');
  };

  const saveCopy = () => {
    const copy = cloneWorkout(workout, { source: workout.source === 'online' ? 'online' : 'custom' });
    saveWorkout(copy);
    router.replace(`/workout/${copy.id}`);
  };

  const plan = (offset: number) => {
    const key = dayKey(addDays(new Date(), offset));
    scheduleWorkout(key, workout.id);
    notify('Запланировано', `${workout.title} — ${formatDay(key)}`);
  };

  const ask = async () => {
    if (!apiKey || !question.trim()) return;
    setAsking(true);
    setAskError(null);
    try {
      setAnswer(await askCoach(apiKey, workout, question.trim()));
    } catch (e) {
      setAskError(e instanceof AiError ? e.message : 'Не удалось получить ответ.');
    } finally {
      setAsking(false);
    }
  };

  const last = history[0];

  return (
    <Screen edges={[]}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton
              icon={favorite ? 'star' : 'star-outline'}
              color={favorite ? colors.warning : colors.text}
              label={favorite ? 'Убрать из избранного' : 'В избранное'}
              onPress={() => toggleFavorite(workout.id)}
            />
          ),
        }}
      />

      <View style={styles.row}>
        <SportIcon sport={workout.sport} size={28} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={font.h2}>{workout.title}</Text>
          <View style={[styles.row, { flexWrap: 'wrap', gap: 6 }]}>
            <Badge label={sourceLabels[workout.source]} color={workout.source === 'ai' ? colors.accent : colors.textDim} />
            <Badge label={SPORTS[workout.sport].name} />
            <Badge label={goalLabels[workout.goal]} />
            <Badge label={levelLabels[workout.level]} />
          </View>
        </View>
      </View>
      {workout.description ? <Text style={font.dim}>{workout.description}</Text> : null}

      {workout.level !== userLevel ? (
        <Card style={{ borderColor: colors.accent + '66' }}>
          <Text style={font.body}>
            Программа рассчитана на уровень «{levelLabels[workout.level]}», ваш уровень — «{levelLabels[userLevel]}».
          </Text>
          <Button
            title={`Адаптировать под уровень «${levelLabels[userLevel]}»`}
            icon="trending-up"
            variant="secondary"
            small
            onPress={() => {
              const adapted = adaptToLevel(workout, userLevel);
              saveWorkout(adapted);
              router.push(`/workout/${adapted.id}`);
            }}
          />
        </Card>
      ) : null}

      <Button
        title="Начать тренировку"
        icon="play"
        onPress={() => router.push({ pathname: '/workout/play', params: { id: workout.id } })}
      />
      <View style={styles.row}>
        <Button title={isOwn ? 'Изменить' : 'Изменить копию'} icon="create-outline" variant="secondary" small style={{ flex: 1 }} onPress={edit} />
        <Button title="Поделиться" icon="share-outline" variant="secondary" small style={{ flex: 1 }} onPress={() => shareText(exportWorkout(workout), workout.title)} />
      </View>

      <Card>
        <SectionTitle title="Структура" />
        <View style={styles.row}>
          <Stat value={`~${estimateMinutes(workout)}`} label={plural(estimateMinutes(workout), 'минута', 'минуты', 'минут')} />
          <Stat value={workout.exercises.length} label={plural(workout.exercises.length, 'упражнение', 'упражнения', 'упражнений')} />
          <Stat value={totalSets(workout)} label={plural(totalSets(workout), 'подход', 'подхода', 'подходов')} />
        </View>
        <WorkoutTimeline workout={workout} />
        <Divider />
        <Text style={font.h3}>Задействованные мышцы</Text>
        <BodyMap load={load} />
      </Card>

      <Card>
        <SectionTitle title="Упражнения" />
        <Text style={font.small}>
          Нажмите на упражнение, чтобы увидеть анимацию и подсказки по технике. Кнопка ⇄ заменяет упражнение на похожее.
        </Text>
        {workout.exercises.map((e, i) => {
          const openable = !!getBuiltinExercise(e.exerciseId) || e.exerciseId.startsWith('wger_');
          return (
            <ExerciseItem
              key={e.uid}
              item={e}
              index={i}
              onOpen={openable ? () => router.push(`/exercise/${e.exerciseId}`) : undefined}
              onSwap={() =>
                router.push({ pathname: '/exercise-swap', params: { mode: 'workout', workoutId: workout.id, uid: e.uid } })
              }
            />
          );
        })}
      </Card>

      {workout.tips.length ? (
        <Card>
          <SectionTitle title="Советы" />
          {workout.tips.map((t) => (
            <Text key={t} style={font.body}>
              • {t}
            </Text>
          ))}
        </Card>
      ) : null}

      {aiEnabled ? (
        <Card>
          <SectionTitle title="Спросить ИИ-тренера" />
          {!online || !apiKey ? (
            <Notice
              icon="sparkles"
              color={colors.textDim}
              text={!online ? 'Нужен интернет.' : 'Добавьте API-ключ Anthropic в профиле.'}
            />
          ) : (
            <>
              <Field
                placeholder="Например: чем заменить прыжки на тумбу?"
                value={question}
                onChangeText={setQuestion}
                multiline
                style={{ minHeight: 60, textAlignVertical: 'top' }}
              />
              <Button title="Спросить" icon="chatbubble-ellipses-outline" variant="secondary" loading={asking} disabled={!question.trim()} onPress={ask} />
              {askError ? <Notice icon="alert-circle-outline" color={colors.danger} text={askError} /> : null}
              {answer ? <Text style={font.body}>{answer}</Text> : null}
            </>
          )}
        </Card>
      ) : null}

      <Card>
        <SectionTitle title="Запланировать" />
        <ChipGroup>
          <Chip label="Сегодня" onPress={() => plan(0)} />
          <Chip label="Завтра" onPress={() => plan(1)} />
          <Chip label="Послезавтра" onPress={() => plan(2)} />
          <Chip label="Другой день…" onPress={() => router.push('/calendar')} />
        </ChipGroup>
        {last ? (
          <Text style={font.small}>
            Выполнялась {history.length} раз(а), последний — {formatDateTime(last.finishedAt)}
          </Text>
        ) : null}
      </Card>

      {isOwn ? (
        <Button
          title="Удалить тренировку"
          icon="trash-outline"
          variant="danger"
          onPress={() =>
            confirm('Удалить тренировку?', 'История выполнений сохранится.', () => {
              deleteWorkout(workout.id);
              router.back();
            })
          }
        />
      ) : (
        <Button title="Сохранить в «Мои»" icon="bookmark-outline" variant="ghost" onPress={saveCopy} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
