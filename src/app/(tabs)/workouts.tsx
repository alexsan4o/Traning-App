import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { SportIcon, WorkoutCard } from '../../components/WorkoutCard';
import { Button, Card, Chip, ChipGroup, EmptyState, Field, Notice, Screen, Segmented } from '../../components/ui';
import { ALL_GOALS, ALL_LEVELS, goalLabels, levelLabels } from '../../data/labels';
import { BUILTIN_WORKOUTS } from '../../data/programs';
import { SPORT_LIST, SPORTS } from '../../data/sports';
import { useOnline } from '../../hooks/useOnline';
import { fetchCatalog } from '../../lib/catalog';
import { formatDateTime } from '../../lib/date';
import { useAppStore } from '../../store/useAppStore';
import { colors, font } from '../../theme';
import type { Goal, Level, SportId, Workout } from '../../types';

type Tab = 'mine' | 'library' | 'online';

export default function Workouts() {
  const params = useLocalSearchParams<{ sport?: SportId; goal?: Goal }>();
  const [tab, setTab] = useState<Tab>('library');
  const [query, setQuery] = useState('');
  const profileSport = useAppStore((s) => s.profile.sport);
  const profileLevel = useAppStore((s) => s.profile.level);
  const [sport, setSport] = useState<SportId | 'all'>(params.sport ?? profileSport);
  const [goal, setGoal] = useState<Goal | 'all'>(params.goal ?? 'all');
  const [level, setLevel] = useState<Level | 'all'>('all');
  // Переход с главной («Классические программы») открывает библиотеку с нужными фильтрами.
  const paramsKey = `${params.sport ?? ''}|${params.goal ?? ''}`;
  const [prevParamsKey, setPrevParamsKey] = useState(paramsKey);
  if (paramsKey !== prevParamsKey) {
    setPrevParamsKey(paramsKey);
    if (params.sport || params.goal) {
      setTab('library');
      setSport(params.sport ?? 'all');
      setGoal(params.goal ?? 'all');
    }
  }
  const workouts = useAppStore((s) => s.workouts);
  const favoriteIds = useAppStore((s) => s.favoriteIds);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const catalog = useAppStore((s) => s.catalog);
  const setCatalog = useAppStore((s) => s.setCatalog);
  const catalogUrl = useAppStore((s) => s.settings.catalogUrl);
  const { online, allowed } = useOnline();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const source: Workout[] = useMemo(
    () => (tab === 'mine' ? workouts : tab === 'library' ? BUILTIN_WORKOUTS : catalog?.workouts ?? []),
    [tab, workouts, catalog],
  );

  const bySport = useMemo(
    () => (tab === 'mine' || sport === 'all' ? source : source.filter((w) => w.sport === sport)),
    [source, sport, tab],
  );
  // Показываем только цели, для которых в выбранном разделе есть программы.
  const goals = useMemo(() => {
    const present = ALL_GOALS.filter((g) => bySport.some((w) => w.goal === g));
    if (sport === 'all' || tab === 'mine') return present;
    // Сначала основные цели выбранного вида спорта (для фитнеса — масса, похудение, рельеф).
    const main = SPORTS[sport].defaultGoals;
    return [...present.filter((g) => main.includes(g)), ...present.filter((g) => !main.includes(g))];
  }, [bySport, sport, tab]);
  const activeGoal = goal !== 'all' && goals.includes(goal) ? goal : 'all';

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = bySport.filter(
      (w) =>
        (activeGoal === 'all' || w.goal === activeGoal) &&
        (level === 'all' || w.level === level) &&
        (!q || w.title.toLowerCase().includes(q) || w.exercises.some((e) => e.name.toLowerCase().includes(q))),
    );
    return [...filtered].sort((a, b) => Number(favoriteIds.includes(b.id)) - Number(favoriteIds.includes(a.id)));
  }, [bySport, query, activeGoal, level, favoriteIds]);

  const refreshCatalog = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchCatalog(catalogUrl);
      setCatalog({ fetchedAt: new Date().toISOString(), url: catalogUrl, workouts: items });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить каталог.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Text style={font.h1}>Тренировки</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button title="Сгенерировать" icon="sparkles" style={{ flex: 1 }} onPress={() => router.push('/generate')} />
        <Button title="Создать" icon="add" variant="secondary" onPress={() => router.push('/workout/edit')} />
        <Button title="" accessibilityLabel="Импорт" icon="download-outline" variant="secondary" onPress={() => router.push('/import')} />
      </View>

      <Segmented<Tab>
        options={[
          { value: 'mine', label: `Мои (${workouts.length})` },
          { value: 'library', label: 'Библиотека' },
          { value: 'online', label: 'Онлайн' },
        ]}
        value={tab}
        onChange={setTab}
      />

      <Field placeholder="Поиск по названию или упражнению" value={query} onChangeText={setQuery} />

      {tab !== 'mine' ? (
        <ChipGroup>
          <Chip label="Все" selected={sport === 'all'} onPress={() => setSport('all')} />
          {SPORT_LIST.map((s) => (
            <Chip
              key={s.id}
              label={s.name}
              color={s.color}
              selected={sport === s.id}
              onPress={() => setSport(s.id)}
              icon={<SportIcon sport={s.id} size={12} />}
            />
          ))}
        </ChipGroup>
      ) : null}

      {goals.length > 1 ? (
        <ChipGroup>
          <Chip label="Любая цель" selected={activeGoal === 'all'} onPress={() => setGoal('all')} />
          {goals.map((g) => (
            <Chip key={g} label={goalLabels[g]} selected={activeGoal === g} onPress={() => setGoal(g)} />
          ))}
        </ChipGroup>
      ) : null}

      <ChipGroup>
        <Chip label="Любой уровень" selected={level === 'all'} onPress={() => setLevel('all')} />
        {ALL_LEVELS.map((l) => (
          <Chip
            key={l}
            label={l === profileLevel ? `${levelLabels[l]} · мой` : levelLabels[l]}
            selected={level === l}
            onPress={() => setLevel(l)}
          />
        ))}
      </ChipGroup>

      {tab === 'online' ? (
        <Card>
          <Text style={font.h3}>Онлайн-каталог</Text>
          <Text style={font.dim}>
            {catalog
              ? `Загружено ${formatDateTime(catalog.fetchedAt)} · ${catalog.workouts.length} тренировок. Доступно и офлайн.`
              : 'Готовые программы из интернета. После загрузки они доступны без сети.'}
          </Text>
          {!allowed ? <Notice icon="cloud-offline-outline" text="Онлайн-функции выключены в профиле." color={colors.textDim} /> : null}
          {error ? <Notice icon="alert-circle-outline" text={error} color={colors.danger} /> : null}
          <Button
            title={catalog ? 'Обновить каталог' : 'Загрузить каталог'}
            icon="cloud-download-outline"
            variant="secondary"
            loading={loading}
            disabled={!online}
            onPress={refreshCatalog}
          />
        </Card>
      ) : null}

      {list.length ? (
        list.map((w) => (
          <WorkoutCard
            key={w.id}
            workout={w}
            favorite={favoriteIds.includes(w.id)}
            onToggleFavorite={() => toggleFavorite(w.id)}
            onPress={() => router.push(`/workout/${w.id}`)}
          />
        ))
      ) : tab === 'mine' ? (
        <EmptyState
          icon="barbell-outline"
          title="Здесь будут ваши тренировки"
          text="Сгенерируйте тренировку, соберите свою в конструкторе или сохраните копию из библиотеки."
        />
      ) : (
        <EmptyState icon="search-outline" title="Ничего не найдено" text="Попробуйте другой вид спорта, цель, уровень или запрос." />
      )}
    </Screen>
  );
}
