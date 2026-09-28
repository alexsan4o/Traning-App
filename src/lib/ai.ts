import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

import { BUILTIN_EXERCISES, getBuiltinExercise } from '../data/exercises';
import { ALL_CATEGORIES, ALL_MUSCLES, equipmentLabels, goalLabels, levelLabels, muscleLabels } from '../data/labels';
import { SPORTS } from '../data/sports';
import type { Category, MuscleGroup, Session, Workout, WorkoutExercise } from '../types';
import type { GenerateRequest } from './generator';
import { uid } from './id';

export const AI_MODEL = 'claude-opus-5';

const CategoryEnum = z.enum(ALL_CATEGORIES as [Category, ...Category[]]);
const MuscleEnum = z.enum(ALL_MUSCLES as [MuscleGroup, ...MuscleGroup[]]);

const AiExerciseSchema = z.object({
  library_id: z
    .string()
    .nullable()
    .describe('id упражнения из каталога, если оно взято оттуда; null — если это новое упражнение'),
  name: z.string().describe('Название упражнения на русском'),
  category: CategoryEnum,
  kind: z.enum(['reps', 'time']).describe('reps — на повторения, time — на время'),
  muscles: z.array(MuscleEnum),
  sets: z.number().int(),
  reps: z.number().int().nullable().describe('Повторы в подходе для kind=reps, иначе null'),
  duration_sec: z.number().int().nullable().describe('Длительность подхода в секундах для kind=time, иначе null'),
  rest_sec: z.number().int().describe('Отдых после каждого подхода в секундах'),
  per_side: z.boolean().describe('true, если выполняется на каждую сторону'),
  weight_kg: z.number().nullable().describe('Рекомендуемый вес отягощения в кг или null'),
  tips: z.array(z.string()).describe('2–3 коротких подсказки по технике на русском'),
});

const AiWorkoutSchema = z.object({
  title: z.string(),
  description: z.string().describe('1–2 предложения: цель и как выполнять'),
  exercises: z.array(AiExerciseSchema),
  tips: z.array(z.string()).describe('2–4 совета к тренировке целиком'),
});

export type AiWorkout = z.infer<typeof AiWorkoutSchema>;

export interface AiRequest extends GenerateRequest {
  wishes?: string;
  recentSessions?: Pick<Session, 'title' | 'finishedAt' | 'rpe'>[];
}

export class AiError extends Error {}

const CATALOG_TEXT = BUILTIN_EXERCISES.map((e) => {
  const eq = e.equipment.length ? e.equipment.map((x) => equipmentLabels[x]).join('+') : 'без инвентаря';
  return `${e.id} — ${e.name} (${e.category}, ${e.kind}; ${e.muscles.join(',')}; ${eq})`;
}).join('\n');

// Системный промпт стабилен между запросами (каталог не зависит от пользователя), поэтому кэшируется.
const SYSTEM_PROMPT = `Ты — тренер по общей и специальной физической подготовке спортсменов (футбол, картинг, бег, хоккей, баскетбол, теннис, единоборства, плавание, велоспорт). Ты составляешь безопасные, реалистичные тренировки, которые спортсмен выполняет по приложению с таймером отдыха и счётчиком подходов.

Структура тренировки: разминка → основная часть → заминка. Учитывай вид спорта (например, для картинга важны шея, хват, кор и реакция; для футбола — скорость, выносливость и профилактика травм задней поверхности бедра и приводящих), уровень подготовки, доступное оборудование и отведённое время. Не используй оборудование, которого у спортсмена нет.

Если подходящее упражнение есть в каталоге ниже, укажи его library_id и используй его название. Новые упражнения допустимы, если каталог не покрывает задачу; тогда library_id = null.

Все тексты — на русском языке, коротко и по делу.

Каталог упражнений (id — название (категория, тип; мышцы; оборудование)):
${CATALOG_TEXT}`;

let cachedClient: { key: string; client: Anthropic } | null = null;

function getClient(apiKey: string): Anthropic {
  if (cachedClient?.key !== apiKey) {
    cachedClient = {
      key: apiKey,
      // Ключ пользователя хранится только на устройстве (SecureStore); в браузерной сборке
      // SDK требует явного согласия на клиентское использование.
      client: new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 180_000 }),
    };
  }
  return cachedClient.client;
}

function buildUserPrompt(req: AiRequest): string {
  const sport = SPORTS[req.sport];
  const equipment = req.equipment.length ? req.equipment.map((e) => equipmentLabels[e]).join(', ') : 'нет (только вес тела)';
  const lines = [
    `Вид спорта: ${sport.name}.`,
    `Цель тренировки: ${goalLabels[req.goal]}.`,
    `Уровень: ${levelLabels[req.level]}.`,
    `Длительность: около ${req.durationMin} минут, включая отдых.`,
    `Доступное оборудование: ${equipment}.`,
  ];
  if (req.focus?.length) lines.push(`Акцент на мышцы: ${req.focus.map((m) => muscleLabels[m]).join(', ')}.`);
  if (req.recentSessions?.length) {
    const recent = req.recentSessions
      .map((s) => `${s.title} (${s.finishedAt.slice(0, 10)}${s.rpe ? `, RPE ${s.rpe}` : ''})`)
      .join('; ');
    lines.push(`Последние тренировки спортсмена: ${recent}.`);
  }
  if (req.wishes?.trim()) lines.push(`Пожелания спортсмена: ${req.wishes.trim()}`);
  lines.push('Составь тренировку.');
  return lines.join('\n');
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(v)));

export function mapAiWorkout(ai: AiWorkout, req: GenerateRequest): Workout {
  const exercises: WorkoutExercise[] = ai.exercises.map((e) => {
    const lib = e.library_id ? getBuiltinExercise(e.library_id) : undefined;
    const kind = lib?.kind ?? e.kind;
    const tips = Array.from(new Set([...e.tips, ...(lib?.tips ?? [])])).slice(0, 4);
    return {
      uid: uid('we_'),
      exerciseId: lib?.id ?? `ai_${uid()}`,
      name: lib?.name ?? e.name,
      category: lib?.category ?? e.category,
      kind,
      muscles: lib?.muscles ?? (e.muscles.length ? e.muscles : ['core']),
      perSide: lib?.perSide ?? e.per_side,
      tips,
      sets: clamp(e.sets, 1, 10),
      reps: kind === 'reps' ? clamp(e.reps ?? lib?.defaultReps ?? 10, 1, 100) : undefined,
      durationSec: kind === 'time' ? clamp(e.duration_sec ?? lib?.defaultDurationSec ?? 30, 5, 3600) : undefined,
      restSec: clamp(e.rest_sec, 0, 600),
      weightKg: e.weight_kg && e.weight_kg > 0 ? Math.round(e.weight_kg * 2) / 2 : undefined,
    };
  });
  if (!exercises.length) throw new AiError('ИИ вернул пустую тренировку. Попробуйте ещё раз.');
  const now = new Date().toISOString();
  return {
    id: uid('w_'),
    title: ai.title.trim() || `${SPORTS[req.sport].name}: ${goalLabels[req.goal].toLowerCase()}`,
    description: ai.description.trim(),
    sport: req.sport,
    goal: req.goal,
    level: req.level,
    exercises,
    tips: ai.tips.slice(0, 5),
    source: 'ai',
    createdAt: now,
    updatedAt: now,
  };
}

function toAiError(err: unknown): AiError {
  if (err instanceof AiError) return err;
  if (err instanceof Anthropic.AuthenticationError) return new AiError('Неверный API-ключ Anthropic. Проверьте его в настройках.');
  if (err instanceof Anthropic.PermissionDeniedError) return new AiError('У ключа нет доступа к модели. Проверьте настройки аккаунта Anthropic.');
  if (err instanceof Anthropic.RateLimitError) return new AiError('Превышен лимит запросов. Подождите минуту и повторите.');
  if (err instanceof Anthropic.APIConnectionError) return new AiError('Нет соединения с сервером ИИ. Проверьте интернет.');
  if (err instanceof Anthropic.APIError) return new AiError(`Ошибка сервера ИИ (${err.status ?? '—'}). Попробуйте позже.`);
  return new AiError(err instanceof Error ? err.message : 'Неизвестная ошибка ИИ.');
}

/** Генерация тренировки через Claude со структурированным ответом по схеме. */
export async function generateWithAi(apiKey: string, req: AiRequest): Promise<Workout> {
  try {
    const client = getClient(apiKey);
    const response = await client.beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(AiWorkoutSchema) },
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildUserPrompt(req) }],
    });
    if (response.stop_reason === 'refusal') {
      throw new AiError('ИИ отклонил запрос. Переформулируйте пожелания.');
    }
    if (response.stop_reason === 'max_tokens') {
      throw new AiError('Ответ ИИ оказался слишком длинным. Уменьшите длительность или упростите запрос.');
    }
    if (!response.parsed_output) throw new AiError('Не удалось разобрать ответ ИИ. Попробуйте ещё раз.');
    return mapAiWorkout(response.parsed_output, req);
  } catch (err) {
    throw toAiError(err);
  }
}

/** Персональный совет тренера по конкретной тренировке. */
export async function askCoach(apiKey: string, workout: Workout, question: string): Promise<string> {
  try {
    const client = getClient(apiKey);
    const plan = workout.exercises
      .map((e) => `- ${e.name}: ${e.sets}×${e.kind === 'time' ? `${e.durationSec} с` : `${e.reps}`}${e.weightKg ? ` @ ${e.weightKg} кг` : ''}, отдых ${e.restSec} с`)
      .join('\n');
    const response = await client.beta.messages.create({
      model: AI_MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system:
        'Ты — тренер по физподготовке спортсменов. Отвечай на русском, кратко (до 150 слов), конкретно и безопасно. Если вопрос касается боли или травмы, посоветуй обратиться к врачу.',
      messages: [
        {
          role: 'user',
          content: `Вид спорта: ${SPORTS[workout.sport].name}. Тренировка «${workout.title}»:\n${plan}\n\nВопрос: ${question}`,
        },
      ],
    });
    if (response.stop_reason === 'refusal') throw new AiError('ИИ отклонил вопрос. Переформулируйте его.');
    const text = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim();
    if (!text) throw new AiError('ИИ не дал ответа. Попробуйте ещё раз.');
    return text;
  } catch (err) {
    throw toAiError(err);
  }
}
