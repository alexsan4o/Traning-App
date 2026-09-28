import { Ionicons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressRing } from '../../components/charts';
import { Badge, Button, Card, EmptyState, IconButton, Stepper } from '../../components/ui';
import { categoryLabels, muscleLabels } from '../../data/labels';
import { useNow } from '../../hooks/useNow';
import { formatClock } from '../../lib/date';
import { cancelRestEnd, say, scheduleRestEnd, success, tap, tick } from '../../lib/feedback';
import { uid } from '../../lib/id';
import { describeTarget, totalSets } from '../../lib/workout';
import { useAppStore, useWorkout } from '../../store/useAppStore';
import { chart, colors, font, phaseOf, radius, spacing } from '../../theme';
import type { ExerciseLog, Session, SetLog } from '../../types';

export default function Player() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workout = useWorkout(id);
  const active = useAppStore((s) => s.activeSession);
  const sessions = useAppStore((s) => s.sessions);
  const settings = useAppStore((s) => s.settings);
  const startSession = useAppStore((s) => s.startSession);
  const updateActive = useAppStore((s) => s.updateActive);
  const discardActive = useAppStore((s) => s.discardActive);
  const addSession = useAppStore((s) => s.addSession);

  // Начинаем новую сессию, если нет активной для этой тренировки.
  useEffect(() => {
    if (workout && (!active || active.workoutId !== workout.id)) startSession(workout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workout?.id]);

  useEffect(() => {
    if (!settings.keepAwake) return;
    activateKeepAwakeAsync('workout').catch(() => {});
    return () => {
      deactivateKeepAwake('workout').catch(() => {});
    };
  }, [settings.keepAwake]);

  useEffect(() => () => void cancelRestEnd(), []);

  const session = active && workout && active.workoutId === workout.id ? active : null;
  // Упражнения с учётом замен, сделанных только в этой тренировке.
  const overrides = session?.overrides;
  const exercises = useMemo(
    () => (workout?.exercises ?? []).map((e) => overrides?.[e.uid] ?? e),
    [workout?.exercises, overrides],
  );
  const exIdx = session ? Math.min(session.exerciseIndex, exercises.length - 1) : 0;
  const item = exercises[exIdx];
  const log = session?.logs[exIdx];

  const [count, setCount] = useState(0);
  const [weight, setWeight] = useState(0);
  const [workEndsAt, setWorkEndsAt] = useState<number | null>(null);
  const [workRemaining, setWorkRemaining] = useState<number | null>(null);
  const [tipIndex, setTipIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const announced = useRef<number | null>(null);
  const completedKey = useRef<string | null>(null);

  const resting = !!session?.restEndsAt;
  const now = useNow(200, !!session);
  const restLeft = session?.restEndsAt ? Math.max(0, (session.restEndsAt - now) / 1000) : 0;
  const workLeft = workEndsAt ? Math.max(0, (workEndsAt - now) / 1000) : workRemaining;

  const lastWeightFor = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) {
      for (const e of s.exercises) {
        if (map.has(e.exerciseId)) continue;
        const w = [...e.sets].reverse().find((x) => x.weightKg)?.weightKg;
        if (w) map.set(e.exerciseId, w);
      }
    }
    return map;
  }, [sessions]);

  // Сброс полей ввода при переходе к новому подходу или упражнению (обновление состояния во время рендера).
  const setNumber = (log?.sets.length ?? 0) + 1;
  const itemKey = `${item?.uid ?? ''}|${item?.exerciseId ?? ''}`;
  const setKey = `${itemKey}|${setNumber}`;
  const [prevSetKey, setPrevSetKey] = useState<string | null>(null);
  if (item && prevSetKey !== setKey) {
    const itemChanged = !prevSetKey?.startsWith(`${itemKey}|`);
    setPrevSetKey(setKey);
    setCount(0);
    setWorkEndsAt(null);
    setWorkRemaining(item.kind === 'time' ? (item.durationSec ?? 30) * (item.perSide ? 2 : 1) : null);
    const prevSet = log?.sets[log.sets.length - 1];
    setWeight(prevSet?.weightKg ?? item.weightKg ?? lastWeightFor.get(item.exerciseId) ?? 0);
    if (itemChanged) setTipIndex(0);
  }

  useEffect(() => {
    const tips = item?.tips ?? [];
    if (tips.length < 2) return;
    const t = setInterval(() => setTipIndex((i) => (i + 1) % tips.length), 9000);
    return () => clearInterval(t);
  }, [item?.uid, item?.tips]);

  // Обратный отсчёт и окончание отдыха.
  useEffect(() => {
    if (!session?.restEndsAt || !item) return;
    const sec = Math.ceil(restLeft);
    if (sec <= 3 && sec > 0 && announced.current !== sec) {
      announced.current = sec;
      tick();
      if (sec === 3) say('Три');
    }
    if (restLeft <= 0) {
      announced.current = null;
      success();
      say(`Отдых окончен. ${item.name}`);
      updateActive({ restEndsAt: undefined, restTotalSec: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  // Таймер подхода на время.
  useEffect(() => {
    if (!workEndsAt || !item) return;
    const left = (workEndsAt - now) / 1000;
    const sec = Math.ceil(left);
    const total = (item.durationSec ?? 30) * (item.perSide ? 2 : 1);
    if (item.perSide && Math.abs(left - total / 2) < 0.15 && announced.current !== -1) {
      announced.current = -1;
      tick();
      say('Смена стороны');
    }
    if (sec <= 3 && sec > 0 && announced.current !== 100 + sec) {
      announced.current = 100 + sec;
      tick();
    }
    // Поля подхода сбросятся при следующем рендере (новый setKey); ref защищает от двойного завершения.
    if (left <= 0 && completedKey.current !== setKey) {
      completedKey.current = setKey;
      announced.current = null;
      say('Стоп');
      completeSet({
        durationSec: item.durationSec ?? 30,
        weightKg: weight > 0 ? weight : undefined,
        completedAt: new Date().toISOString(),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  if (!workout) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState icon="alert-circle-outline" title="Тренировка не найдена" action={<Button title="Назад" onPress={() => router.back()} />} />
      </SafeAreaView>
    );
  }
  if (!session || !item || !log) {
    return <SafeAreaView style={styles.safe} />;
  }

  const setsDone = session.logs.reduce((a, l) => a + l.sets.length, 0);
  const setsTotal = totalSets(workout);
  const elapsed = (now - new Date(session.startedAt).getTime()) / 1000;
  const isLastExercise = exIdx === exercises.length - 1;
  const tips = item.tips ?? [];

  function finish(logs: ExerciseLog[] = session!.logs) {
    cancelRestEnd();
    const finishedAt = new Date();
    const s: Session = {
      id: uid('s_'),
      workoutId: workout!.id,
      title: workout!.title,
      sport: workout!.sport,
      startedAt: session!.startedAt,
      finishedAt: finishedAt.toISOString(),
      durationSec: Math.round((finishedAt.getTime() - new Date(session!.startedAt).getTime()) / 1000),
      exercises: logs,
    };
    addSession(s);
    success();
    say('Тренировка завершена. Отличная работа!');
    router.replace({ pathname: '/workout/summary', params: { id: s.id } });
  }

  function completeSet(set: SetLog) {
    const logs = session!.logs.map((l, i) => (i === exIdx ? { ...l, sets: [...l.sets, set] } : l));
    const exerciseDone = logs[exIdx].sets.length >= item!.sets;
    tap();
    if (exerciseDone && isLastExercise) {
      finish(logs);
      return;
    }
    const nextIdx = exerciseDone ? exIdx + 1 : exIdx;
    const rest = item!.restSec;
    if (rest > 0) {
      const next = exercises[nextIdx];
      updateActive({ logs, exerciseIndex: nextIdx, restEndsAt: Date.now() + rest * 1000, restTotalSec: rest });
      scheduleRestEnd(rest, next.name);
    } else {
      updateActive({ logs, exerciseIndex: nextIdx });
    }
  }

  const completeRepsSet = () =>
    completeSet({
      reps: count > 0 ? count : item.reps ?? 10,
      weightKg: weight > 0 ? weight : undefined,
      completedAt: new Date().toISOString(),
    });

  const completeTimeSet = () => {
    const total = (item.durationSec ?? 30) * (item.perSide ? 2 : 1);
    const left = workLeft ?? total;
    const done = Math.max(1, Math.round((total - left) / (item.perSide ? 2 : 1)));
    setWorkEndsAt(null);
    completeSet({
      durationSec: left <= 0 || left === total ? item.durationSec ?? 30 : done,
      weightKg: weight > 0 ? weight : undefined,
      completedAt: new Date().toISOString(),
    });
  };

  const toggleWork = () => {
    if (workEndsAt) {
      setWorkRemaining((workEndsAt - Date.now()) / 1000);
      setWorkEndsAt(null);
    } else {
      const remaining = workRemaining ?? (item.durationSec ?? 30) * (item.perSide ? 2 : 1);
      setWorkEndsAt(Date.now() + remaining * 1000);
      announced.current = null;
      completedKey.current = null;
      tap();
    }
  };

  const adjustRest = (delta: number) => {
    if (!session.restEndsAt) return;
    const endsAt = Math.max(Date.now() + 1000, session.restEndsAt + delta * 1000);
    updateActive({ restEndsAt: endsAt, restTotalSec: Math.max(1, (session.restTotalSec ?? 0) + delta) });
    scheduleRestEnd((endsAt - Date.now()) / 1000, item.name);
  };

  const skipRest = () => {
    cancelRestEnd();
    updateActive({ restEndsAt: undefined, restTotalSec: undefined });
  };

  const goTo = (idx: number) => {
    cancelRestEnd();
    updateActive({ exerciseIndex: Math.max(0, Math.min(exercises.length - 1, idx)), restEndsAt: undefined, restTotalSec: undefined });
  };

  const undoSet = () => {
    const logs = session.logs.map((l, i) => (i === exIdx ? { ...l, sets: l.sets.slice(0, -1) } : l));
    updateActive({ logs });
  };

  const phaseColor = chart.phase[phaseOf(item.category)];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <IconButton icon="close" label="Меню тренировки" onPress={() => setMenuOpen(true)} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={font.small} numberOfLines={1}>
            {workout.title}
          </Text>
          <Text style={styles.clock}>{formatClock(elapsed)}</Text>
        </View>
        <Text style={[font.small, { minWidth: 40, textAlign: 'right' }]}>
          {setsDone}/{setsTotal}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(setsDone / Math.max(1, setsTotal)) * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.exerciseDots}>
          {exercises.map((e, i) => {
            const l = session.logs[i];
            const done = l && l.sets.length >= e.sets;
            return (
              <Pressable
                key={e.uid}
                onPress={() => goTo(i)}
                accessibilityLabel={`Упражнение ${i + 1}: ${e.name}`}
                style={[
                  styles.exDot,
                  done && { backgroundColor: colors.primary },
                  i === exIdx && { borderColor: colors.text, borderWidth: 2 },
                ]}
              />
            );
          })}
        </View>

        {resting ? (
          <View style={styles.center}>
            <Text style={styles.restLabel}>Отдых</Text>
            <ProgressRing size={230} stroke={14} progress={restLeft / Math.max(1, session.restTotalSec ?? 1)} color={colors.rest}>
              <Text style={styles.bigTime}>{formatClock(Math.ceil(restLeft))}</Text>
            </ProgressRing>
            <View style={styles.row}>
              <Button title="−15 с" variant="secondary" small onPress={() => adjustRest(-15)} />
              <Button title="+15 с" variant="secondary" small onPress={() => adjustRest(15)} />
              <Button title="Пропустить" icon="play-skip-forward" small onPress={skipRest} />
            </View>
            <Card style={{ alignSelf: 'stretch' }}>
              <Text style={font.small}>Далее</Text>
              <Text style={font.h3}>{item.name}</Text>
              <Text style={font.dim}>
                Подход {setNumber} из {item.sets} · {describeTarget(item)}
              </Text>
              {tips[0] ? (
                <View style={styles.tipRow}>
                  <Ionicons name="bulb-outline" size={16} color={colors.warning} />
                  <Text style={[font.dim, { flex: 1 }]}>{tips[0]}</Text>
                </View>
              ) : null}
            </Card>
          </View>
        ) : (
          <View style={{ gap: spacing.lg }}>
            <View style={{ gap: 6 }}>
              <View style={styles.metaRow}>
                <View style={[styles.phaseDot, { backgroundColor: phaseColor }]} />
                <Text style={font.small}>
                  {categoryLabels[item.category]} · {item.muscles.map((m) => muscleLabels[m]).join(', ')}
                </Text>
              </View>
              <Text style={font.h1}>{item.name}</Text>
              <View style={styles.metaRow}>
                <Badge label={`Подход ${setNumber} из ${item.sets}`} color={colors.primary} />
                <Text style={font.dim}>{describeTarget(item)}</Text>
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/exercise-swap', params: { mode: 'session', workoutId: workout.id, uid: item.uid } })
                  }
                  hitSlop={8}
                  accessibilityRole="button"
                  style={styles.swapButton}
                >
                  <Ionicons name="swap-horizontal" size={14} color={colors.accent} />
                  <Text style={styles.swapText}>Заменить</Text>
                </Pressable>
              </View>
              <View style={styles.setDots}>
                {Array.from({ length: item.sets }).map((_, i) => (
                  <View key={i} style={[styles.setDot, i < log.sets.length && { backgroundColor: colors.primary }]} />
                ))}
                {log.sets.length ? (
                  <Pressable onPress={undoSet} hitSlop={8} accessibilityRole="button">
                    <Text style={styles.undo}>отменить подход</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {item.kind === 'reps' ? (
              <View style={styles.center}>
                <Pressable
                  onPress={() => {
                    setCount((c) => c + 1);
                    tap();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Повторений: ${count}. Нажмите, чтобы добавить`}
                  style={({ pressed }) => [styles.counter, pressed && { transform: [{ scale: 0.97 }] }]}
                >
                  <ProgressRing size={210} stroke={12} progress={count / Math.max(1, item.reps ?? 10)} color={colors.primary}>
                    <Text style={styles.bigCount}>{count}</Text>
                    <Text style={font.dim}>из {item.reps ?? 10} повт.</Text>
                  </ProgressRing>
                </Pressable>
                <Text style={font.small}>Нажимайте на круг на каждом повторе или сразу отметьте подход</Text>
                <View style={styles.row}>
                  <Stepper label="Повторы" value={count} onChange={setCount} min={0} max={200} />
                  <Stepper label="Вес" value={weight} onChange={setWeight} step={2.5} min={0} max={500} suffix="кг" />
                </View>
              </View>
            ) : (
              <View style={styles.center}>
                <Pressable onPress={toggleWork} accessibilityRole="button" accessibilityLabel={workEndsAt ? 'Пауза' : 'Старт'}>
                  <ProgressRing
                    size={210}
                    stroke={12}
                    progress={(workLeft ?? 0) / Math.max(1, (item.durationSec ?? 30) * (item.perSide ? 2 : 1))}
                    color={colors.primary}
                  >
                    <Text style={styles.bigTime}>{formatClock(Math.ceil(workLeft ?? 0))}</Text>
                    <Ionicons name={workEndsAt ? 'pause' : 'play'} size={28} color={colors.text} />
                  </ProgressRing>
                </Pressable>
                {item.perSide ? <Text style={font.small}>Таймер на обе стороны — голос подскажет смену стороны</Text> : null}
                <Stepper label="Вес (необязательно)" value={weight} onChange={setWeight} step={2.5} min={0} max={500} suffix="кг" />
              </View>
            )}

            {tips.length ? (
              <Pressable onPress={() => setTipIndex((i) => (i + 1) % tips.length)} style={styles.tipCard} accessibilityRole="button">
                <Ionicons name="bulb" size={20} color={colors.warning} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={font.small}>
                    Подсказка {tipIndex + 1}/{tips.length}
                  </Text>
                  <Text style={font.body}>{tips[tipIndex % tips.length]}</Text>
                </View>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <IconButton icon="chevron-back" label="Предыдущее упражнение" onPress={() => goTo(exIdx - 1)} />
        {resting ? (
          <Button title="Начать подход" icon="play" style={{ flex: 1 }} onPress={skipRest} />
        ) : item.kind === 'reps' ? (
          <Button title="Подход выполнен" icon="checkmark" style={{ flex: 1 }} onPress={completeRepsSet} />
        ) : (
          <Button
            title={workEndsAt ? 'Завершить досрочно' : 'Подход выполнен'}
            icon="checkmark"
            variant={workEndsAt ? 'secondary' : 'primary'}
            style={{ flex: 1 }}
            onPress={completeTimeSet}
          />
        )}
        <IconButton
          icon={isLastExercise ? 'flag-outline' : 'chevron-forward'}
          label={isLastExercise ? 'Завершить тренировку' : 'Следующее упражнение'}
          onPress={() => (isLastExercise ? setMenuOpen(true) : goTo(exIdx + 1))}
        />
      </View>

      {menuOpen ? (
        <View style={styles.overlay}>
          <Card style={{ gap: spacing.md }}>
            <Text style={font.h2}>Завершить тренировку?</Text>
            <Text style={font.dim}>
              Выполнено подходов: {setsDone} из {setsTotal}.
            </Text>
            <Button title="Завершить и сохранить" icon="checkmark-done" disabled={setsDone === 0} onPress={() => finish()} />
            <Button title="Продолжить тренировку" variant="secondary" onPress={() => setMenuOpen(false)} />
            <Button
              title="Выйти без сохранения"
              variant="danger"
              onPress={() => {
                cancelRestEnd();
                discardActive();
                router.back();
              }}
            />
            <Button title="Свернуть (продолжить позже)" variant="ghost" onPress={() => router.back()} />
          </Card>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  clock: { color: colors.text, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  progressTrack: { height: 4, backgroundColor: colors.surfaceAlt, marginHorizontal: spacing.lg, borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: colors.primary, borderRadius: 2 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  exerciseDots: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  exDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.surfaceAlt, borderColor: 'transparent', borderWidth: 0 },
  center: { alignItems: 'center', gap: spacing.lg },
  restLabel: { color: colors.rest, fontSize: 18, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  bigTime: { color: colors.text, fontSize: 52, fontWeight: '800', fontVariant: ['tabular-nums'] },
  bigCount: { color: colors.text, fontSize: 72, fontWeight: '800' },
  counter: { borderRadius: 999 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  swapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.accent + '1F',
  },
  swapText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  phaseDot: { width: 10, height: 10, borderRadius: 5 },
  setDots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  setDot: { width: 22, height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt },
  undo: { color: colors.textFaint, fontSize: 12, textDecorationLine: 'underline', marginLeft: 8 },
  tipRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  tipCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.warning + '44',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000AA',
    justifyContent: 'center',
    padding: spacing.lg,
  },
});
