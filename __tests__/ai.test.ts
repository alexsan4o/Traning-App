import { AiError, askCoach, generateWithAi, mapAiWorkout, type AiWorkout } from '../src/lib/ai';
import { BUILTIN_WORKOUTS } from '../src/data/programs';
import type { GenerateRequest } from '../src/lib/generator';

const req: GenerateRequest = { sport: 'karting', goal: 'strength', level: 'intermediate', durationMin: 40, equipment: ['bands'] };

const aiWorkout: AiWorkout = {
  title: 'Шея и кор пилота',
  description: 'Укрепляем шею и корпус.',
  tips: ['Не работайте через боль.'],
  exercises: [
    {
      library_id: 'neck-isometric',
      name: 'Изометрия шеи',
      category: 'strength',
      kind: 'reps', // библиотека знает, что это упражнение на время
      muscles: [],
      sets: 50,
      reps: null,
      duration_sec: 20,
      rest_sec: 5000,
      per_side: false,
      weight_kg: null,
      tips: ['Плавно наращивайте усилие.'],
    },
    {
      library_id: null,
      name: 'Удержание руля с резинкой',
      category: 'core',
      kind: 'time',
      muscles: ['forearms', 'core'],
      sets: 3,
      reps: null,
      duration_sec: null,
      rest_sec: 45,
      per_side: false,
      weight_kg: 2.3,
      tips: ['Локти слегка согнуты.'],
    },
  ],
};

let keyCounter = 0;
const freshKey = () => `sk-ant-test-${++keyCounter}`;

function apiResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } });
}

function message(content: unknown[], stopReason = 'end_turn') {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5',
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 200 },
  };
}

describe('ИИ-генерация (Claude)', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('сопоставляет ответ с библиотекой и ограничивает значения', () => {
    const w = mapAiWorkout(aiWorkout, req);
    expect(w.source).toBe('ai');
    expect(w.exercises[0]).toMatchObject({
      exerciseId: 'neck-isometric',
      name: 'Изометрия шеи (4 направления)',
      kind: 'time',
      muscles: ['neck'],
      sets: 10,
      durationSec: 20,
      restSec: 600,
    });
    expect(w.exercises[0].tips?.[0]).toBe('Плавно наращивайте усилие.');
    expect(w.exercises[1]).toMatchObject({ kind: 'time', durationSec: 30, weightKg: 2.5, category: 'core' });
    expect(w.exercises[1].exerciseId.startsWith('ai_')).toBe(true);
  });

  it('отправляет структурированный запрос и разбирает ответ', async () => {
    const fetchMock = jest.fn().mockResolvedValue(apiResponse(message([{ type: 'text', text: JSON.stringify(aiWorkout) }])));
    global.fetch = fetchMock as unknown as typeof fetch;

    const w = await generateWithAi(freshKey(), { ...req, wishes: 'гонка в субботу' });
    expect(w.title).toBe('Шея и кор пилота');
    expect(w.exercises).toHaveLength(2);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/v1/messages');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('claude-opus-5');
    expect(body.fallbacks).toBe('default');
    expect(body.output_config.effort).toBe('medium');
    expect(body.output_config.format.type).toBe('json_schema');
    expect(body.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(body.messages[0].content).toContain('Картинг');
    expect(body.messages[0].content).toContain('гонка в субботу');
    const headers = new Headers(init.headers);
    expect(headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
  });

  it('обрабатывает отказ модели', async () => {
    global.fetch = jest.fn().mockResolvedValue(apiResponse(message([], 'refusal'))) as unknown as typeof fetch;
    await expect(generateWithAi(freshKey(), req)).rejects.toThrow(AiError);
  });

  it('переводит ошибку авторизации в понятное сообщение', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(apiResponse({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 401)) as unknown as typeof fetch;
    await expect(generateWithAi(freshKey(), req)).rejects.toThrow('Неверный API-ключ');
  });

  it('отвечает на вопрос о тренировке', async () => {
    const fetchMock = jest.fn().mockResolvedValue(apiResponse(message([{ type: 'text', text: 'Замените прыжки на зашагивания.' }])));
    global.fetch = fetchMock as unknown as typeof fetch;
    const answer = await askCoach(freshKey(), BUILTIN_WORKOUTS[0], 'Чем заменить прыжки?');
    expect(answer).toBe('Замените прыжки на зашагивания.');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.output_config.effort).toBe('low');
  });
});
