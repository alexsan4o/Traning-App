import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen, Segmented, Stat } from '../components/ui';
import { success, tap } from '../lib/feedback';
import { useAppStore } from '../store/useAppStore';
import { colors, font, radius, spacing } from '../theme';

type Mode = 'signal' | 'lights';
type Phase = 'idle' | 'waiting' | 'go' | 'result' | 'false-start' | 'done';

const ATTEMPTS = 5;
// В react-native-web onPressIn по умолчанию срабатывает с задержкой 50 мс и теряется при быстром клике.
const instantPressIn = Platform.OS === 'web' ? ({ delayPressIn: 0 } as object) : {};
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export default function ReactionTest() {
  const addReactionResult = useAppStore((s) => s.addReactionResult);
  const results = useAppStore((s) => s.reactionResults);
  const [mode, setMode] = useState<Mode>('lights');
  const [phase, setPhase] = useState<Phase>('idle');
  const [lights, setLights] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [last, setLast] = useState<number | null>(null);
  const goAt = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const go = () => {
    goAt.current = nowMs();
    setLights(0);
    setPhase('go');
  };

  const startAttempt = () => {
    clearTimers();
    setLast(null);
    setPhase('waiting');
    if (mode === 'signal') {
      timers.current.push(setTimeout(go, 1500 + Math.random() * 2500));
    } else {
      // Пять красных огней загораются раз в секунду, затем гаснут через случайную паузу.
      setLights(0);
      for (let i = 1; i <= 5; i++) timers.current.push(setTimeout(() => setLights(i), i * 1000));
      timers.current.push(setTimeout(go, 5000 + 200 + Math.random() * 2800));
    }
  };

  const onPress = () => {
    if (phase === 'idle' || phase === 'result' || phase === 'false-start') return startAttempt();
    if (phase === 'waiting') {
      clearTimers();
      setLights(0);
      setPhase('false-start');
      return;
    }
    if (phase === 'go') {
      const ms = Math.round(nowMs() - goAt.current);
      tap();
      const next = [...times, ms];
      setLast(ms);
      setTimes(next);
      if (next.length >= ATTEMPTS) {
        const best = Math.min(...next);
        const avg = Math.round(next.reduce((a, b) => a + b, 0) / next.length);
        addReactionResult({ date: new Date().toISOString(), bestMs: best, avgMs: avg, attempts: next.length });
        success();
        setPhase('done');
      } else {
        setPhase('result');
      }
    }
  };

  const reset = () => {
    clearTimers();
    setTimes([]);
    setLast(null);
    setLights(0);
    setPhase('idle');
  };

  const bg =
    phase === 'go' && mode === 'signal'
      ? colors.success
      : phase === 'waiting' && mode === 'signal'
        ? colors.danger
        : phase === 'false-start'
          ? colors.warning
          : colors.surface;

  const message: Record<Phase, string> = {
    idle: 'Нажмите, чтобы начать',
    waiting: mode === 'signal' ? 'Ждите зелёного…' : 'Ждите, пока погаснут огни…',
    go: mode === 'signal' ? 'ЖМИ!' : 'СТАРТ!',
    result: `${last} мс — нажмите для следующей попытки`,
    'false-start': 'Фальстарт! Нажмите, чтобы повторить',
    done: 'Серия завершена',
  };

  const best = times.length ? Math.min(...times) : null;
  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
  const record = results.length ? Math.min(...results.map((r) => r.bestMs)) : null;

  return (
    <Screen edges={[]}>
      <Segmented<Mode>
        options={[
          { value: 'lights', label: 'Старт (5 огней)' },
          { value: 'signal', label: 'Смена цвета' },
        ]}
        value={mode}
        onChange={(m) => {
          reset();
          setMode(m);
        }}
      />
      <Text style={font.dim}>
        {mode === 'lights'
          ? 'Как на старте гонки: загораются пять красных огней, затем гаснут. Нажмите в момент, когда они погаснут.'
          : 'Экран становится зелёным в случайный момент — нажмите как можно быстрее.'}
        {` ${ATTEMPTS} попыток в серии.`}
      </Text>

      <Pressable
        {...instantPressIn}
        unstable_pressDelay={0}
        onPressIn={phase === 'done' ? undefined : onPress}
        style={[styles.pad, { backgroundColor: bg }]}
        accessibilityRole="button"
        accessibilityLabel={message[phase]}
      >
        {mode === 'lights' ? (
          <View style={styles.lights}>
            {Array.from({ length: 5 }).map((_, i) => (
              <View key={i} style={[styles.light, i < lights && phase === 'waiting' && styles.lightOn]} />
            ))}
          </View>
        ) : null}
        <Text style={[styles.message, phase === 'go' && { fontSize: 40 }]}>{message[phase]}</Text>
        {last !== null && phase !== 'go' ? <Text style={styles.last}>{last} мс</Text> : null}
        <Text style={font.small}>
          Попытка {Math.min(times.length + (phase === 'done' ? 0 : 1), ATTEMPTS)} из {ATTEMPTS}
        </Text>
      </Pressable>

      <View style={styles.row}>
        <Stat value={best ? `${best} мс` : '—'} label="лучшая в серии" color={colors.primary} />
        <Stat value={avg ? `${avg} мс` : '—'} label="средняя" />
        <Stat value={record ? `${record} мс` : '—'} label="рекорд" />
      </View>

      {phase === 'done' ? <Button title="Новая серия" icon="refresh" onPress={reset} /> : null}

      <Card>
        <Text style={font.h3}>Как тренировать реакцию</Text>
        <Text style={font.dim}>
          • Делайте 2–3 серии в начале тренировки, пока вы свежи.{'\n'}• Не пытайтесь угадать момент — фальстарты не
          засчитываются.{'\n'}• Средний результат 200–250 мс, у опытных пилотов — 150–200 мс.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: {
    height: 320,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  lights: { flexDirection: 'row', gap: 10, backgroundColor: '#05070A', padding: 12, borderRadius: radius.lg },
  light: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#2A1215' },
  lightOn: { backgroundColor: '#EF4444', shadowColor: '#EF4444', shadowOpacity: 0.9, shadowRadius: 12 },
  message: { color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  last: { color: colors.text, fontSize: 48, fontWeight: '800' },
  row: { flexDirection: 'row', gap: spacing.sm },
});
