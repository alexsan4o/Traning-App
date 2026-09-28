import { parseExerciseInfo, parseSearch, stripHtml } from '../src/lib/wger';

describe('клиент wger.de', () => {
  it('разбирает результаты поиска и убирает дубликаты', () => {
    const result = parseSearch({
      suggestions: [
        { value: 'Squats', data: { id: 10, base_id: 111, name: 'Squats', category: 'Legs', image_thumbnail: '/media/t.png' } },
        { value: 'Squats', data: { id: 11, base_id: 111, name: 'Squats', category: 'Legs' } },
        { value: 'Приседания', data: { id: 12, base_id: 222, name: 'Приседания', category: 'Ноги', image: null } },
        { value: 'broken', data: {} },
      ],
    });
    expect(result).toEqual([
      { baseId: 111, name: 'Squats', category: 'Legs', thumbnail: 'https://wger.de/media/t.png' },
      { baseId: 222, name: 'Приседания', category: 'Ноги', thumbnail: undefined },
    ]);
    expect(parseSearch({})).toEqual([]);
    expect(parseSearch(null)).toEqual([]);
  });

  it('разбирает упражнение с переводами (новый формат API)', () => {
    const ex = parseExerciseInfo({
      id: 73,
      category: { id: 9, name: 'Legs' },
      muscles: [{ id: 10, name: 'Quadriceps femoris', name_en: 'Quads' }],
      muscles_secondary: [{ id: 8, name: 'Gluteus maximus', name_en: 'Glutes' }],
      equipment: [{ id: 3, name: 'Dumbbell' }, { id: 7, name: 'none (bodyweight exercise)' }],
      images: [{ image: 'https://wger.de/media/a.png', is_main: true }],
      translations: [
        { name: 'Goblet squat', description: '<p>Hold the dumbbell at chest.</p>', language: 2 },
        { name: 'Гоблет-присед', description: '<p>Держите гантель у груди. Спина прямая, колени наружу.</p>', language: 5 },
      ],
    })!;
    expect(ex).toMatchObject({
      id: 'wger_73',
      name: 'Гоблет-присед',
      category: 'strength',
      kind: 'reps',
      muscles: ['quads', 'glutes'],
      equipment: ['dumbbells'],
      source: 'wger',
      imageUrl: 'https://wger.de/media/a.png',
    });
    expect(ex.tips).toEqual(['Держите гантель у груди.', 'Спина прямая, колени наружу.']);
  });

  it('поддерживает старый формат (exercises вместо translations) и кардио', () => {
    const ex = parseExerciseInfo({
      id: 5,
      category: { name: 'Cardio' },
      exercises: [{ name: 'Rowing', description: '', language: 2 }],
    })!;
    expect(ex).toMatchObject({ name: 'Rowing', category: 'endurance', kind: 'time', muscles: ['core'] });
    expect(parseExerciseInfo({ id: 1, translations: [] })).toBeNull();
    expect(parseExerciseInfo({})).toBeNull();
  });

  it('очищает HTML', () => {
    expect(stripHtml('<p>Раз&nbsp;два</p><ul><li>A</li><li>B</li></ul>')).toBe('Раз два\nA\nB');
  });
});
