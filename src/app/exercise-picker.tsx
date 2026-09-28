import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Chip, ChipGroup, EmptyState, Field, Notice, Screen, Segmented } from '../components/ui';
import { BUILTIN_EXERCISES } from '../data/exercises';
import { ALL_CATEGORIES, categoryLabels, equipmentLabels, muscleLabels } from '../data/labels';
import { useOnline } from '../hooks/useOnline';
import { fetchWgerExercise, searchWger, type WgerSuggestion } from '../lib/wger';
import { fromExercise } from '../lib/workout';
import { useAppStore } from '../store/useAppStore';
import { useDraftStore } from '../store/useDraftStore';
import { chart, colors, font, phaseOf, radius, spacing } from '../theme';
import type { Category, Exercise } from '../types';

type Source = 'library' | 'wger';

export default function ExercisePicker() {
  const addExercises = useDraftStore((s) => s.addExercises);
  const hasDraft = useDraftStore((s) => !!s.draft);
  const profile = useAppStore((s) => s.profile);
  const defaultRest = useAppStore((s) => s.settings.defaultRestSec);
  const { online } = useOnline();

  const [source, setSource] = useState<Source>('library');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [onlyMine, setOnlyMine] = useState(true);
  const [selected, setSelected] = useState<Exercise[]>([]);
  const [wgerResults, setWgerResults] = useState<WgerSuggestion[]>([]);
  const [wgerLoading, setWgerLoading] = useState(false);
  const [wgerError, setWgerError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const library = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BUILTIN_EXERCISES.filter(
      (e) =>
        (category === 'all' || e.category === category) &&
        (!onlyMine || e.equipment.every((x) => profile.equipment.includes(x))) &&
        (!q || e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)),
    ).sort((a, b) => Number(b.sports.includes(profile.sport)) - Number(a.sports.includes(profile.sport)));
  }, [query, category, onlyMine, profile]);

  useEffect(() => {
    if (source !== 'wger' || !online || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setWgerLoading(true);
      setWgerError(null);
      try {
        setWgerResults(await searchWger(query, controller.signal));
      } catch {
        if (!controller.signal.aborted) setWgerError('База wger.de недоступна. Попробуйте позже.');
      } finally {
        if (!controller.signal.aborted) setWgerLoading(false);
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, source, online]);

  const searchActive = source === 'wger' && online && query.trim().length >= 2;
  const visibleResults = searchActive ? wgerResults : [];

  const isSelected = (id: string) => selected.some((e) => e.id === id);
  const toggle = (e: Exercise) => setSelected((cur) => (isSelected(e.id) ? cur.filter((x) => x.id !== e.id) : [...cur, e]));

  const addWger = async (s: WgerSuggestion) => {
    const id = `wger_${s.baseId}`;
    if (isSelected(id)) return setSelected((cur) => cur.filter((x) => x.id !== id));
    setLoadingId(s.baseId);
    try {
      toggle(await fetchWgerExercise(s.baseId));
    } catch {
      setWgerError('Не удалось загрузить упражнение из wger.de.');
    } finally {
      setLoadingId(null);
    }
  };

  const confirm = () => {
    addExercises(selected.map((e) => fromExercise(e, { restSec: defaultRest })));
    router.back();
  };

  if (!hasDraft) {
    return (
      <Screen edges={[]}>
        <EmptyState icon="construct-outline" title="Откройте конструктор" text="Выбор упражнений работает из конструктора тренировки." />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen edges={[]}>
        <Segmented<Source>
          options={[
            { value: 'library', label: `Библиотека (${BUILTIN_EXERCISES.length})` },
            { value: 'wger', label: 'wger.de (онлайн)' },
          ]}
          value={source}
          onChange={setSource}
        />
        <Field
          placeholder={source === 'library' ? 'Поиск упражнения' : 'Название на русском или английском'}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />

        {source === 'library' ? (
          <>
            <ChipGroup>
              <Chip label="Только моё оборудование" selected={onlyMine} onPress={() => setOnlyMine(!onlyMine)} />
              <Chip label="Все типы" selected={category === 'all'} onPress={() => setCategory('all')} />
              {ALL_CATEGORIES.map((c) => (
                <Chip key={c} label={categoryLabels[c]} selected={category === c} onPress={() => setCategory(c)} />
              ))}
            </ChipGroup>
            {library.map((e) => (
              <Pressable key={e.id} onPress={() => toggle(e)} style={[styles.row, isSelected(e.id) && styles.rowSelected]}>
                <Ionicons
                  name={isSelected(e.id) ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={isSelected(e.id) ? colors.primary : colors.textFaint}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={[styles.phaseDot, { backgroundColor: chart.phase[phaseOf(e.category)] }]} />
                    <Text style={[font.body, { fontWeight: '600', flex: 1 }]}>{e.name}</Text>
                  </View>
                  <Text style={font.small}>
                    {categoryLabels[e.category]} · {e.muscles.map((m) => muscleLabels[m]).join(', ')}
                    {e.equipment.length ? ` · ${e.equipment.map((q) => equipmentLabels[q]).join(', ')}` : ''}
                  </Text>
                </View>
                <Pressable hitSlop={8} onPress={() => router.push(`/exercise/${e.id}`)} accessibilityLabel="Подробнее">
                  <Ionicons name="information-circle-outline" size={22} color={colors.textDim} />
                </Pressable>
              </Pressable>
            ))}
            {!library.length ? <EmptyState icon="search-outline" title="Ничего не найдено" text="Снимите фильтр оборудования или измените запрос." /> : null}
          </>
        ) : (
          <>
            {!online ? (
              <Notice icon="cloud-offline-outline" color={colors.textDim} text="Поиск в wger.de доступен только онлайн." />
            ) : (
              <Notice text="Открытая база упражнений wger.de. Введите минимум 2 символа." />
            )}
            {searchActive && wgerLoading ? <ActivityIndicator color={colors.primary} /> : null}
            {wgerError ? <Notice icon="alert-circle-outline" color={colors.danger} text={wgerError} /> : null}
            {visibleResults.map((s) => {
              const id = `wger_${s.baseId}`;
              return (
                <Pressable key={s.baseId} onPress={() => addWger(s)} style={[styles.row, isSelected(id) && styles.rowSelected]}>
                  {loadingId === s.baseId ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Ionicons
                      name={isSelected(id) ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={isSelected(id) ? colors.primary : colors.textFaint}
                    />
                  )}
                  {s.thumbnail ? <Image source={{ uri: s.thumbnail }} style={styles.thumb} /> : null}
                  <View style={{ flex: 1 }}>
                    <Text style={[font.body, { fontWeight: '600' }]}>{s.name}</Text>
                    {s.category ? <Text style={font.small}>{s.category}</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </>
        )}
      </Screen>
      <View style={styles.footer}>
        <Button title={`Добавить (${selected.length})`} icon="add" disabled={!selected.length} onPress={confirm} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowSelected: { borderColor: colors.primary },
  phaseDot: { width: 8, height: 8, borderRadius: 4 },
  thumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.surfaceAlt },
  footer: { padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.bg },
});
