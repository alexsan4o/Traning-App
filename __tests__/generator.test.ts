import { getBuiltinExercise } from '../src/data/exercises';
import { SPORT_LIST } from '../src/data/sports';
import { ALL_GOALS } from '../src/data/labels';
import { effectiveDuration, generateWorkout, type GenerateRequest } from '../src/lib/generator';
import { estimateMinutes } from '../src/lib/workout';
import type { Equipment } from '../src/types';

const base: GenerateRequest = {
  sport: 'football',
  goal: 'strength',
  level: 'intermediate',
  durationMin: 45,
  equipment: [],
  seed: 42,
};

const ids = (req: GenerateRequest) => generateWorkout(req).exercises.map((e) => e.exerciseId);

describe('офлайн-генератор', () => {
  it('детерминирован при одинаковом seed', () => {
    expect(ids(base)).toEqual(ids(base));
    expect(ids({ ...base, seed: 7 })).not.toEqual(ids(base));
  });

  it('использует только доступное оборудование', () => {
    const equipment: Equipment[] = ['dumbbells', 'bands'];
    for (const sport of SPORT_LIST) {
      for (const goal of ALL_GOALS) {
        const w = generateWorkout({ ...base, sport: sport.id, goal, equipment, seed: 3 });
        for (const item of w.exercises) {
          const ex = getBuiltinExercise(item.exerciseId)!;
          expect(ex.equipment.every((e) => equipment.includes(e))).toBe(true);
        }
      }
    }
  });

  it('начинается с разминки, заканчивается заминкой и не повторяет упражнения', () => {
    for (const sport of SPORT_LIST) {
      const w = generateWorkout({ ...base, sport: sport.id, seed: 11 });
      expect(['warmup', 'mobility']).toContain(w.exercises[0].category);
      expect(w.exercises[w.exercises.length - 1].category).toBe('cooldown');
      const list = w.exercises.map((e) => e.exerciseId);
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it('укладывается в заданное время (±30%) для всех видов спорта, целей и наборов оборудования', () => {
    const kits: Equipment[][] = [[], ['dumbbells', 'bands', 'bar', 'box', 'bench'], ['barbell', 'cones', 'ball', 'medball', 'kettlebell']];
    for (const sport of SPORT_LIST) {
      for (const equipment of kits) {
        for (const durationMin of [20, 30, 45, 60, 90]) {
          for (const goal of ALL_GOALS) {
            const w = generateWorkout({ ...base, sport: sport.id, goal, durationMin, equipment, seed: 5 });
            const target = effectiveDuration(goal, durationMin);
            const est = estimateMinutes(w);
            const label = `${sport.id}/${goal}/${durationMin}/${equipment.join('+') || 'none'}: ${est} из ${target}`;
            expect([label, est >= target * 0.7]).toEqual([label, true]);
            expect([label, est <= target * 1.3]).toEqual([label, true]);
          }
        }
      }
    }
  });

  it('сокращает слишком длинные тренировки для узких целей и объясняет это', () => {
    const w = generateWorkout({ ...base, goal: 'reaction', durationMin: 90 });
    expect(effectiveDuration('reaction', 90)).toBe(40);
    expect(w.description).toContain('сокращена');
  });

  it('для картинга на силу включает упражнение на шею', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const w = generateWorkout({ ...base, sport: 'karting', goal: 'strength', seed });
      expect(w.exercises.some((e) => e.muscles.includes('neck') && e.category !== 'warmup')).toBe(true);
    }
  });

  it('подбирает дозировку по уровню', () => {
    const find = (level: GenerateRequest['level']) =>
      generateWorkout({ ...base, level, goal: 'strength', seed: 9 }).exercises.find((e) => e.category === 'strength')!;
    expect(find('advanced').sets).toBeGreaterThanOrEqual(find('beginner').sets);
    expect(find('advanced').restSec).toBeGreaterThan(find('beginner').restSec);
  });
});
