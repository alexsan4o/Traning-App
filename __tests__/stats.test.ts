import { dayKey, formatClock, monthMatrix, plural } from '../src/lib/date';
import {
  activityHeatmap,
  dayStreak,
  exerciseProgress,
  muscleLoad,
  personalRecords,
  sessionTotals,
  weeklyStats,
  weekStreak,
} from '../src/lib/stats';
import type { Session } from '../src/types';

const NOW = new Date(2026, 8, 28, 18, 0); // понедельник, 28 сентября 2026

function session(daysAgo: number, overrides: Partial<Session> = {}): Session {
  const finished = new Date(NOW);
  finished.setDate(finished.getDate() - daysAgo);
  return {
    id: `s${daysAgo}-${Math.random()}`,
    workoutId: 'w1',
    title: 'Тест',
    sport: 'football',
    startedAt: new Date(finished.getTime() - 3600_000).toISOString(),
    finishedAt: finished.toISOString(),
    durationSec: 3600,
    exercises: [
      {
        uid: 'u1',
        exerciseId: 'goblet-squat',
        name: 'Гоблет-присед',
        category: 'strength',
        kind: 'reps',
        muscles: ['quads', 'glutes'],
        targetSets: 3,
        sets: [
          { reps: 10, weightKg: 20, completedAt: finished.toISOString() },
          { reps: 8, weightKg: 22.5, completedAt: finished.toISOString() },
        ],
      },
      {
        uid: 'u2',
        exerciseId: 'plank',
        name: 'Планка',
        category: 'core',
        kind: 'time',
        muscles: ['core'],
        targetSets: 2,
        sets: [{ durationSec: 45, completedAt: finished.toISOString() }],
      },
    ],
    ...overrides,
  };
}

describe('даты', () => {
  it('матрица месяца начинается с понедельника', () => {
    const weeks = monthMatrix(2026, 8); // сентябрь 2026 начинается во вторник
    expect(weeks[0][0]).toBeNull();
    expect(weeks[0][1]?.getDate()).toBe(1);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it('форматирует время и склоняет слова', () => {
    expect(formatClock(75)).toBe('1:15');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(plural(1, 'день', 'дня', 'дней')).toBe('день');
    expect(plural(3, 'день', 'дня', 'дней')).toBe('дня');
    expect(plural(11, 'день', 'дня', 'дней')).toBe('дней');
  });
});

describe('статистика', () => {
  it('считает итоги тренировки', () => {
    const t = sessionTotals(session(0));
    expect(t).toEqual({ sets: 3, reps: 18, volumeKg: 380, workSec: 45 });
  });

  it('считает серию дней, в том числе если сегодня ещё не тренировались', () => {
    expect(dayStreak([session(0), session(1), session(2), session(4)], NOW)).toBe(3);
    expect(dayStreak([session(1), session(2)], NOW)).toBe(2);
    expect(dayStreak([session(3)], NOW)).toBe(0);
  });

  it('группирует по неделям и считает недельную серию', () => {
    const sessions = [session(0), session(7), session(8), session(14), session(15)];
    const weeks = weeklyStats(sessions, 4, NOW);
    // 28.09 — понедельник: 21.09 (7 дней назад) — прошлая неделя, 20.09 (8 дней назад) — позапрошлая.
    expect(weeks.map((w) => w.count)).toEqual([1, 2, 1, 1]);
    expect(weeks[3].minutes).toBe(60);
    expect(weekStreak(sessions, 1, NOW)).toBe(4);
    // Текущая неделя ещё не закончена и не обрывает серию; прошлая (1 из 2) — обрывает.
    expect(weekStreak(sessions, 2, NOW)).toBe(0);
  });

  it('распределяет нагрузку по мышцам', () => {
    const load = muscleLoad([session(1)], 28, NOW);
    expect(load.quads).toBe(2);
    expect(load.glutes).toBe(1);
    expect(load.core).toBe(1);
    expect(muscleLoad([session(40)], 28, NOW).quads).toBeUndefined();
  });

  it('находит рекорды и строит прогресс упражнения', () => {
    const older = session(10, {
      exercises: [{ ...session(10).exercises[0], sets: [{ reps: 12, weightKg: 17.5, completedAt: '' }] }],
    });
    const records = personalRecords([session(0), older]);
    const squat = records.find((r) => r.exerciseId === 'goblet-squat')!;
    expect(squat.maxWeightKg).toBe(22.5);
    expect(squat.maxReps).toBe(12);
    expect(squat.sessions).toBe(2);
    expect(exerciseProgress([session(0), older], 'goblet-squat').map((p) => p.value)).toEqual([17.5, 22.5]);
    expect(exerciseProgress([session(0)], 'plank')).toEqual([{ date: session(0).finishedAt, value: 45, unit: 'с' }]);
  });

  it('строит тепловую карту с сегодняшним днём в последней колонке', () => {
    const cols = activityHeatmap([session(0)], 4, NOW);
    expect(cols).toHaveLength(4);
    const today = cols[3].find((c) => c.key === dayKey(NOW));
    expect(today?.minutes).toBe(60);
  });
});
