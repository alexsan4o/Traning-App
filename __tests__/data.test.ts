import catalogFile from '../catalog/workouts.json';
import { BUILTIN_EXERCISES, getBuiltinExercise } from '../src/data/exercises';
import { BUILTIN_WORKOUTS } from '../src/data/programs';
import { SPORT_LIST } from '../src/data/sports';
import { normalizeWorkout } from '../src/lib/catalog';

describe('встроенная библиотека', () => {
  it('у упражнений уникальные id и есть подсказки', () => {
    const ids = BUILTIN_EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of BUILTIN_EXERCISES) {
      expect(e.tips.length).toBeGreaterThan(0);
      expect(e.muscles.length).toBeGreaterThan(0);
      expect(e.sports.length).toBeGreaterThan(0);
      if (e.kind === 'reps') expect(e.defaultReps).toBeGreaterThan(0);
      else expect(e.defaultDurationSec).toBeGreaterThan(0);
    }
  });

  it('программы ссылаются на существующие упражнения с корректной дозировкой', () => {
    const ids = BUILTIN_WORKOUTS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const w of BUILTIN_WORKOUTS) {
      expect(w.exercises.length).toBeGreaterThanOrEqual(5);
      for (const item of w.exercises) {
        expect(getBuiltinExercise(item.exerciseId)).toBeDefined();
        expect(item.sets).toBeGreaterThan(0);
        if (item.kind === 'reps') expect(item.reps).toBeGreaterThan(0);
        else expect(item.durationSec).toBeGreaterThan(0);
      }
    }
  });

  it('для каждого вида спорта есть программы всех уровней', () => {
    for (const sport of SPORT_LIST) {
      const own = BUILTIN_WORKOUTS.filter((w) => w.sport === sport.id);
      expect([sport.id, own.length >= 4]).toEqual([sport.id, true]);
      for (const level of ['beginner', 'intermediate', 'advanced']) {
        expect([sport.id, level, own.some((w) => w.level === level)]).toEqual([sport.id, level, true]);
      }
    }
  });

  it('в библиотеке не меньше 200 упражнений, и у каждого вида спорта есть свои', () => {
    expect(BUILTIN_EXERCISES.length).toBeGreaterThanOrEqual(200);
    for (const sport of SPORT_LIST) {
      // «Свои» — упражнения, отмеченные не более чем для трёх видов спорта.
      const specific = BUILTIN_EXERCISES.filter((e) => e.sports.includes(sport.id) && e.sports.length <= 3);
      expect([sport.id, specific.length >= 2]).toEqual([sport.id, true]);
    }
  });
});

describe('онлайн-каталог catalog/workouts.json', () => {
  const raw = catalogFile.workouts as Record<string, unknown>[];

  it('все тренировки проходят проверку формата', () => {
    expect(raw.length).toBeGreaterThan(0);
    for (const w of raw) expect(normalizeWorkout(w, 'online', 'online_')).not.toBeNull();
  });

  it('ссылки на библиотеку существуют, а объём задан в правильных единицах', () => {
    for (const w of raw) {
      for (const e of w.exercises as Record<string, unknown>[]) {
        if (!e.exerciseId) {
          expect(e.name).toBeTruthy();
          continue;
        }
        const lib = getBuiltinExercise(e.exerciseId as string);
        expect(lib).toBeDefined();
        if (lib!.kind === 'reps') expect(e.reps).toBeGreaterThan(0);
        else expect(e.durationSec).toBeGreaterThan(0);
      }
    }
  });

  it('не пересекается по id со встроенными программами', () => {
    const builtin = new Set(BUILTIN_WORKOUTS.map((w) => w.id.replace('builtin_', '')));
    for (const w of raw) expect(builtin.has(w.id as string)).toBe(false);
  });
});
