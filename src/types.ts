export type SportId =
  | 'football'
  | 'karting'
  | 'running'
  | 'hockey'
  | 'basketball'
  | 'tennis'
  | 'combat'
  | 'swimming'
  | 'cycling'
  | 'fitness'
  | 'weightlifting'
  | 'general';

export type MuscleGroup =
  | 'neck'
  | 'shoulders'
  | 'chest'
  | 'back'
  | 'arms'
  | 'forearms'
  | 'core'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'adductors'
  | 'calves';

export type Category =
  | 'warmup'
  | 'strength'
  | 'power'
  | 'speed'
  | 'agility'
  | 'endurance'
  | 'core'
  | 'mobility'
  | 'reaction'
  | 'skill'
  | 'cooldown';

export type Equipment =
  | 'dumbbells'
  | 'barbell'
  | 'kettlebell'
  | 'plate'
  | 'bands'
  | 'bar'
  | 'box'
  | 'bench'
  | 'ball'
  | 'medball'
  | 'cones'
  | 'rope'
  | 'roller'
  | 'bike'
  | 'machine';

export type Goal =
  | 'strength'
  | 'power'
  | 'speed'
  | 'endurance'
  | 'agility'
  | 'reaction'
  | 'mobility'
  | 'recovery'
  | 'prevention'
  | 'hypertrophy'
  | 'fatloss'
  | 'toning';

/** Уровни: beginner — «Базовый», intermediate — «Продвинутый», advanced — «Профи». */
export type Level = 'beginner' | 'intermediate' | 'advanced';

/** Тренировочный стаж, по которому определяется уровень. */
export type Experience = 'lt6m' | '6to12m' | '1to3y' | '3to5y' | 'gt5y';

/** reps — подход считается повторениями, time — подход по времени (удержание, интервал). */
export type ExerciseKind = 'reps' | 'time';

export type ExerciseSource = 'builtin' | 'wger' | 'ai' | 'custom';

export interface Exercise {
  id: string;
  name: string;
  category: Category;
  kind: ExerciseKind;
  muscles: MuscleGroup[];
  /** Всё перечисленное оборудование нужно одновременно; пустой список — без инвентаря. */
  equipment: Equipment[];
  sports: SportId[];
  description: string;
  tips: string[];
  mistakes?: string[];
  /** Выполняется на каждую сторону (выпады, боковая планка). */
  perSide?: boolean;
  defaultReps?: number;
  defaultDurationSec?: number;
  source?: ExerciseSource;
  imageUrl?: string;
}

export interface WorkoutExercise {
  uid: string;
  exerciseId: string;
  name: string;
  category: Category;
  kind: ExerciseKind;
  muscles: MuscleGroup[];
  sets: number;
  reps?: number;
  durationSec?: number;
  weightKg?: number;
  restSec: number;
  perSide?: boolean;
  tips?: string[];
  notes?: string;
}

export type WorkoutSource = 'builtin' | 'custom' | 'ai' | 'generator' | 'online' | 'imported';

export interface Workout {
  id: string;
  title: string;
  description: string;
  sport: SportId;
  goal: Goal;
  level: Level;
  exercises: WorkoutExercise[];
  tips: string[];
  source: WorkoutSource;
  createdAt: string;
  updatedAt: string;
}

export interface SetLog {
  reps?: number;
  durationSec?: number;
  weightKg?: number;
  completedAt: string;
}

export interface ExerciseLog {
  uid: string;
  exerciseId: string;
  name: string;
  category: Category;
  kind: ExerciseKind;
  muscles: MuscleGroup[];
  targetSets: number;
  sets: SetLog[];
}

export interface Session {
  id: string;
  workoutId: string;
  title: string;
  sport: SportId;
  startedAt: string;
  finishedAt: string;
  durationSec: number;
  exercises: ExerciseLog[];
  /** Субъективная нагрузка 1–10 (RPE). */
  rpe?: number;
  notes?: string;
}

export interface ScheduledWorkout {
  id: string;
  /** YYYY-MM-DD в локальном времени. */
  date: string;
  workoutId: string;
}

export interface Profile {
  name: string;
  sport: SportId;
  level: Level;
  equipment: Equipment[];
  weeklyTarget: number;
  experience?: Experience;
  onboarded: boolean;
}

export interface Settings {
  /** Разрешить приложению ходить в интернет (ИИ, онлайн-каталог, wger). */
  onlineEnabled: boolean;
  /** Использовать Claude для генерации, если есть ключ и сеть. */
  aiEnabled: boolean;
  catalogUrl: string;
  defaultRestSec: number;
  vibration: boolean;
  voice: boolean;
  keepAwake: boolean;
  restNotifications: boolean;
  /** Показывать анимацию упражнений во время тренировки. */
  animations: boolean;
}

/** Состояние незавершённой тренировки — переживает перезапуск приложения. */
export interface ActiveSession {
  workoutId: string;
  startedAt: string;
  exerciseIndex: number;
  logs: ExerciseLog[];
  /** Момент окончания отдыха (epoch ms), если сейчас идёт отдых. */
  restEndsAt?: number;
  restTotalSec?: number;
  /** Упражнения, заменённые только в этой тренировке (ключ — uid упражнения в комплексе). */
  overrides?: Record<string, WorkoutExercise>;
}

export interface ReactionResult {
  date: string;
  bestMs: number;
  avgMs: number;
  attempts: number;
}
