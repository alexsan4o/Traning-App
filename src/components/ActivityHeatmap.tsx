import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { formatDay, MONTHS, WEEKDAYS_SHORT } from '../lib/date';
import { activityHeatmap } from '../lib/stats';
import { chart, colors } from '../theme';
import type { Session } from '../types';

/** Тепловая карта активности по дням за последние недели (минуты тренировок). */
export function ActivityHeatmap({ sessions, weeks = 17 }: { sessions: Session[]; weeks?: number }) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<{ key: string; minutes: number } | null>(null);
  const columns = activityHeatmap(sessions, weeks);
  const max = Math.max(0, ...columns.flat().map((c) => c.minutes));
  const labelW = 22;
  const gap = 3;
  const cell = width ? Math.max(8, Math.floor((width - labelW - gap * (weeks - 1)) / weeks)) : 0;
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  // Пороговые ступени шкалы: 1–15 / 16–30 / 31–45 / 46–60 / >60 минут (или от максимума, если он меньше).
  const colorFor = (m: number) => {
    if (m <= 0) return chart.empty;
    const top = Math.max(max, 60);
    const idx = Math.min(chart.ramp.length - 1, Math.floor((m / top) * chart.ramp.length));
    return chart.ramp[idx];
  };
  const activeDays = columns.flat().filter((c) => c.minutes > 0).length;

  return (
    <View onLayout={onLayout} style={{ gap: 8 }} accessible accessibilityLabel={`Активных дней за ${weeks} недель: ${activeDays}`}>
      {cell > 0 ? (
        <>
          <View style={[styles.row, { marginLeft: labelW, gap }]}>
            {columns.map((col, i) => {
              const first = col[0].date;
              const showMonth = i === 0 || first.getDate() <= 7;
              return (
                <Text key={col[0].key} style={[styles.month, { width: cell }]} numberOfLines={1}>
                  {showMonth ? MONTHS[first.getMonth()].slice(0, 3) : ''}
                </Text>
              );
            })}
          </View>
          <View style={styles.row}>
            <View style={{ width: labelW, gap }}>
              {WEEKDAYS_SHORT.map((d, i) => (
                <Text key={d} style={[styles.weekday, { height: cell, lineHeight: cell }]}>
                  {i % 2 === 0 ? d : ''}
                </Text>
              ))}
            </View>
            <View style={[styles.row, { gap }]}>
              {columns.map((col) => (
                <View key={col[0].key} style={{ gap }}>
                  {col.map((c) => (
                    <Pressable
                      key={c.key}
                      onPress={() => setSelected({ key: c.key, minutes: c.minutes })}
                      accessibilityLabel={`${formatDay(c.key)}: ${c.minutes} мин`}
                      style={{
                        width: cell,
                        height: cell,
                        borderRadius: 3,
                        backgroundColor: colorFor(c.minutes),
                        borderWidth: selected?.key === c.key ? 1.5 : 0,
                        borderColor: colors.text,
                      }}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </>
      ) : null}
      <View style={styles.footer}>
        <Text style={styles.caption}>
          {selected ? `${formatDay(selected.key)}: ${selected.minutes} мин` : `Активных дней: ${activeDays}`}
        </Text>
        <View style={styles.scale}>
          <Text style={styles.caption}>Меньше</Text>
          {[chart.empty, ...chart.ramp].map((c) => (
            <View key={c} style={[styles.swatch, { backgroundColor: c }]} />
          ))}
          <Text style={styles.caption}>Больше</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  month: { color: colors.textFaint, fontSize: 9, overflow: 'visible' },
  weekday: { color: colors.textFaint, fontSize: 9 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  caption: { color: colors.textDim, fontSize: 12 },
  scale: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
});
