import { BUILTIN_EXERCISES, getBuiltinExercise } from '../data/exercises';
import { categoryLabels, equipmentLabels, muscleLabels } from '../data/labels';
import { phaseOf } from '../theme';
import type { Equipment, Exercise, SportId, WorkoutExercise } from '../types';

export interface Alternative {
  exercise: Exercise;
  score: number;
  /** Почему упражнение похоже — показывается пользователю. */
  reasons: string[];
  /** Есть ли у пользователя всё нужное оборудование. */
  available: boolean;
}

type Current = Pick<WorkoutExercise, 'exerciseId' | 'category' | 'kind' | 'muscles'>;

const isLongCardio = (e: Pick<Exercise, 'kind' | 'defaultDurationSec'>) =>
  e.kind === 'time' && (e.defaultDurationSec ?? 0) >= 300;

/**
 * Похожие упражнения для замены: те же мышцы (особенно основная), тот же тип нагрузки и фаза тренировки.
 * Упражнения без нужного оборудования опускаются вниз списка (или исключаются при onlyAvailable).
 */
export function findAlternatives(
  current: Current,
  opts: { equipment?: Equipment[]; sport?: SportId; excludeIds?: string[]; onlyAvailable?: boolean; limit?: number } = {},
): Alternative[] {
  const phase = phaseOf(current.category);
  const original = getBuiltinExercise(current.exerciseId);
  const longCardio = original ? isLongCardio(original) : false;
  const exclude = new Set([current.exerciseId, ...(opts.excludeIds ?? [])]);
  const result: Alternative[] = [];

  for (const ex of BUILTIN_EXERCISES) {
    if (exclude.has(ex.id)) continue;
    if (phaseOf(ex.category) !== phase) continue;
    if (isLongCardio(ex) !== longCardio) continue;

    const shared = ex.muscles.filter((m) => current.muscles.includes(m));
    const samePrimary = ex.muscles[0] === current.muscles[0];
    const sameCategory = ex.category === current.category;
    if (!shared.length && !(sameCategory && phase === 'prep')) continue;

    const available = opts.equipment ? ex.equipment.every((e) => opts.equipment!.includes(e)) : true;
    if (opts.onlyAvailable && !available) continue;

    let score = shared.length * 2 + (samePrimary ? 4 : 0) + (sameCategory ? 3 : 0);
    score += ex.kind === current.kind ? 1 : 0;
    score -= Math.max(0, ex.muscles.length - shared.length) * 0.5;
    if (opts.sport && ex.sports.includes(opts.sport)) score += 0.5;
    if (!available) score -= 3;

    const reasons: string[] = [];
    if (shared.length) reasons.push(`Мышцы: ${shared.map((m) => muscleLabels[m].toLowerCase()).join(', ')}`);
    if (sameCategory) reasons.push(`Тип: ${categoryLabels[ex.category].toLowerCase()}`);
    reasons.push(ex.equipment.length ? ex.equipment.map((e) => equipmentLabels[e]).join(', ') : 'Без инвентаря');

    result.push({ exercise: ex, score, reasons, available });
  }

  return result.sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name)).slice(0, opts.limit ?? 15);
}

/**
 * Замена упражнения в комплексе: подходы, отдых и заметки сохраняются,
 * объём пересчитывается, если новое упражнение другого типа (повторы ↔ время).
 */
export function swapExercise(item: WorkoutExercise, ex: Exercise): WorkoutExercise {
  const sameKind = item.kind === ex.kind;
  const sameEquipment = (getBuiltinExercise(item.exerciseId)?.equipment ?? []).join() === ex.equipment.join();
  return {
    ...item,
    exerciseId: ex.id,
    name: ex.name,
    category: ex.category,
    kind: ex.kind,
    muscles: ex.muscles,
    perSide: ex.perSide,
    tips: ex.tips,
    reps: ex.kind === 'reps' ? (sameKind ? item.reps : ex.defaultReps ?? 10) : undefined,
    durationSec: ex.kind === 'time' ? (sameKind ? item.durationSec : ex.defaultDurationSec ?? 30) : undefined,
    // Вес от другого снаряда не переносим — он почти наверняка не подойдёт.
    weightKg: sameEquipment ? item.weightKg : undefined,
  };
}
