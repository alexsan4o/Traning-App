import { BUILTIN_EXERCISES, getBuiltinExercise } from '../src/data/exercises';
import { ALL_EXPERIENCE, levelFromExperience } from '../src/data/labels';
import { BUILTIN_WORKOUTS } from '../src/data/programs';
import { findAlternatives, swapExercise } from '../src/lib/alternatives';
import { adaptToLevel, fromExercise } from '../src/lib/workout';
import { phaseOf } from '../src/theme';
import type { Goal, Workout } from '../src/types';

const program = (id: string): Workout => {
  const w = BUILTIN_WORKOUTS.find((x) => x.id === `builtin_${id}`);
  if (!w) throw new Error(`нет программы ${id}`);
  return w;
};

describe('уровни по тренировочному стажу', () => {
  it('до года — базовый, 1–3 года — продвинутый, дольше — профи', () => {
    expect(levelFromExperience('lt6m')).toBe('beginner');
    expect(levelFromExperience('6to12m')).toBe('beginner');
    expect(levelFromExperience('1to3y')).toBe('intermediate');
    expect(levelFromExperience('3to5y')).toBe('advanced');
    expect(levelFromExperience('gt5y')).toBe('advanced');
    expect(ALL_EXPERIENCE).toHaveLength(5);
  });

  it('классические программы есть для каждой цели и каждого уровня', () => {
    const fitness = BUILTIN_WORKOUTS.filter((w) => w.sport === 'fitness');
    for (const goal of ['hypertrophy', 'fatloss', 'toning'] as Goal[]) {
      expect(fitness.filter((w) => w.goal === goal).length).toBeGreaterThanOrEqual(3);
    }
    for (const level of ['beginner', 'intermediate', 'advanced'] as const) {
      expect(fitness.some((w) => w.level === level)).toBe(true);
    }
  });
});

describe('адаптация программы под уровень', () => {
  const base = program('fitness-mass-fullbody');

  it('повышение уровня добавляет подходы и повторы, но не трогает разминку', () => {
    const up = adaptToLevel(base, 'advanced');
    expect(up.level).toBe('advanced');
    expect(up.id).not.toBe(base.id);
    expect(up.source).toBe('custom');
    expect(up.title).toContain('Профи');
    base.exercises.forEach((e, i) => {
      const a = up.exercises[i];
      expect(a.exerciseId).toBe(e.exerciseId);
      if (phaseOf(e.category) === 'prep') {
        expect(a.sets).toBe(e.sets);
        expect(a.reps).toBe(e.reps);
        expect(a.durationSec).toBe(e.durationSec);
      } else {
        expect(a.sets).toBeGreaterThanOrEqual(e.sets);
        if (e.kind === 'reps' && (e.reps ?? 0) > 1) expect(a.reps).toBeGreaterThanOrEqual(e.reps!);
      }
    });
  });

  it('понижение уровня снижает объём и добавляет отдых', () => {
    const w = BUILTIN_WORKOUTS.find((x) => x.sport === 'fitness' && x.level === 'advanced')!;
    const down = adaptToLevel(w, 'beginner');
    w.exercises.forEach((e, i) => {
      const a = down.exercises[i];
      if (phaseOf(e.category) === 'prep') return;
      expect(a.sets).toBeLessThanOrEqual(e.sets);
      expect(a.sets).toBeGreaterThanOrEqual(1);
      expect(a.restSec).toBe(e.restSec + 30);
    });
  });

  it('тот же уровень возвращает программу без изменений', () => {
    expect(adaptToLevel(base, base.level)).toBe(base);
  });
});

describe('замена упражнения на похожее', () => {
  it('жим штанги заменяется упражнениями на грудь', () => {
    const bench = fromExercise(getBuiltinExercise('bench-press')!);
    const alts = findAlternatives(bench);
    expect(alts.length).toBeGreaterThan(3);
    expect(alts.map((a) => a.exercise.id)).not.toContain('bench-press');
    for (const a of alts.slice(0, 3)) expect(a.exercise.muscles).toContain('chest');
    // Отсортированы по убыванию сходства.
    for (let i = 1; i < alts.length; i++) expect(alts[i - 1].score).toBeGreaterThanOrEqual(alts[i].score);
  });

  it('упражнения остаются в своей фазе тренировки', () => {
    for (const ex of BUILTIN_EXERCISES) {
      for (const a of findAlternatives(fromExercise(ex))) {
        expect(phaseOf(a.exercise.category)).toBe(phaseOf(ex.category));
      }
    }
  });

  it('фильтр оборудования оставляет только доступные упражнения', () => {
    const bench = fromExercise(getBuiltinExercise('bench-press')!);
    const alts = findAlternatives(bench, { equipment: [], onlyAvailable: true });
    expect(alts.length).toBeGreaterThan(0);
    for (const a of alts) {
      expect(a.available).toBe(true);
      expect(a.exercise.equipment).toHaveLength(0);
    }
    // Без фильтра упражнения со снарядами остаются в списке, но помечены как недоступные.
    const all = findAlternatives(bench, { equipment: [] });
    expect(all.some((a) => !a.available)).toBe(true);
    for (const a of all) expect(a.available).toBe(a.exercise.equipment.length === 0);
  });

  it('исключает упражнения, которые уже есть в комплексе', () => {
    const bench = fromExercise(getBuiltinExercise('bench-press')!);
    const [first] = findAlternatives(bench);
    const next = findAlternatives(bench, { excludeIds: [first.exercise.id] });
    expect(next.map((a) => a.exercise.id)).not.toContain(first.exercise.id);
  });

  it('при замене сохраняются подходы и отдых, объём пересчитывается', () => {
    const item = { ...fromExercise(getBuiltinExercise('bench-press')!), sets: 5, restSec: 120, reps: 6, weightKg: 80 };
    const sameKind = swapExercise(item, getBuiltinExercise('db-bench-press')!);
    expect(sameKind.uid).toBe(item.uid);
    expect(sameKind.exerciseId).toBe('db-bench-press');
    expect(sameKind.sets).toBe(5);
    expect(sameKind.restSec).toBe(120);
    expect(sameKind.reps).toBe(6);
    // Вес от штанги к гантелям не переносится.
    expect(sameKind.weightKg).toBeUndefined();

    const plank = getBuiltinExercise(BUILTIN_EXERCISES.find((e) => e.kind === 'time' && e.category === 'core')!.id)!;
    const toTime = swapExercise(item, plank);
    expect(toTime.kind).toBe('time');
    expect(toTime.reps).toBeUndefined();
    expect(toTime.durationSec).toBe(plank.defaultDurationSec);
    expect(toTime.sets).toBe(5);
  });
});
