import { StyleSheet, Text, View } from 'react-native';

import { phaseLabels } from '../data/labels';
import { formatDuration } from '../lib/date';
import { workoutSegments } from '../lib/workout';
import { chart, colors, phaseOf, type Phase } from '../theme';
import type { Workout } from '../types';
import { Legend } from './charts';

/**
 * Визуализация структуры тренировки: полоса времени, где каждый отрезок — работа
 * в упражнении (цвет — фаза) или отдых после него (серый).
 */
export function WorkoutTimeline({ workout, compact }: { workout: Pick<Workout, 'exercises'>; compact?: boolean }) {
  const segments = workoutSegments(workout);
  const parts: { key: string; sec: number; color: string }[] = [];
  const phases = new Set<Phase>();
  let workTotal = 0;
  let restTotal = 0;
  for (const s of segments) {
    const phase = phaseOf(s.category);
    phases.add(phase);
    parts.push({ key: `${s.uid}-w`, sec: s.workSec, color: chart.phase[phase] });
    if (s.restSec > 0) parts.push({ key: `${s.uid}-r`, sec: s.restSec, color: chart.rest });
    workTotal += s.workSec;
    restTotal += s.restSec;
  }
  const height = compact ? 6 : 18;

  return (
    <View style={{ gap: compact ? 0 : 10 }}>
      <View
        style={[styles.bar, { height, borderRadius: compact ? 3 : 4 }]}
        accessible
        accessibilityLabel={`Работа ${formatDuration(workTotal)}, отдых ${formatDuration(restTotal)}`}
      >
        {parts.map((p) => (
          <View key={p.key} style={{ flexGrow: p.sec, flexBasis: 0, minWidth: 2, backgroundColor: p.color }} />
        ))}
      </View>
      {compact ? null : (
        <>
          <Legend
            items={[
              ...chart.phaseOrder.filter((p) => phases.has(p)).map((p) => ({ label: phaseLabels[p], color: chart.phase[p] })),
              { label: 'Отдых', color: chart.rest },
            ]}
          />
          <Text style={styles.caption}>
            Работа {formatDuration(workTotal)} · отдых {formatDuration(restTotal)}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Отрезки разделены зазором 2px цвета поверхности, без обводок.
  bar: { flexDirection: 'row', gap: 2, overflow: 'hidden' },
  caption: { color: colors.textDim, fontSize: 13 },
});
