import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { chart, colors } from '../theme';

// В браузере SVG-текст по умолчанию рисуется шрифтом с засечками — задаём системный.
const SVG_FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, Roboto, sans-serif' : undefined;

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(max));
  const n = max / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * mag;
}

const fmt = (v: number) => (v >= 10000 ? `${Math.round(v / 1000)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`);

/** Столбец со скруглённым верхом 4px и прямым основанием. */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  return [width, (e) => setWidth(Math.round(e.nativeEvent.layout.width))];
}

export interface ColumnDatum {
  label: string;
  value: number;
}

/** Столбчатая диаграмма одного ряда. Касание столбца показывает значение. */
export function ColumnChart({
  data,
  unit,
  height = 170,
  accessibilityLabel,
}: {
  data: ColumnDatum[];
  unit: string;
  height?: number;
  accessibilityLabel: string;
}) {
  const [width, onLayout] = useWidth();
  const [selected, setSelected] = useState(data.length - 1);
  const axisW = 34;
  const bottom = 22;
  const top = 18;
  const plotW = Math.max(0, width - axisW);
  const plotH = height - bottom - top;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const slot = data.length ? plotW / data.length : 0;
  const barW = Math.min(24, slot * 0.6);
  const sel = data[selected];

  return (
    <View onLayout={onLayout} accessible accessibilityLabel={accessibilityLabel}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {[0, 0.5, 1].map((t) => {
            const y = top + plotH * (1 - t);
            return (
              <G key={t}>
                <Line x1={axisW} x2={width} y1={y} y2={y} stroke={chart.grid} strokeWidth={1} />
                <SvgText fontFamily={SVG_FONT} x={axisW - 6} y={y + 4} fontSize={10} fill={colors.textFaint} textAnchor="end">
                  {fmt(max * t)}
                </SvgText>
              </G>
            );
          })}
          {data.map((d, i) => {
            const h = (d.value / max) * plotH;
            const x = axisW + slot * i + (slot - barW) / 2;
            const isSel = i === selected;
            return (
              <G key={`${d.label}-${i}`}>
                {h > 0 ? (
                  <Path d={columnPath(x, top + plotH - h, barW, h)} fill={chart.series} opacity={isSel ? 1 : 0.55} />
                ) : null}
                <SvgText
                  fontFamily={SVG_FONT}
                  x={x + barW / 2}
                  y={height - 6}
                  fontSize={10}
                  fill={isSel ? colors.text : colors.textFaint}
                  textAnchor="middle"
                >
                  {d.label}
                </SvgText>
                {isSel && d.value > 0 ? (
                  <SvgText fontFamily={SVG_FONT} x={x + barW / 2} y={top + plotH - h - 5} fontSize={11} fontWeight="700" fill={colors.text} textAnchor="middle">
                    {fmt(d.value)}
                  </SvgText>
                ) : null}
                <Rect
                  x={axisW + slot * i}
                  y={0}
                  width={slot}
                  height={height}
                  fill="transparent"
                  onPress={() => setSelected(i)}
                />
              </G>
            );
          })}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
      {sel ? (
        <Text style={styles.caption}>
          {sel.label}: <Text style={styles.captionValue}>{fmt(sel.value)} {unit}</Text>
        </Text>
      ) : null}
    </View>
  );
}

export interface LinePoint {
  label: string;
  value: number;
}

/** Линия прогресса одного показателя. Касание выбирает ближайшую точку. */
export function LineChart({
  points,
  unit,
  height = 170,
  accessibilityLabel,
}: {
  points: LinePoint[];
  unit: string;
  height?: number;
  accessibilityLabel: string;
}) {
  const [width, onLayout] = useWidth();
  const [selected, setSelected] = useState<number | null>(null);
  const axisW = 34;
  const top = 20;
  const bottom = 22;
  const right = 14;
  const plotW = Math.max(0, width - axisW - right);
  const plotH = height - top - bottom;
  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const min = rawMin === rawMax ? Math.max(0, rawMin - 1) : rawMin - (rawMax - rawMin) * 0.1;
  const max = rawMin === rawMax ? rawMax + 1 : rawMax + (rawMax - rawMin) * 0.1;
  const xs = (i: number) => axisW + (points.length === 1 ? plotW / 2 : (plotW * i) / (points.length - 1));
  const ys = (v: number) => top + plotH * (1 - (v - min) / (max - min));
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs(i)},${ys(p.value)}`).join(' ');
  const area = points.length > 1 ? `${d} L${xs(points.length - 1)},${top + plotH} L${xs(0)},${top + plotH} Z` : '';
  const active = selected ?? points.length - 1;
  const last = points[active];

  return (
    <View onLayout={onLayout} accessible accessibilityLabel={accessibilityLabel}>
      {width > 0 && points.length ? (
        <Svg width={width} height={height}>
          {[0, 0.5, 1].map((t) => {
            const v = min + (max - min) * t;
            const y = ys(v);
            return (
              <G key={t}>
                <Line x1={axisW} x2={width - right} y1={y} y2={y} stroke={chart.grid} strokeWidth={1} />
                <SvgText fontFamily={SVG_FONT} x={axisW - 6} y={y + 4} fontSize={10} fill={colors.textFaint} textAnchor="end">
                  {fmt(v)}
                </SvgText>
              </G>
            );
          })}
          {area ? <Path d={area} fill={chart.series} opacity={0.1} /> : null}
          <Path d={d} stroke={chart.series} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {selected !== null ? (
            <Line x1={xs(active)} x2={xs(active)} y1={top} y2={top + plotH} stroke={colors.textFaint} strokeWidth={1} />
          ) : null}
          <Circle cx={xs(active)} cy={ys(last.value)} r={6.5} fill={colors.surface} />
          <Circle cx={xs(active)} cy={ys(last.value)} r={4.5} fill={chart.series} />
          <SvgText
            fontFamily={SVG_FONT}
            x={Math.min(width - right, Math.max(axisW + 12, xs(active)))}
            y={ys(last.value) - 10}
            fontSize={11}
            fontWeight="700"
            fill={colors.text}
            textAnchor="middle"
          >
            {fmt(last.value)}
          </SvgText>
          <SvgText fontFamily={SVG_FONT} x={axisW} y={height - 6} fontSize={10} fill={colors.textFaint}>
            {points[0].label}
          </SvgText>
          {points.length > 1 ? (
            <SvgText fontFamily={SVG_FONT} x={width - right} y={height - 6} fontSize={10} fill={colors.textFaint} textAnchor="end">
              {points[points.length - 1].label}
            </SvgText>
          ) : null}
          {points.map((p, i) => {
            const slot = points.length > 1 ? plotW / (points.length - 1) : plotW;
            return (
              <Rect
                key={`${p.label}-${i}`}
                x={xs(i) - slot / 2}
                y={0}
                width={Math.max(24, slot)}
                height={height}
                fill="transparent"
                onPress={() => setSelected(i)}
              />
            );
          })}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
      {last ? (
        <Text style={styles.caption}>
          {last.label}: <Text style={styles.captionValue}>{fmt(last.value)} {unit}</Text>
        </Text>
      ) : null}
    </View>
  );
}

/** Кольцевой индикатор (таймер, недельная цель). Дорожка — тот же оттенок, приглушённый. */
export function ProgressRing({
  size,
  stroke = 10,
  progress,
  color = colors.primary,
  children,
}: {
  size: number;
  stroke?: number;
  progress: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeOpacity={0.18} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - p)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

/** Горизонтальные полосы с подписями — одновременно график и «табличное» представление. */
export function BarList({
  items,
  unit,
  color = chart.series,
}: {
  items: { key: string; label: string; value: number; color?: string }[];
  unit?: string;
  color?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 0);
  return (
    <View style={{ gap: 10 }}>
      {items.map((item) => (
        <View key={item.key} style={{ gap: 4 }}>
          <View style={styles.barListRow}>
            <View style={styles.barListLabel}>
              {item.color ? <View style={[styles.swatch, { backgroundColor: item.color }]} /> : null}
              <Text style={styles.barListText} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
            <Text style={styles.barListValue}>
              {Math.round(item.value * 10) / 10}
              {unit ? ` ${unit}` : ''}
            </Text>
          </View>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${max ? Math.max(2, (item.value / max) * 100) : 0}%`, backgroundColor: item.color ?? color },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View style={styles.legend}>
      {items.map((i) => (
        <View key={i.label} style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: i.color }]} />
          <Text style={styles.legendText}>{i.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { color: colors.textDim, fontSize: 13, marginTop: 4 },
  captionValue: { color: colors.text, fontWeight: '700' },
  barListRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  barListLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  barListText: { color: colors.text, fontSize: 14 },
  barListValue: { color: colors.textDim, fontSize: 13, fontVariant: ['tabular-nums'] },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: chart.empty, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { color: colors.textDim, fontSize: 12 },
});
