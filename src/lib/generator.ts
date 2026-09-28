import { BUILTIN_EXERCISES } from '../data/exercises';
import { goalLabels, levelLabels, equipmentLabels } from '../data/labels';
import { SPORTS } from '../data/sports';
import type { Category, Equipment, Exercise, Goal, Level, MuscleGroup, SportId, Workout, WorkoutExercise } from '../types';
import { uid } from './id';
import { fromExercise, workSeconds } from './workout';

export interface GenerateRequest {
  sport: SportId;
  goal: Goal;
  level: Level;
  durationMin: number;
  equipment: Equipment[];
  focus?: MuscleGroup[];
  seed?: number;
}

type ByLevel = [number, number, number];

interface Dosage {
  /** Основные категории упражнений в порядке приоритета. */
  categories: Category[];
  /** Запасные категории — если основных не хватает, чтобы заполнить время. */
  extra: Category[];
  sets: ByLevel;
  reps: ByLevel;
  timeSec: ByLevel;
  rest: ByLevel;
  maxSets: number;
  /** Разумный предел длительности для цели, мин (реакцию 90 минут не тренируют). */
  maxMin: number;
}

const DOSAGE: Record<Goal, Dosage> = {
  strength: { categories: ['strength', 'core'], extra: ['power'], sets: [3, 4, 4], reps: [10, 8, 6], timeSec: [30, 40, 50], rest: [75, 90, 120], maxSets: 6, maxMin: 120 },
  power: { categories: ['power', 'strength', 'speed'], extra: ['core'], sets: [3, 4, 5], reps: [5, 6, 6], timeSec: [15, 20, 20], rest: [90, 120, 150], maxSets: 6, maxMin: 120 },
  speed: { categories: ['speed', 'agility', 'power'], extra: ['reaction'], sets: [4, 5, 6], reps: [4, 5, 6], timeSec: [15, 20, 20], rest: [75, 90, 120], maxSets: 8, maxMin: 90 },
  endurance: { categories: ['endurance', 'core', 'strength'], extra: ['agility', 'power'], sets: [2, 3, 4], reps: [12, 15, 20], timeSec: [30, 45, 60], rest: [45, 40, 30], maxSets: 5, maxMin: 120 },
  agility: { categories: ['agility', 'speed', 'reaction'], extra: ['power', 'endurance'], sets: [3, 4, 5], reps: [6, 8, 10], timeSec: [15, 20, 25], rest: [45, 45, 40], maxSets: 8, maxMin: 60 },
  reaction: { categories: ['reaction', 'agility', 'speed'], extra: ['power'], sets: [2, 3, 3], reps: [5, 8, 10], timeSec: [15, 20, 20], rest: [45, 45, 40], maxSets: 6, maxMin: 40 },
  mobility: { categories: ['mobility', 'cooldown', 'core'], extra: ['warmup'], sets: [1, 2, 2], reps: [6, 8, 10], timeSec: [30, 40, 45], rest: [15, 15, 15], maxSets: 3, maxMin: 60 },
  recovery: { categories: ['mobility', 'cooldown'], extra: ['core', 'warmup'], sets: [1, 1, 2], reps: [6, 8, 8], timeSec: [40, 45, 60], rest: [10, 10, 10], maxSets: 3, maxMin: 45 },
  prevention: { categories: ['strength', 'core', 'mobility'], extra: ['power'], sets: [2, 3, 3], reps: [8, 10, 12], timeSec: [20, 30, 40], rest: [45, 45, 45], maxSets: 5, maxMin: 90 },
  // Классика: гипертрофия 8–12 повторов, жиросжигание — круговой формат с коротким отдыхом, рельеф — многоповторка.
  hypertrophy: { categories: ['strength', 'core'], extra: ['power'], sets: [3, 4, 4], reps: [12, 10, 8], timeSec: [30, 40, 45], rest: [60, 75, 90], maxSets: 5, maxMin: 120 },
  fatloss: { categories: ['endurance', 'power', 'core'], extra: ['strength', 'agility'], sets: [2, 3, 4], reps: [15, 15, 20], timeSec: [30, 40, 45], rest: [30, 25, 20], maxSets: 5, maxMin: 75 },
  toning: { categories: ['strength', 'core'], extra: ['endurance'], sets: [3, 3, 4], reps: [15, 15, 15], timeSec: [30, 40, 45], rest: [45, 40, 30], maxSets: 5, maxMin: 90 },
};

/** Фактическая длительность, под которую строится тренировка (с учётом разумного предела цели). */
export function effectiveDuration(goal: Goal, requestedMin: number): number {
  return Math.min(Math.max(10, requestedMin), DOSAGE[goal].maxMin);
}

const GOAL_TIPS: Record<Goal, string> = {
  strength: 'Последние 2 повтора должны быть тяжёлыми, но техничными. Легко — добавьте вес в следующий раз.',
  power: 'Каждое повторение — максимально быстро. Скорость упала — заканчивайте подход.',
  speed: 'Скоростная работа только на свежих ногах, отдых — полный.',
  endurance: 'Держите ровный темп: первый и последний подход должны быть одинаковыми по качеству.',
  agility: 'Низкий центр тяжести и короткие шаги при смене направления.',
  reaction: 'Короткие серии на свежую голову — реакция не тренируется в усталости.',
  mobility: 'Двигайтесь плавно, дышите глубоко, без боли.',
  recovery: 'Лёгкий день: цель — чувствовать себя лучше после тренировки, чем до неё.',
  prevention: 'Регулярность важнее интенсивности — 2–3 раза в неделю.',
  hypertrophy: 'Работайте в 8–12 повторах почти до отказа и добавляйте вес, когда верхняя граница даётся легко.',
  fatloss: 'Держите высокий темп и короткий отдых; результат решает дефицит калорий, тренировка его усиливает.',
  toning: 'Многоповторная работа с умеренным весом и контролем движения; следите за питанием.',
};

const LEVEL_INDEX: Record<Level, 0 | 1 | 2> = { beginner: 0, intermediate: 1, advanced: 2 };

/** Детерминированный ГПСЧ (mulberry32) — одинаковый seed даёт одинаковую тренировку. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hasEquipment(ex: Exercise, available: Equipment[]): boolean {
  return ex.equipment.every((e) => available.includes(e));
}

function itemSeconds(item: WorkoutExercise): number {
  return (workSeconds(item) + item.restSec) * item.sets + 20;
}

function sumSeconds(items: WorkoutExercise[]): number {
  return items.reduce((acc, i) => acc + itemSeconds(i), 0);
}

function dose(ex: Exercise, goal: Goal, level: Level): WorkoutExercise {
  const d = DOSAGE[goal];
  const li = LEVEL_INDEX[level];
  // Длинные кардио-упражнения (бег, велосипед) выполняются одним подходом.
  if (ex.kind === 'time' && (ex.defaultDurationSec ?? 0) >= 300) {
    const scale = [0.75, 1, 1.25][li];
    return fromExercise(ex, { sets: 1, durationSec: Math.round(((ex.defaultDurationSec ?? 600) * scale) / 60) * 60, restSec: 60 });
  }
  // Спринты и челноки: одно повторение = один забег.
  if (ex.kind === 'reps' && ex.defaultReps === 1) {
    return fromExercise(ex, { sets: d.sets[li] + 2, reps: 1, restSec: Math.max(d.rest[li], 60) });
  }
  const reps = ex.defaultReps ? Math.round((ex.defaultReps + d.reps[li]) / 2) : d.reps[li];
  const timeSec = ex.defaultDurationSec ? Math.round((ex.defaultDurationSec + d.timeSec[li]) / 2 / 5) * 5 : d.timeSec[li];
  return fromExercise(ex, { sets: d.sets[li], reps, durationSec: timeSec, restSec: d.rest[li] });
}

function pickBest<T>(items: { item: T; score: number }[]): T | undefined {
  let best: { item: T; score: number } | undefined;
  for (const c of items) if (!best || c.score > best.score) best = c;
  return best?.item;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateWorkout(req: GenerateRequest): Workout {
  const rng = createRng(req.seed ?? Date.now());
  const sport = SPORTS[req.sport];
  const dosage = DOSAGE[req.goal];
  const pool = BUILTIN_EXERCISES.filter((e) => hasEquipment(e, req.equipment));
  const durationMin = effectiveDuration(req.goal, req.durationMin);
  const totalBudget = durationMin * 60;
  // Для фитнеса подходят и универсальные упражнения ОФП.
  const sportScore = (e: Exercise) =>
    e.sports.includes(req.sport) || (req.sport === 'fitness' && e.sports.includes('general'))
      ? 3
      : e.sports.includes('general')
        ? 0.5
        : -1;

  // ——— Разминка ———
  const warmCount = durationMin <= 20 ? 2 : 3;
  const warmup: WorkoutExercise[] = [];
  const warmCandidates = pool
    .filter((e) => e.category === 'warmup' || (e.category === 'mobility' && req.goal !== 'mobility' && req.goal !== 'recovery'))
    .map((e) => ({ e, score: sportScore(e) + rng() * 2 }))
    .sort((a, b) => b.score - a.score);
  for (const { e } of warmCandidates.slice(0, warmCount)) {
    warmup.push(fromExercise(e, { sets: 1, restSec: 15 }));
  }

  // ——— Заминка ———
  const cooldown: WorkoutExercise[] = [];
  const coolCandidates = pool
    .filter((e) => e.category === 'cooldown')
    .map((e) => ({ e, score: sportScore(e) + rng() * 2 }))
    .sort((a, b) => b.score - a.score);
  for (const { e } of coolCandidates.slice(0, 2)) {
    cooldown.push(fromExercise(e, { sets: 1, restSec: 10 }));
  }

  // ——— Основная часть ———
  const usedIds = new Set([...warmup, ...cooldown].map((w) => w.exerciseId));
  const mainBudget = Math.max(5 * 60, totalBudget - sumSeconds(warmup) - sumSeconds(cooldown));
  const main: WorkoutExercise[] = [];
  const muscleUse = new Map<MuscleGroup, number>();
  const focus = req.focus ?? [];

  const scoreMain = (e: Exercise, extra: boolean): number => {
    const catIndex = dosage.categories.indexOf(e.category);
    const extraIndex = dosage.extra.indexOf(e.category);
    if (catIndex < 0 && !(extra && extraIndex >= 0)) return -Infinity;
    let score = catIndex >= 0 ? (dosage.categories.length - catIndex) * 1.5 : -1;
    score += sportScore(e);
    score += Math.min(2, e.muscles.filter((m) => sport.priorityMuscles.includes(m)).length);
    score += e.muscles.filter((m) => focus.includes(m)).length * 2;
    // Для массы и силы предпочитаем упражнения с отягощением, если оно есть.
    if ((req.goal === 'hypertrophy' || req.goal === 'strength') && e.equipment.length > 0) score += 1;
    score -= (muscleUse.get(e.muscles[0]) ?? 0) * 1.5;
    return score + rng() * 1.5;
  };

  const fillMain = (extra: boolean) => {
    while (main.length < 12) {
      const used = sumSeconds(main);
      if (used >= mainBudget) break;
      const candidates = pool
        .filter((e) => !usedIds.has(e.id))
        .map((e) => ({ item: e, score: scoreMain(e, extra), sec: itemSeconds(dose(e, req.goal, req.level)) }))
        .filter((c) => Number.isFinite(c.score));
      const fitting = candidates.filter((c) => used + c.sec <= mainBudget * 1.15);
      // Если ничего не помещается, а основная часть пуста — берём самое короткое упражнение.
      const next =
        pickBest(fitting) ?? (main.length === 0 ? [...candidates].sort((a, b) => a.sec - b.sec)[0]?.item : undefined);
      if (!next) break;
      main.push(dose(next, req.goal, req.level));
      usedIds.add(next.id);
      for (const m of next.muscles) muscleUse.set(m, (muscleUse.get(m) ?? 0) + 1);
    }
  };

  // Сначала — упражнение на ключевую для спорта мышечную группу (например, шею для картинга).
  const keyMuscle = sport.priorityMuscles[0];
  const lightGoal = req.goal === 'mobility' || req.goal === 'recovery';
  const skillGoal = req.goal === 'speed' || req.goal === 'agility' || req.goal === 'reaction';
  if (!lightGoal && !skillGoal) {
    const key = pool
      .filter((e) => !usedIds.has(e.id) && e.muscles.includes(keyMuscle))
      .filter((e) => !['warmup', 'cooldown', 'mobility'].includes(e.category) && (e.defaultDurationSec ?? 0) < 300)
      .map((e) => ({ item: e, score: scoreMain(e, true) }))
      .filter((c) => Number.isFinite(c.score))
      .sort((a, b) => b.score - a.score)[0]?.item;
    if (key) {
      main.push(dose(key, req.goal, req.level));
      usedIds.add(key.id);
      for (const m of key.muscles) muscleUse.set(m, (muscleUse.get(m) ?? 0) + 1);
    }
  }

  fillMain(false);
  // Основных упражнений мало (узкая цель или мало оборудования) — добираем подходы, затем запасные категории.
  const addSets = () => {
    let changed = true;
    while (changed && sumSeconds(main) < mainBudget * 0.85) {
      changed = false;
      for (const item of main) {
        if (sumSeconds(main) >= mainBudget * 0.85) break;
        if (item.sets < dosage.maxSets) {
          item.sets += 1;
          changed = true;
        }
      }
    }
  };
  addSets();
  if (sumSeconds(main) < mainBudget * 0.85) {
    fillMain(true);
    addSets();
  }

  const now = new Date().toISOString();
  const equipmentText = req.equipment.length
    ? req.equipment.map((e) => equipmentLabels[e].toLowerCase()).join(', ')
    : 'без инвентаря';
  const sportTips = shuffle(sport.tips, rng).slice(0, 2);

  return {
    id: uid('w_'),
    title: `${sport.name}: ${goalLabels[req.goal].toLowerCase()}`,
    description:
      `Сгенерировано офлайн · уровень «${levelLabels[req.level]}» · ~${durationMin} мин · ${equipmentText}.` +
      (durationMin < req.durationMin
        ? ` Для цели «${goalLabels[req.goal]}» больше ${durationMin} мин обычно не дают пользы — тренировка сокращена.`
        : ''),
    sport: req.sport,
    goal: req.goal,
    level: req.level,
    exercises: [...warmup, ...main, ...cooldown],
    tips: [GOAL_TIPS[req.goal], ...sportTips],
    source: 'generator',
    createdAt: now,
    updatedAt: now,
  };
}
