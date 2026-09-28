import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, Card, EmptyState, Screen, SectionTitle, Stat } from '../../components/ui';
import { confirm } from '../../lib/confirm';
import { formatClock, formatDateTime, plural } from '../../lib/date';
import { sessionTotals } from '../../lib/stats';
import { useAppStore, useWorkout } from '../../store/useAppStore';
import { colors, font } from '../../theme';

export default function SessionDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAppStore((s) => s.sessions.find((x) => x.id === id));
  const deleteSession = useAppStore((s) => s.deleteSession);
  const workout = useWorkout(session?.workoutId);

  if (!session) {
    return (
      <Screen edges={[]}>
        <EmptyState icon="alert-circle-outline" title="Запись не найдена" />
      </Screen>
    );
  }
  const t = sessionTotals(session);

  return (
    <Screen edges={[]}>
      <Text style={font.h2}>{session.title}</Text>
      <Text style={font.dim}>{formatDateTime(session.startedAt)}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Stat value={formatClock(session.durationSec)} label="время" />
        <Stat value={t.sets} label={plural(t.sets, 'подход', 'подхода', 'подходов')} />
        <Stat value={session.rpe ?? '—'} label="RPE" />
      </View>
      {t.volumeKg ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Stat value={t.reps} label={plural(t.reps, 'повтор', 'повтора', 'повторов')} />
          <Stat value={`${t.volumeKg} кг`} label="объём" />
        </View>
      ) : null}
      {session.notes ? (
        <Card>
          <SectionTitle title="Заметки" />
          <Text style={font.body}>{session.notes}</Text>
        </Card>
      ) : null}
      <Card>
        <SectionTitle title="Подходы" />
        {session.exercises.map((e) => (
          <View key={e.uid} style={{ paddingVertical: 6, gap: 2 }}>
            <Text style={[font.body, { fontWeight: '600' }]}>{e.name}</Text>
            <Text style={font.dim}>
              {e.sets.length
                ? e.sets
                    .map((s) =>
                      e.kind === 'time'
                        ? `${s.durationSec ?? 0} с${s.weightKg ? ` × ${s.weightKg} кг` : ''}`
                        : `${s.reps ?? 0}${s.weightKg ? ` × ${s.weightKg} кг` : ''}`,
                    )
                    .join('  ·  ')
                : 'пропущено'}
            </Text>
          </View>
        ))}
      </Card>
      {workout ? (
        <Button
          title="Повторить тренировку"
          icon="refresh"
          onPress={() => router.push({ pathname: '/workout/play', params: { id: workout.id } })}
        />
      ) : null}
      <Button
        title="Удалить запись"
        icon="trash-outline"
        variant="danger"
        onPress={() =>
          confirm('Удалить запись?', 'Тренировка исчезнет из истории и статистики.', () => {
            deleteSession(session.id);
            router.back();
          })
        }
      />
      <Text style={[font.small, { color: colors.textFaint, textAlign: 'center' }]}>
        Завершена {formatDateTime(session.finishedAt)}
      </Text>
    </Screen>
  );
}
