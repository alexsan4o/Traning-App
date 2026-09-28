import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip, ChipGroup, EmptyState, Field, Screen, SectionTitle, Stat } from '../../components/ui';
import { formatClock, plural } from '../../lib/date';
import { personalRecords, sessionTotals } from '../../lib/stats';
import { useAppStore } from '../../store/useAppStore';
import { colors, font, spacing } from '../../theme';

const RPE_HINTS: Record<number, string> = {
  1: 'Очень легко',
  3: 'Легко',
  5: 'Умеренно',
  7: 'Тяжело',
  8: 'Очень тяжело',
  9: 'Почти предел',
  10: 'Предел',
};

export default function Summary() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessions = useAppStore((s) => s.sessions);
  const updateSession = useAppStore((s) => s.updateSession);
  const session = sessions.find((s) => s.id === id);
  const [rpe, setRpe] = useState<number | undefined>(session?.rpe);
  const [notes, setNotes] = useState(session?.notes ?? '');

  const newRecords = useMemo(() => {
    if (!session) return [];
    const before = new Map(personalRecords(sessions.filter((s) => s.id !== id)).map((r) => [r.exerciseId, r]));
    const now = personalRecords([session]);
    const out: string[] = [];
    for (const r of now) {
      const prev = before.get(r.exerciseId);
      if (!prev) continue;
      if (r.maxWeightKg > prev.maxWeightKg && r.maxWeightKg > 0) out.push(`${r.name}: ${r.maxWeightKg} кг`);
      else if (r.kind === 'reps' && r.maxReps > prev.maxReps && !r.maxWeightKg) out.push(`${r.name}: ${r.maxReps} повт.`);
      else if (r.kind === 'time' && r.maxDurationSec > prev.maxDurationSec) out.push(`${r.name}: ${r.maxDurationSec} с`);
    }
    return out;
  }, [sessions, session, id]);

  if (!session) {
    return (
      <Screen edges={[]}>
        <EmptyState icon="alert-circle-outline" title="Запись не найдена" action={<Button title="На главную" onPress={() => router.replace('/')} />} />
      </Screen>
    );
  }

  const t = sessionTotals(session);
  const done = () => {
    updateSession(session.id, { rpe, notes: notes.trim() || undefined });
    router.replace('/');
  };

  return (
    <Screen edges={['bottom']}>
      <View style={styles.hero}>
        <Ionicons name="trophy" size={56} color={colors.warning} />
        <Text style={font.h1}>Отличная работа!</Text>
        <Text style={font.dim}>{session.title}</Text>
      </View>

      <View style={styles.row}>
        <Stat value={formatClock(session.durationSec)} label="время" />
        <Stat value={t.sets} label={plural(t.sets, 'подход', 'подхода', 'подходов')} />
        <Stat value={t.reps} label={plural(t.reps, 'повтор', 'повтора', 'повторов')} />
      </View>
      {t.volumeKg ? (
        <View style={styles.row}>
          <Stat value={`${t.volumeKg} кг`} label="поднятый объём" />
          <Stat value={t.workSec ? formatClock(t.workSec) : '—'} label="время под нагрузкой" />
        </View>
      ) : null}

      {newRecords.length ? (
        <Card style={{ borderColor: colors.warning + '88' }}>
          <SectionTitle title="Новые рекорды 🏆" />
          {newRecords.map((r) => (
            <Text key={r} style={font.body}>
              • {r}
            </Text>
          ))}
        </Card>
      ) : null}

      <Card>
        <SectionTitle title="Насколько было тяжело?" />
        <Text style={font.dim}>Шкала RPE от 1 до 10 помогает планировать нагрузку и восстановление.</Text>
        <ChipGroup>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <Chip key={n} label={String(n)} selected={rpe === n} onPress={() => setRpe(n)} />
          ))}
        </ChipGroup>
        {rpe ? <Text style={font.small}>{RPE_HINTS[rpe] ?? RPE_HINTS[rpe - 1] ?? ''}</Text> : null}
        <Field label="Заметки" placeholder="Самочувствие, что улучшить…" value={notes} onChangeText={setNotes} multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
      </Card>

      <Card>
        <SectionTitle title="Выполнено" />
        {session.exercises.map((e) => (
          <View key={e.uid} style={styles.exRow}>
            <Ionicons
              name={e.sets.length >= e.targetSets ? 'checkmark-circle' : e.sets.length ? 'ellipse-outline' : 'close-circle-outline'}
              size={18}
              color={e.sets.length >= e.targetSets ? colors.success : colors.textFaint}
            />
            <Text style={[font.body, { flex: 1 }]} numberOfLines={1}>
              {e.name}
            </Text>
            <Text style={font.dim}>
              {e.sets.length}/{e.targetSets}
            </Text>
          </View>
        ))}
      </Card>

      <Button title="Готово" icon="checkmark" onPress={done} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.sm },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
});
