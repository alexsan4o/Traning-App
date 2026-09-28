import { levelLabels } from '../data/labels';
import { phaseOf } from '../theme';
import type { Exercise, Level, Workout, WorkoutExercise } from '../types';
import { uid } from './id';

/** Средняя длительность одного повтора, с. */
export const SEC_PER_REP = 3;

export function workSeconds(item: Pick<WorkoutExercise, 'kind' | 'reps' | 'durationSec' | 'perSide'>): number {
  const base = item.kind === 'time' ? item.durationSec ?? 30 : (item.reps ?? 10) * SEC_PER_REP;
  return item.perSide ? base * 2 : base;
}

export interface Segment {
  uid: string;
  name: string;
  category: WorkoutExercise['category'];
  workSec: number;
  restSec: number;
}

/** Разбивка тренировки на отрезки работы и отдыха (для визуализации и оценки времени). */
export function workoutSegments(workout: Pick<Workout, 'exercises'>): Segment[] {
  return workout.exercises.map((item, i) => {
    const isLast = i === workout.exercises.length - 1;
    const restCount = isLast ? Math.max(0, item.sets - 1) : item.sets;
    return {
      uid: item.uid,
      name: item.name,
      category: item.category,
      workSec: workSeconds(item) * item.sets,
      restSec: item.restSec * restCount,
    };
  });
}

/** Оценка длительности в минутах (включая 20 с на переход между упражнениями). */
export function estimateMinutes(workout: Pick<Workout, 'exercises'>): number {
  const segments = workoutSegments(workout);
  const total = segments.reduce((acc, s) => acc + s.workSec + s.restSec, 0) + workout.exercises.length * 20;
  return Math.max(1, Math.round(total / 60));
}

export function totalSets(workout: Pick<Workout, 'exercises'>): number {
  return workout.exercises.reduce((acc, e) => acc + e.sets, 0);
}

export function fromExercise(
  ex: Exercise,
  opts: Partial<Pick<WorkoutExercise, 'sets' | 'reps' | 'durationSec' | 'restSec' | 'weightKg'>> = {},
): WorkoutExercise {
  return {
    uid: uid('we_'),
    exerciseId: ex.id,
    name: ex.name,
    category: ex.category,
    kind: ex.kind,
    muscles: ex.muscles,
    perSide: ex.perSide,
    tips: ex.tips,
    sets: opts.sets ?? 3,
    reps: ex.kind === 'reps' ? opts.reps ?? ex.defaultReps ?? 10 : undefined,
    durationSec: ex.kind === 'time' ? opts.durationSec ?? ex.defaultDurationSec ?? 30 : undefined,
    restSec: opts.restSec ?? 60,
    weightKg: opts.weightKg,
  };
}

export function describeTarget(item: Pick<WorkoutExercise, 'kind' | 'reps' | 'durationSec' | 'weightKg' | 'perSide'>): string {
  const side = item.perSide ? ' на сторону' : '';
  const main = item.kind === 'time' ? formatSeconds(item.durationSec ?? 30) : `${item.reps ?? 10} повт.`;
  const weight = item.weightKg ? ` · ${item.weightKg} кг` : '';
  return `${main}${side}${weight}`;
}

function formatSeconds(sec: number): string {
  if (sec < 60) return `${sec} с`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} мин ${s} с` : `${m} мин`;
}

/** Копия тренировки с новыми идентификаторами (дублирование, импорт). */
export function cloneWorkout(w: Workout, patch: Partial<Workout> = {}): Workout {
  const now = new Date().toISOString();
  return {
    ...w,
    id: uid('w_'),
    exercises: w.exercises.map((e) => ({ ...e, uid: uid('we_') })),
    createdAt: now,
    updatedAt: now,
    ...patch,
  };
}

const LEVEL_ORDER: Level[] = ['beginner', 'intermediate', 'advanced'];

/**
 * Копия программы под другой уровень: на каждый шаг уровня ±1 подход и ±15% повторов (±20% времени).
 * Для более низкого уровня добавляется отдых. Разминка и заминка не меняются.
 */
export function adaptToLevel(w: Workout, target: Level): Workout {
  const d = LEVEL_ORDER.indexOf(target) - LEVEL_ORDER.indexOf(w.level);
  if (d === 0) return w;
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(v)));
  const exercises = w.exercises.map((e) => {
    if (phaseOf(e.category) === 'prep') return e;
    const longCardio = e.kind === 'time' && (e.durationSec ?? 0) >= 300;
    return {
      ...e,
      sets: longCardio ? e.sets : clamp(e.sets + d, 1, 8),
      reps: e.kind === 'reps' && e.reps && e.reps > 1 ? clamp(e.reps * (1 + 0.15 * d), 1, 100) : e.reps,
      durationSec:
        e.kind === 'time' && e.durationSec
          ? longCardio
            ? clamp((e.durationSec * (1 + 0.15 * d)) / 60, 5, 120) * 60
            : clamp((e.durationSec * (1 + 0.2 * d)) / 5, 1, 720) * 5
          : e.durationSec,
      restSec: d < 0 ? e.restSec + 15 * -d : e.restSec,
    };
  });
  return cloneWorkout(
    { ...w, exercises },
    {
      level: target,
      source: 'custom',
      title: `${w.title} · ${levelLabels[target]}`,
      description: `${w.description} Адаптировано под уровень «${levelLabels[target]}».`.trim(),
    },
  );
}
