import type { Category } from './types';

export const colors = {
  bg: '#0B0F14',
  surface: '#131A23',
  surfaceAlt: '#1B2430',
  border: '#263243',
  text: '#F2F5F9',
  textDim: '#A0ADBF',
  textFaint: '#667488',
  primary: '#A3E635',
  onPrimary: '#0B0F14',
  accent: '#38BDF8',
  warning: '#FBBF24',
  danger: '#F87171',
  success: '#34D399',
  rest: '#818CF8',
};

export type Phase = 'strength' | 'conditioning' | 'prep';

const PHASE_OF: Record<Category, Phase> = {
  strength: 'strength',
  power: 'strength',
  core: 'strength',
  speed: 'conditioning',
  agility: 'conditioning',
  endurance: 'conditioning',
  reaction: 'conditioning',
  skill: 'conditioning',
  warmup: 'prep',
  mobility: 'prep',
  cooldown: 'prep',
};

export function phaseOf(category: Category): Phase {
  return PHASE_OF[category];
}

/**
 * Цвета графиков, проверенные на тёмной поверхности (#131A23) валидатором палитр:
 * категориальные фазы проходят CVD-разделение для всех пар, шкала — монотонна по светлоте.
 */
export const chart = {
  /** Один ряд данных (столбцы, линия). */
  series: '#65A30D',
  /** Фиксированный порядок категорий: сила → кондиции → подготовка. */
  phase: { strength: '#3987e5', conditioning: '#d95926', prep: '#199e70' } as Record<Phase, string>,
  phaseOrder: ['strength', 'conditioning', 'prep'] as Phase[],
  rest: '#3A4658',
  /** Последовательная шкала «мало → много» (один оттенок). */
  ramp: ['#3F6212', '#4D7C0F', '#65A30D', '#84CC16', '#A3E635'],
  empty: '#1B2430',
  grid: '#232D3B',
};

export function rampColor(value: number, max: number): string {
  if (value <= 0 || max <= 0) return chart.empty;
  const idx = Math.min(chart.ramp.length - 1, Math.floor((value / max) * chart.ramp.length));
  return chart.ramp[Math.max(0, idx)];
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

export const font = {
  h1: { fontSize: 28, fontWeight: '800' as const, color: colors.text },
  h2: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  h3: { fontSize: 17, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  dim: { fontSize: 14, color: colors.textDim },
  small: { fontSize: 12, color: colors.textFaint },
};
