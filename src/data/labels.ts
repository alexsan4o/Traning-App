import type { Category, Equipment, Experience, Goal, Level, MuscleGroup, WorkoutSource } from '../types';

export const categoryLabels: Record<Category, string> = {
  warmup: 'Разминка',
  strength: 'Сила',
  power: 'Взрывная сила',
  speed: 'Скорость',
  agility: 'Ловкость',
  endurance: 'Выносливость',
  core: 'Кор',
  mobility: 'Мобильность',
  reaction: 'Реакция',
  skill: 'Техника',
  cooldown: 'Заминка',
};

export const muscleLabels: Record<MuscleGroup, string> = {
  neck: 'Шея',
  shoulders: 'Плечи',
  chest: 'Грудь',
  back: 'Спина',
  arms: 'Руки',
  forearms: 'Предплечья',
  core: 'Пресс и кор',
  glutes: 'Ягодицы',
  quads: 'Квадрицепсы',
  hamstrings: 'Бицепс бедра',
  adductors: 'Приводящие',
  calves: 'Икры',
};

export const equipmentLabels: Record<Equipment, string> = {
  dumbbells: 'Гантели',
  barbell: 'Штанга',
  kettlebell: 'Гиря',
  plate: 'Блин',
  bands: 'Резинки',
  bar: 'Турник',
  box: 'Тумба',
  bench: 'Скамья',
  ball: 'Мяч',
  medball: 'Медбол',
  cones: 'Фишки',
  rope: 'Скакалка',
  roller: 'Ролл',
  bike: 'Велосипед',
  machine: 'Тренажёры',
};

export const goalLabels: Record<Goal, string> = {
  strength: 'Сила',
  power: 'Взрывная сила',
  speed: 'Скорость',
  endurance: 'Выносливость',
  agility: 'Ловкость',
  reaction: 'Реакция',
  mobility: 'Мобильность',
  recovery: 'Восстановление',
  prevention: 'Профилактика травм',
  hypertrophy: 'Набор массы',
  fatloss: 'Похудение',
  toning: 'Рельеф и тонус',
};

/** Классические фитнес-цели — показываются отдельной группой. */
export const levelLabels: Record<Level, string> = {
  beginner: 'Базовый',
  intermediate: 'Продвинутый',
  advanced: 'Профи',
};

export const levelDescriptions: Record<Level, string> = {
  beginner: 'Стаж до 1 года. Осваиваем технику, умеренные веса и больше отдыха.',
  intermediate: 'Стаж 1–3 года. Больше объёма и интенсивности, сложнее упражнения.',
  advanced: 'Стаж более 3 лет. Высокий объём, тяжёлые подходы и плотные тренировки.',
};

export const experienceLabels: Record<Experience, string> = {
  lt6m: 'Меньше 6 месяцев',
  '6to12m': '6–12 месяцев',
  '1to3y': '1–3 года',
  '3to5y': '3–5 лет',
  gt5y: 'Больше 5 лет',
};

export const ALL_EXPERIENCE = Object.keys(experienceLabels) as Experience[];

/** Уровень по тренировочному стажу: до года — «Базовый», 1–3 года — «Продвинутый», дольше — «Профи». */
export function levelFromExperience(experience: Experience): Level {
  if (experience === 'lt6m' || experience === '6to12m') return 'beginner';
  if (experience === '1to3y') return 'intermediate';
  return 'advanced';
}

export const sourceLabels: Record<WorkoutSource, string> = {
  builtin: 'Библиотека',
  custom: 'Моя',
  ai: 'ИИ (Claude)',
  generator: 'Генератор',
  online: 'Онлайн-каталог',
  imported: 'Импорт',
};

export const ALL_EQUIPMENT = Object.keys(equipmentLabels) as Equipment[];
export const ALL_GOALS = Object.keys(goalLabels) as Goal[];
export const ALL_LEVELS = Object.keys(levelLabels) as Level[];
export const ALL_CATEGORIES = Object.keys(categoryLabels) as Category[];
export const ALL_MUSCLES = Object.keys(muscleLabels) as MuscleGroup[];

export const phaseLabels = {
  strength: 'Сила и кор',
  conditioning: 'Скорость и выносливость',
  prep: 'Разминка и заминка',
} as const;
