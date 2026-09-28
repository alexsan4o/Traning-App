import catalogFile from '../catalog/workouts.json';
import { BUILTIN_WORKOUTS } from '../src/data/programs';
import { CatalogError, exportBackup, exportWorkout, fetchCatalog, normalizeWorkout, parseImport } from '../src/lib/catalog';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../src/store/useAppStore';

describe('нормализация тренировок', () => {
  it('дополняет ссылки на библиотеку и ограничивает значения', () => {
    const w = normalizeWorkout(
      {
        title: 'Тест',
        sport: 'karting',
        goal: 'strength',
        level: 'beginner',
        exercises: [
          { exerciseId: 'neck-isometric', sets: 99, durationSec: 1 },
          { name: 'Своё упражнение', kind: 'reps', reps: 12, sets: 2 },
          { name: 'Без типа' },
        ],
      },
      'imported',
    )!;
    expect(w.exercises).toHaveLength(2);
    expect(w.exercises[0]).toMatchObject({ name: 'Изометрия шеи (4 направления)', kind: 'time', sets: 20, durationSec: 5 });
    expect(w.exercises[0].tips?.length).toBeGreaterThan(0);
    expect(w.exercises[1]).toMatchObject({ name: 'Своё упражнение', reps: 12, sets: 2, category: 'strength' });
  });

  it('подставляет значения по умолчанию для неизвестного спорта и уровня', () => {
    const w = normalizeWorkout({ title: 'X', sport: 'chess', level: '???', goal: 1, exercises: [{ exerciseId: 'plank' }] }, 'online')!;
    expect(w).toMatchObject({ sport: 'general', level: 'intermediate', goal: 'strength' });
  });

  it('отклоняет тренировки без названия или упражнений', () => {
    expect(normalizeWorkout({ exercises: [{ exerciseId: 'plank' }] }, 'online')).toBeNull();
    expect(normalizeWorkout({ title: 'X', exercises: [] }, 'online')).toBeNull();
    expect(normalizeWorkout('мусор', 'online')).toBeNull();
  });
});

describe('экспорт и импорт', () => {
  it('тренировка переживает обмен без потерь', () => {
    const original = BUILTIN_WORKOUTS[0];
    const result = parseImport(exportWorkout(original));
    expect(result.kind).toBe('workout');
    if (result.kind !== 'workout') return;
    expect(result.workout.id).not.toBe(original.id);
    expect(result.workout.source).toBe('imported');
    expect(result.workout.title).toBe(original.title);
    expect(result.workout.exercises.map((e) => [e.exerciseId, e.sets, e.reps, e.durationSec, e.restSec])).toEqual(
      original.exercises.map((e) => [e.exerciseId, e.sets, e.reps, e.durationSec, e.restSec]),
    );
  });

  it('распознаёт резервную копию', () => {
    const json = exportBackup({
      profile: DEFAULT_PROFILE,
      settings: DEFAULT_SETTINGS,
      workouts: [BUILTIN_WORKOUTS[1]],
      favoriteIds: ['a'],
      sessions: [],
      schedule: [],
      activeSession: null,
      reactionResults: [],
      catalog: null,
    });
    const result = parseImport(json);
    expect(result.kind).toBe('backup');
    if (result.kind === 'backup') {
      expect(result.data.workouts).toHaveLength(1);
      expect(result.data.favoriteIds).toEqual(['a']);
    }
  });

  it('понятно сообщает об ошибке', () => {
    expect(() => parseImport('не json')).toThrow(CatalogError);
    expect(() => parseImport('{"title":"без упражнений"}')).toThrow(CatalogError);
  });
});

describe('загрузка онлайн-каталога', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('разбирает файл каталога из репозитория', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => catalogFile }) as unknown as typeof fetch;
    const workouts = await fetchCatalog('https://example.com/catalog.json');
    expect(workouts).toHaveLength(catalogFile.workouts.length);
    expect(workouts.every((w) => w.id.startsWith('online_') && w.source === 'online')).toBe(true);
  });

  it('сообщает о HTTP-ошибке и недоступной сети', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;
    await expect(fetchCatalog('https://example.com/x.json')).rejects.toThrow('HTTP 404');
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;
    await expect(fetchCatalog('https://example.com/x.json')).rejects.toThrow(CatalogError);
  });
});
