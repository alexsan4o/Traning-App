import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { categoryLabels, muscleLabels } from '../data/labels';
import { describeTarget } from '../lib/workout';
import { chart, colors, font, phaseOf } from '../theme';
import type { WorkoutExercise } from '../types';

/** Строка упражнения в тренировке с раскрывающимися подсказками по технике. */
export function ExerciseItem({
  item,
  index,
  onOpen,
  onSwap,
}: {
  item: WorkoutExercise;
  index: number;
  onOpen?: () => void;
  /** Показать кнопку замены упражнения на похожее. */
  onSwap?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const tips = item.tips ?? [];
  return (
    <View style={styles.wrap}>
      <Pressable style={styles.row} onPress={() => (tips.length ? setOpen(!open) : onOpen?.())} accessibilityRole="button">
        <View style={[styles.index, { borderColor: chart.phase[phaseOf(item.category)] }]}>
          <Text style={styles.indexText}>{index + 1}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[font.body, { fontWeight: '600' }]}>{item.name}</Text>
          <Text style={font.dim}>
            {item.sets} × {describeTarget(item)} · отдых {item.restSec} с
          </Text>
          <Text style={font.small}>
            {categoryLabels[item.category]} · {item.muscles.map((m) => muscleLabels[m]).join(', ')}
          </Text>
        </View>
        {tips.length ? <Ionicons name={open ? 'chevron-up' : 'bulb-outline'} size={20} color={colors.warning} /> : null}
        {onSwap ? (
          <Pressable
            onPress={onSwap}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Заменить упражнение ${item.name}`}
            style={styles.swap}
          >
            <Ionicons name="swap-horizontal" size={18} color={colors.accent} />
          </Pressable>
        ) : null}
      </Pressable>
      {open ? (
        <View style={styles.tips}>
          {tips.map((t) => (
            <Text key={t} style={styles.tip}>
              • {t}
            </Text>
          ))}
          {item.notes ? <Text style={[styles.tip, { color: colors.textDim }]}>Заметка: {item.notes}</Text> : null}
          {onOpen ? (
            <Pressable onPress={onOpen} accessibilityRole="link">
              <Text style={styles.link}>Подробнее об упражнении →</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 10, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  index: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: { color: colors.text, fontWeight: '700' },
  tips: { marginLeft: 42, gap: 4, backgroundColor: colors.surfaceAlt, borderRadius: 10, padding: 10 },
  tip: { color: colors.text, fontSize: 14, lineHeight: 20 },
  link: { color: colors.primary, fontWeight: '600', marginTop: 4 },
  swap: { padding: 6, borderRadius: 999, backgroundColor: colors.accent + '1F' },
});
