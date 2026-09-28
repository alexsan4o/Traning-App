import type { Category, MuscleGroup, Session } from '../types';
import { addDays, dayKey, startOfWeek } from './date';

export interface SessionTotals {
  sets: number;
  reps: number;
  volumeKg: number;
  workSec: number;
}

export function sessionTotals(s: Session): SessionTotals {
  let sets = 0;
  let reps = 0;
  let volumeKg = 0;
  let workSec = 0;
  for (const ex of s.exercises) {
    for (const set of ex.sets) {
      sets += 1;
      reps += set.reps ?? 0;
      volumeKg += (set.reps ?? 0) * (set.weightKg ?? 0);
      workSec += set.durationSec ?? 0;
    }
  }
  return { sets, reps, volumeKg: Math.round(volumeKg), workSec };
}

export function sessionsByDay(sessions: Session[]): Map<string, Session[]> {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = dayKey(s.finishedAt);
    const list = map.get(key);
    if (list) list.push(s);
    else map.set(key, [s]);
  }
  return map;
}

/** Серия дней подряд с тренировкой; если сегодня ещё не тренировались, серия считается от вчера. */
export function dayStreak(sessions: Session[], now = new Date()): number {
  const days = new Set(sessions.map((s) => dayKey(s.finishedAt)));
  let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(dayKey(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export interface WeekStat {
  weekStart: Date;
  count: number;
  minutes: number;
  volumeKg: number;
}

export function weeklyStats(sessions: Session[], weeks = 8, now = new Date()): WeekStat[] {
  const current = startOfWeek(now);
  const result: WeekStat[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    result.push({ weekStart: addDays(current, -7 * i), count: 0, minutes: 0, volumeKg: 0 });
  }
  const first = result[0].weekStart.getTime();
  for (const s of sessions) {
    const t = new Date(s.finishedAt).getTime();
    if (t < first) continue;
    // round() сглаживает сдвиг на час при переходе на летнее/зимнее время.
    const idx = Math.round((startOfWeek(new Date(t)).getTime() - first) / (7 * 86400000));
    const w = result[idx];
    if (!w) continue;
    w.count += 1;
    w.minutes += Math.round(s.durationSec / 60);
    w.volumeKg += sessionTotals(s).volumeKg;
  }
  return result;
}

/** Недели подряд (включая текущую, если цель уже выполнена), в которых выполнена недельная цель. */
export function weekStreak(sessions: Session[], target: number, now = new Date()): number {
  const stats = weeklyStats(sessions, 52, now);
  let streak = 0;
  for (let i = stats.length - 1; i >= 0; i--) {
    const isCurrent = i === stats.length - 1;
    if (stats[i].count >= target) streak += 1;
    else if (!isCurrent) break;
  }
  return streak;
}

/** Нагрузка по мышцам: выполненные подходы (основная мышца — 1, остальные — 0.5). */
export function muscleLoad(sessions: Session[], sinceDays = 28, now = new Date()): Partial<Record<MuscleGroup, number>> {
  const since = now.getTime() - sinceDays * 86400000;
  const load: Partial<Record<MuscleGroup, number>> = {};
  for (const s of sessions) {
    if (new Date(s.finishedAt).getTime() < since) continue;
    for (const ex of s.exercises) {
      const done = ex.sets.length;
      if (!done) continue;
      ex.muscles.forEach((m, i) => {
        load[m] = (load[m] ?? 0) + done * (i === 0 ? 1 : 0.5);
      });
    }
  }
  return load;
}

export function categoryLoad(sessions: Session[], sinceDays = 28, now = new Date()): Partial<Record<Category, number>> {
  const since = now.getTime() - sinceDays * 86400000;
  const load: Partial<Record<Category, number>> = {};
  for (const s of sessions) {
    if (new Date(s.finishedAt).getTime() < since) continue;
    for (const ex of s.exercises) {
      if (ex.sets.length) load[ex.category] = (load[ex.category] ?? 0) + ex.sets.length;
    }
  }
  return load;
}

export interface PersonalRecord {
  exerciseId: string;
  name: string;
  kind: 'reps' | 'time';
  maxWeightKg: number;
  maxReps: number;
  maxDurationSec: number;
  lastDate: string;
  sessions: number;
}

export function personalRecords(sessions: Session[]): PersonalRecord[] {
  const map = new Map<string, PersonalRecord>();
  for (const s of sessions) {
    for (const ex of s.exercises) {
      if (!ex.sets.length) continue;
      const rec =
        map.get(ex.exerciseId) ??
        ({
          exerciseId: ex.exerciseId,
          name: ex.name,
          kind: ex.kind,
          maxWeightKg: 0,
          maxReps: 0,
          maxDurationSec: 0,
          lastDate: s.finishedAt,
          sessions: 0,
        } satisfies PersonalRecord);
      rec.sessions += 1;
      if (s.finishedAt > rec.lastDate) rec.lastDate = s.finishedAt;
      for (const set of ex.sets) {
        rec.maxWeightKg = Math.max(rec.maxWeightKg, set.weightKg ?? 0);
        rec.maxReps = Math.max(rec.maxReps, set.reps ?? 0);
        rec.maxDurationSec = Math.max(rec.maxDurationSec, set.durationSec ?? 0);
      }
      map.set(ex.exerciseId, rec);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
}

export interface ExercisePoint {
  date: string;
  /** Главный показатель: вес (если есть), иначе повторы или секунды за лучший подход. */
  value: number;
  unit: 'кг' | 'повт.' | 'с';
}

export function exerciseProgress(sessions: Session[], exerciseId: string): ExercisePoint[] {
  const points: ExercisePoint[] = [];
  for (const s of [...sessions].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt))) {
    const ex = s.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex?.sets.length) continue;
    const maxWeight = Math.max(...ex.sets.map((x) => x.weightKg ?? 0));
    if (maxWeight > 0) points.push({ date: s.finishedAt, value: maxWeight, unit: 'кг' });
    else if (ex.kind === 'time') points.push({ date: s.finishedAt, value: Math.max(...ex.sets.map((x) => x.durationSec ?? 0)), unit: 'с' });
    else points.push({ date: s.finishedAt, value: Math.max(...ex.sets.map((x) => x.reps ?? 0)), unit: 'повт.' });
  }
  return points;
}

/** Минуты тренировок по дням за последние N недель — для тепловой карты активности. */
export function activityHeatmap(sessions: Session[], weeks = 17, now = new Date()): { key: string; date: Date; minutes: number }[][] {
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    const k = dayKey(s.finishedAt);
    byDay.set(k, (byDay.get(k) ?? 0) + Math.round(s.durationSec / 60));
  }
  const start = addDays(startOfWeek(now), -7 * (weeks - 1));
  const columns: { key: string; date: Date; minutes: number }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      const key = dayKey(date);
      col.push({ key, date, minutes: byDay.get(key) ?? 0 });
    }
    columns.push(col);
  }
  return columns;
}
