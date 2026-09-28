import type { Category, Equipment, Goal, Level, MuscleGroup, WorkoutSource } from '../types';

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
};

export const levelLabels: Record<Level, string> = {
  beginner: 'Новичок',
  intermediate: 'Средний',
  advanced: 'Продвинутый',
};

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
