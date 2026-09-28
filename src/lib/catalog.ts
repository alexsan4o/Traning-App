import { z } from 'zod';

import { getBuiltinExercise } from '../data/exercises';
import { ALL_CATEGORIES, ALL_GOALS, ALL_LEVELS, ALL_MUSCLES } from '../data/labels';
import { SPORTS } from '../data/sports';
import type { AppData } from '../store/useAppStore';
import type { Category, Goal, Level, MuscleGroup, SportId, Workout, WorkoutExercise, WorkoutSource } from '../types';
import { uid } from './id';

const SPORT_IDS = Object.keys(SPORTS) as [SportId, ...SportId[]];

/** Упражнение во внешнем формате: либо ссылка на библиотеку, либо полное описание. */
const ExternalExercise = z.object({
  exerciseId: z.string().optional(),
  name: z.string().optional(),
  category: z.enum(ALL_CATEGORIES as [Category, ...Category[]]).optional(),
  kind: z.enum(['reps', 'time']).optional(),
  muscles: z.array(z.enum(ALL_MUSCLES as [MuscleGroup, ...MuscleGroup[]])).optional(),
  sets: z.number().optional(),
  reps: z.number().optional(),
  durationSec: z.number().optional(),
  restSec: z.number().optional(),
  weightKg: z.number().optional(),
  perSide: z.boolean().optional(),
  tips: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const ExternalWorkout = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  sport: z.enum(SPORT_IDS).catch('general'),
  goal: z.enum(ALL_GOALS as [Goal, ...Goal[]]).catch('strength'),
  level: z.enum(ALL_LEVELS as [Level, ...Level[]]).catch('intermediate'),
  tips: z.array(z.string()).optional(),
  exercises: z.array(ExternalExercise).min(1),
});

export type ExternalWorkoutInput = z.input<typeof ExternalWorkout>;

const CatalogFile = z.object({
  version: z.number().optional(),
  updatedAt: z.string().optional(),
  workouts: z.array(z.unknown()),
});

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(v)));

function normalizeExercise(e: z.infer<typeof ExternalExercise>): WorkoutExercise | null {
  const lib = e.exerciseId ? getBuiltinExercise(e.exerciseId) : undefined;
  const name = e.name ?? lib?.name;
  const kind = lib?.kind ?? e.kind;
  if (!name || !kind) return null;
  return {
    uid: uid('we_'),
    exerciseId: lib?.id ?? e.exerciseId ?? `ext_${uid()}`,
    name,
    category: e.category ?? lib?.category ?? 'strength',
    kind,
    muscles: e.muscles?.length ? e.muscles : lib?.muscles ?? ['core'],
    perSide: e.perSide ?? lib?.perSide,
    tips: e.tips?.length ? e.tips : lib?.tips,
    sets: clamp(e.sets ?? 3, 1, 20),
    reps: kind === 'reps' ? clamp(e.reps ?? lib?.defaultReps ?? 10, 1, 200) : undefined,
    durationSec: kind === 'time' ? clamp(e.durationSec ?? lib?.defaultDurationSec ?? 30, 5, 7200) : undefined,
    restSec: clamp(e.restSec ?? 60, 0, 900),
    weightKg: e.weightKg && e.weightKg > 0 ? e.weightKg : undefined,
    notes: e.notes,
  };
}

/** Проверка и нормализация тренировки из внешнего источника (каталог, импорт, обмен). */
export function normalizeWorkout(raw: unknown, source: WorkoutSource, idPrefix = ''): Workout | null {
  const parsed = ExternalWorkout.safeParse(raw);
  if (!parsed.success) return null;
  const w = parsed.data;
  const exercises = w.exercises.map(normalizeExercise).filter((x): x is WorkoutExercise => x !== null);
  if (!exercises.length) return null;
  const now = new Date().toISOString();
  return {
    id: w.id ? `${idPrefix}${w.id}` : uid('w_'),
    title: w.title,
    description: w.description ?? '',
    sport: w.sport,
    goal: w.goal,
    level: w.level,
    tips: w.tips ?? [],
    exercises,
    source,
    createdAt: now,
    updatedAt: now,
  };
}

export class CatalogError extends Error {}

/** Загрузка онлайн-каталога готовых тренировок (JSON по URL). */
export async function fetchCatalog(url: string, signal?: AbortSignal): Promise<Workout[]> {
  let res: Response;
  try {
    res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  } catch {
    throw new CatalogError('Не удалось подключиться к каталогу. Проверьте интернет и адрес.');
  }
  if (!res.ok) throw new CatalogError(`Каталог недоступен (HTTP ${res.status}).`);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new CatalogError('Каталог вернул некорректный JSON.');
  }
  const file = CatalogFile.safeParse(json);
  if (!file.success) throw new CatalogError('Неверный формат каталога: ожидается объект с полем workouts.');
  const workouts = file.data.workouts
    .map((w) => normalizeWorkout(w, 'online', 'online_'))
    .filter((w): w is Workout => w !== null);
  if (!workouts.length) throw new CatalogError('В каталоге нет корректных тренировок.');
  return workouts;
}

// ——— Экспорт / импорт ———

const APP_TAG = 'athlete-coach';

function toExternal(w: Workout): ExternalWorkoutInput {
  return {
    id: w.id,
    title: w.title,
    description: w.description,
    sport: w.sport,
    goal: w.goal,
    level: w.level,
    tips: w.tips,
    exercises: w.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      name: e.name,
      category: e.category,
      kind: e.kind,
      muscles: e.muscles,
      sets: e.sets,
      reps: e.reps,
      durationSec: e.durationSec,
      restSec: e.restSec,
      weightKg: e.weightKg,
      perSide: e.perSide,
      tips: e.tips,
      notes: e.notes,
    })),
  };
}

export function exportWorkout(w: Workout): string {
  return JSON.stringify({ app: APP_TAG, type: 'workout', version: 1, workout: toExternal(w) });
}

export function exportBackup(data: AppData): string {
  const { activeSession: _active, catalog: _catalog, ...rest } = data;
  return JSON.stringify({ app: APP_TAG, type: 'backup', version: 1, exportedAt: new Date().toISOString(), data: rest });
}

export type ImportResult =
  | { kind: 'workout'; workout: Workout }
  | { kind: 'backup'; data: Partial<AppData> };

export function parseImport(text: string): ImportResult {
  let json: unknown;
  try {
    json = JSON.parse(text.trim());
  } catch {
    throw new CatalogError('Это не JSON. Скопируйте текст тренировки или резервной копии целиком.');
  }
  const obj = json as Record<string, unknown>;
  if (obj && obj.type === 'backup' && typeof obj.data === 'object' && obj.data) {
    const data = obj.data as Partial<AppData>;
    return {
      kind: 'backup',
      data: {
        profile: data.profile,
        settings: data.settings,
        workouts: Array.isArray(data.workouts) ? data.workouts : [],
        sessions: Array.isArray(data.sessions) ? data.sessions : [],
        schedule: Array.isArray(data.schedule) ? data.schedule : [],
        favoriteIds: Array.isArray(data.favoriteIds) ? data.favoriteIds : [],
        reactionResults: Array.isArray(data.reactionResults) ? data.reactionResults : undefined,
      },
    };
  }
  const raw = obj && obj.type === 'workout' ? obj.workout : obj;
  const workout = normalizeWorkout(raw, 'imported');
  if (!workout) throw new CatalogError('Не удалось распознать тренировку: нужны название и хотя бы одно упражнение.');
  // Импортированная копия всегда получает новый id, чтобы не перезаписать существующую.
  return { kind: 'workout', workout: { ...workout, id: uid('w_') } };
}
