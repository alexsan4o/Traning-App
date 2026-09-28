import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dayKey, MONTHS, monthMatrix, WEEKDAYS_SHORT } from '../lib/date';
import { colors, radius } from '../theme';
import { IconButton } from './ui';

export interface DayMarks {
  done: number;
  planned: number;
}

export function CalendarMonth({
  year,
  month,
  marks,
  selected,
  onSelect,
  onPrev,
  onNext,
}: {
  year: number;
  month: number;
  marks: Map<string, DayMarks>;
  selected: string;
  onSelect: (key: string) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const weeks = monthMatrix(year, month);
  const today = dayKey(new Date());

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" label="Предыдущий месяц" onPress={onPrev} />
        <Text style={styles.title}>
          {MONTHS[month]} {year}
        </Text>
        <IconButton icon="chevron-forward" label="Следующий месяц" onPress={onNext} />
      </View>
      <View style={styles.row}>
        {WEEKDAYS_SHORT.map((d) => (
          <Text key={d} style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.row}>
          {week.map((date, di) => {
            if (!date) return <View key={di} style={styles.cell} />;
            const key = dayKey(date);
            const m = marks.get(key);
            const isSelected = key === selected;
            const isToday = key === today;
            const label = `${date.getDate()} ${MONTHS[month]}${m?.done ? `, тренировок: ${m.done}` : ''}${m?.planned ? `, запланировано: ${m.planned}` : ''}`;
            return (
              <Pressable
                key={key}
                onPress={() => onSelect(key)}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: isSelected }}
                style={[
                  styles.cell,
                  styles.day,
                  m?.done ? styles.dayDone : null,
                  isToday && styles.today,
                  isSelected && styles.selected,
                ]}
              >
                <Text style={[styles.dayText, m?.done ? styles.dayTextDone : null]}>{date.getDate()}</Text>
                <View style={styles.dots}>
                  {m?.done ? <View style={styles.dotDone} /> : null}
                  {m?.planned ? <View style={styles.dotPlanned} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.dotDone} />
          <Text style={styles.legendText}>Выполнено</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.dotPlanned} />
          <Text style={styles.legendText}>Запланировано</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 4 },
  weekday: { flex: 1, textAlign: 'center', color: colors.textFaint, fontSize: 12, fontWeight: '600' },
  cell: { flex: 1, aspectRatio: 1 },
  day: {
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayDone: { backgroundColor: colors.primary + '22' },
  today: { borderColor: colors.textFaint },
  selected: { borderColor: colors.primary, borderWidth: 2 },
  dayText: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  dayTextDone: { color: colors.text },
  dots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 2 },
  dotDone: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  dotPlanned: { width: 6, height: 6, borderRadius: 3, borderWidth: 1.5, borderColor: colors.accent },
  legend: { flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { color: colors.textDim, fontSize: 12 },
});
