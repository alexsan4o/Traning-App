import type { Category, Equipment, Exercise, MuscleGroup } from '../types';

/**
 * Клиент открытой базы упражнений wger.de (https://wger.de/api/v2/).
 * Ключ API для чтения не нужен. Ответы разбираются защитно — формат API менялся между версиями.
 */
export const WGER_BASE = 'https://wger.de/api/v2';

// Идентификаторы языков wger: 2 — английский, 5 — русский.
const LANG_RU = 5;
const LANG_EN = 2;

export interface WgerSuggestion {
  baseId: number;
  name: string;
  category: string;
  thumbnail?: string;
}

interface WgerNamed {
  id?: number;
  name?: string;
  name_en?: string;
}

interface WgerTranslation {
  name?: string;
  description?: string;
  language?: number;
}

interface WgerExerciseInfo {
  id: number;
  category?: WgerNamed;
  muscles?: WgerNamed[];
  muscles_secondary?: WgerNamed[];
  equipment?: WgerNamed[];
  images?: { image?: string; is_main?: boolean }[];
  translations?: WgerTranslation[];
  exercises?: WgerTranslation[];
}

const absoluteUrl = (path?: string) => (path ? (path.startsWith('http') ? path : `https://wger.de${path}`) : undefined);

export async function searchWger(term: string, signal?: AbortSignal): Promise<WgerSuggestion[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const url = `${WGER_BASE}/exercise/search/?language=ru,en&term=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`wger: HTTP ${res.status}`);
  return parseSearch(await res.json());
}

export function parseSearch(json: unknown): WgerSuggestion[] {
  const suggestions = (json as { suggestions?: unknown[] })?.suggestions;
  if (!Array.isArray(suggestions)) return [];
  const out: WgerSuggestion[] = [];
  const seen = new Set<number>();
  for (const s of suggestions) {
    const item = s as { value?: string; data?: Record<string, unknown> };
    const data = item.data ?? {};
    const baseId = Number(data.base_id ?? data.id);
    const name = String(data.name ?? item.value ?? '').trim();
    if (!baseId || !name || seen.has(baseId)) continue;
    seen.add(baseId);
    out.push({
      baseId,
      name,
      category: String(data.category ?? ''),
      thumbnail: absoluteUrl((data.image_thumbnail ?? data.image) as string | undefined),
    });
  }
  return out;
}

export async function fetchWgerExercise(baseId: number, signal?: AbortSignal): Promise<Exercise> {
  const res = await fetch(`${WGER_BASE}/exerciseinfo/${baseId}/`, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`wger: HTTP ${res.status}`);
  const ex = parseExerciseInfo(await res.json());
  if (!ex) throw new Error('wger: не удалось разобрать упражнение');
  return ex;
}

function mapMuscle(m: WgerNamed): MuscleGroup | null {
  const n = `${m.name_en ?? ''} ${m.name ?? ''}`.toLowerCase();
  if (/bicep(s)? femoris|hamstring/.test(n)) return 'hamstrings';
  if (/biceps|triceps|brachialis/.test(n)) return 'arms';
  if (/deltoid|shoulder/.test(n)) return 'shoulders';
  if (/pectoral|chest|serratus/.test(n)) return 'chest';
  if (/abdominis|abs|oblique/.test(n)) return 'core';
  if (/gastrocnemius|soleus|calves/.test(n)) return 'calves';
  if (/glute/.test(n)) return 'glutes';
  if (/quadriceps|quads/.test(n)) return 'quads';
  if (/latissimus|lats|trapezius|erector|back/.test(n)) return 'back';
  if (/adductor/.test(n)) return 'adductors';
  if (/forearm|brachioradialis/.test(n)) return 'forearms';
  if (/neck|sternocleido/.test(n)) return 'neck';
  return null;
}

function mapEquipment(e: WgerNamed): Equipment | null {
  const n = (e.name ?? '').toLowerCase();
  if (/sz-bar|barbell/.test(n)) return 'barbell';
  if (/dumbbell/.test(n)) return 'dumbbells';
  if (/kettlebell/.test(n)) return 'kettlebell';
  if (/pull-up bar/.test(n)) return 'bar';
  if (/bench/.test(n)) return 'bench';
  if (/band/.test(n)) return 'bands';
  return null;
}

function mapCategory(c?: WgerNamed): Category {
  const n = (c?.name ?? '').toLowerCase();
  if (n.includes('cardio')) return 'endurance';
  if (n.includes('abs')) return 'core';
  return 'strength';
}

export function stripHtml(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/li)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function parseExerciseInfo(json: unknown): Exercise | null {
  const info = json as WgerExerciseInfo;
  if (!info || typeof info.id !== 'number') return null;
  const translations = info.translations ?? info.exercises ?? [];
  const tr =
    translations.find((t) => t.language === LANG_RU && t.name) ??
    translations.find((t) => t.language === LANG_EN && t.name) ??
    translations.find((t) => t.name);
  if (!tr?.name) return null;

  const muscles = Array.from(
    new Set(
      [...(info.muscles ?? []), ...(info.muscles_secondary ?? [])]
        .map(mapMuscle)
        .filter((m): m is MuscleGroup => m !== null),
    ),
  );
  const equipment = Array.from(
    new Set((info.equipment ?? []).map(mapEquipment).filter((e): e is Equipment => e !== null)),
  );
  const category = mapCategory(info.category);
  const description = stripHtml(tr.description ?? '');
  const image = info.images?.find((i) => i.is_main)?.image ?? info.images?.[0]?.image;

  return {
    id: `wger_${info.id}`,
    name: tr.name.trim(),
    category,
    kind: category === 'endurance' ? 'time' : 'reps',
    muscles: muscles.length ? muscles : ['core'],
    equipment,
    sports: ['general'],
    description: description || 'Описание из базы wger.de отсутствует.',
    tips: description
      ? description
          .split(/\n+|\.\s+/)
          .map((s) => s.trim().replace(/\.?$/, '.'))
          .filter((s) => s.length > 15)
          .slice(0, 3)
      : [],
    defaultReps: 10,
    defaultDurationSec: 60,
    source: 'wger',
    imageUrl: absoluteUrl(image),
  };
}
