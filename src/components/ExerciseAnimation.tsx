import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { boundsOf, buildScene, camera, poseAt, solve, type Prim } from '../lib/figure/engine';
import { animationFor, type AnimatedExercise } from '../lib/figure/mapping';
import { colors, figure, radius } from '../theme';

const FRAME_MS = 33;

/** Часы анимации: фаза цикла 0…1, ~30 кадров в секунду, пауза сохраняет положение. */
function usePhase(cycle: number, running: boolean): number {
  const [phase, setPhase] = useState(0);
  const acc = useRef(0);
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = 0;
    let lastPaint = 0;
    const tick = (now: number) => {
      if (last) acc.current += (now - last) / 1000;
      last = now;
      if (now - lastPaint >= FRAME_MS) {
        lastPaint = now;
        setPhase((acc.current / cycle) % 1);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cycle, running]);
  return phase;
}

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => alive && setReduce(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return reduce;
}

function renderPrim(p: Prim, i: number) {
  if (p.kind === 'line') {
    return (
      <Line key={i} x1={p.a[0]} y1={p.a[1]} x2={p.b[0]} y2={p.b[1]} stroke={p.color} strokeWidth={p.w} strokeLinecap="round" opacity={p.opacity} />
    );
  }
  if (p.kind === 'circle') {
    return <Circle key={i} cx={p.c[0]} cy={p.c[1]} r={p.r} fill={p.color} stroke={p.stroke} strokeWidth={p.sw} opacity={p.opacity} />;
  }
  const d = p.pts.map((q, j) => `${j ? 'L' : 'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ') + (p.closed ? ' Z' : '');
  return (
    <Path
      key={i}
      d={d}
      fill={p.color === 'transparent' ? 'none' : p.color}
      stroke={p.stroke}
      strokeWidth={p.sw}
      strokeLinejoin="round"
      strokeLinecap="round"
      opacity={p.opacity}
    />
  );
}

/**
 * Анимированный манекен, выполняющий упражнение: рабочие мышцы подсвечены,
 * в руках — нужный снаряд. Касание ставит анимацию на паузу.
 */
export function ExerciseAnimation({
  exercise,
  height = 200,
  paused = false,
  showHint = true,
  style,
}: {
  exercise: AnimatedExercise;
  height?: number;
  paused?: boolean;
  showHint?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  // Анимация зависит только от полей упражнения, а не от ссылки на объект.
  const { exerciseId, id, name, category } = exercise;
  const musclesKey = exercise.muscles.join(',');
  const { anim, highlight } = useMemo(
    () => animationFor({ exerciseId, id, name, category, muscles: musclesKey ? (musclesKey.split(',') as AnimatedExercise['muscles']) : [] }),
    [exerciseId, id, name, category, musclesKey],
  );
  const cam = useMemo(() => camera(anim.cam ?? 62), [anim]);
  const [userPaused, setUserPaused] = useState(false);
  const reduceMotion = useReduceMotion();
  const running = !paused && !userPaused && !reduceMotion;
  const phase = usePhase(anim.cycle, running);

  // Область просмотра — по всем кадрам цикла, чтобы фигура не «прыгала».
  const viewBox = useMemo(() => {
    const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (let i = 0; i < 24; i++) boundsOf(buildScene(solve(poseAt(anim, i / 24)), anim, cam, highlight, figure), b);
    const pad = 10;
    return { x: b.x0 - pad, y: b.y0 - pad, w: b.x1 - b.x0 + pad * 2, h: b.y1 - b.y0 + pad * 2 };
  }, [anim, cam, highlight]);

  const prims = useMemo(
    () => buildScene(solve(poseAt(anim, reduceMotion ? 0.3 : phase)), anim, cam, highlight, figure),
    [anim, cam, highlight, phase, reduceMotion],
  );

  return (
    <Pressable
      onPress={() => setUserPaused((v) => !v)}
      style={[styles.stage, { height }, style]}
      accessibilityRole="imagebutton"
      accessibilityLabel={`Анимация упражнения ${exercise.name}. ${userPaused ? 'На паузе, коснитесь, чтобы продолжить' : 'Коснитесь, чтобы поставить на паузу'}`}
    >
      <Svg width="100%" height="100%" viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`} preserveAspectRatio="xMidYMid meet">
        {prims.map(renderPrim)}
      </Svg>
      {showHint && userPaused ? (
        <View style={styles.badge} pointerEvents="none">
          <Ionicons name="play" size={12} color={colors.text} />
          <Text style={styles.badgeText}>пауза</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    right: 8,
    top: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
  },
  badgeText: { color: colors.text, fontSize: 11, fontWeight: '600' },
});
