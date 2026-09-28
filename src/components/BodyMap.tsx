import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Rect } from 'react-native-svg';

import { muscleLabels } from '../data/labels';
import { chart, colors, rampColor } from '../theme';
import type { MuscleGroup } from '../types';

type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r: number; muscle?: MuscleGroup }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; muscle?: MuscleGroup };

const rect = (x: number, y: number, w: number, h: number, r: number, muscle?: MuscleGroup): Shape => ({
  kind: 'rect', x, y, w, h, r, muscle,
});
const ell = (cx: number, cy: number, rx: number, ry: number, muscle?: MuscleGroup): Shape => ({
  kind: 'ellipse', cx, cy, rx, ry, muscle,
});

// Упрощённый силуэт, viewBox 0 0 100 200.
const FRONT: Shape[] = [
  rect(45, 27, 10, 8, 3, 'neck'),
  ell(31, 42, 9, 7, 'shoulders'),
  ell(69, 42, 9, 7, 'shoulders'),
  rect(36, 37, 13.5, 17, 5, 'chest'),
  rect(50.5, 37, 13.5, 17, 5, 'chest'),
  rect(19, 49, 9, 24, 4.5, 'arms'),
  rect(72, 49, 9, 24, 4.5, 'arms'),
  rect(15, 75, 8, 25, 4, 'forearms'),
  rect(77, 75, 8, 25, 4, 'forearms'),
  rect(39, 56, 22, 31, 6, 'core'),
  rect(38, 89, 24, 11, 5),
  rect(35, 101, 12, 42, 6, 'quads'),
  rect(53, 101, 12, 42, 6, 'quads'),
  rect(47.5, 102, 5, 26, 2.5, 'adductors'),
  rect(37, 148, 9, 36, 4.5),
  rect(54, 148, 9, 36, 4.5),
];

const BACK: Shape[] = [
  rect(42, 27, 16, 9, 4, 'neck'),
  ell(31, 42, 9, 7, 'shoulders'),
  ell(69, 42, 9, 7, 'shoulders'),
  rect(36, 37, 28, 31, 7, 'back'),
  rect(40, 70, 20, 17, 5, 'core'),
  rect(19, 49, 9, 24, 4.5, 'arms'),
  rect(72, 49, 9, 24, 4.5, 'arms'),
  rect(15, 75, 8, 25, 4, 'forearms'),
  rect(77, 75, 8, 25, 4, 'forearms'),
  ell(43, 96, 8, 8.5, 'glutes'),
  ell(57, 96, 8, 8.5, 'glutes'),
  rect(35, 106, 12, 38, 6, 'hamstrings'),
  rect(53, 106, 12, 38, 6, 'hamstrings'),
  rect(37, 148, 9, 34, 4.5, 'calves'),
  rect(54, 148, 9, 34, 4.5, 'calves'),
];

function Figure({ shapes, load, max, title }: { shapes: Shape[]; load: Partial<Record<MuscleGroup, number>>; max: number; title: string }) {
  const fillFor = (m?: MuscleGroup) => (m ? rampColor(load[m] ?? 0, max) : chart.empty);
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Svg width={110} height={210} viewBox="0 0 100 200">
        <Circle cx={50} cy={15} r={11} fill={chart.empty} />
        {shapes.map((s, i) =>
          s.kind === 'rect' ? (
            <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} fill={fillFor(s.muscle)} stroke={colors.surface} strokeWidth={1.5} />
          ) : (
            <Ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={fillFor(s.muscle)} stroke={colors.surface} strokeWidth={1.5} />
          ),
        )}
      </Svg>
      <Text style={styles.caption}>{title}</Text>
    </View>
  );
}

/** Карта нагрузки на мышечные группы: спереди и сзади, одна шкала «мало → много». */
export function BodyMap({ load }: { load: Partial<Record<MuscleGroup, number>> }) {
  const max = Math.max(0, ...Object.values(load).map((v) => v ?? 0));
  const top = (Object.entries(load) as [MuscleGroup, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m]) => muscleLabels[m].toLowerCase());
  return (
    <View
      style={{ gap: 10 }}
      accessible
      accessibilityLabel={top.length ? `Больше всего нагрузки: ${top.join(', ')}` : 'Нагрузки пока нет'}
    >
      <View style={styles.figures}>
        <Figure shapes={FRONT} load={load} max={max} title="Спереди" />
        <Figure shapes={BACK} load={load} max={max} title="Сзади" />
      </View>
      <View style={styles.scale}>
        <Text style={styles.caption}>Меньше</Text>
        <View style={[styles.swatch, { backgroundColor: chart.empty }]} />
        {chart.ramp.map((c) => (
          <View key={c} style={[styles.swatch, { backgroundColor: c }]} />
        ))}
        <Text style={styles.caption}>Больше</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  figures: { flexDirection: 'row', justifyContent: 'space-around' },
  caption: { color: colors.textDim, fontSize: 12 },
  scale: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  swatch: { width: 16, height: 10, borderRadius: 2 },
});
