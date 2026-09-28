import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { SportIcon, WorkoutCard } from '../../components/WorkoutCard';
import { Button, Card, Chip, ChipGroup, EmptyState, Field, Notice, Screen, Segmented } from '../../components/ui';
import { BUILTIN_WORKOUTS } from '../../data/programs';
import { SPORT_LIST } from '../../data/sports';
import { useOnline } from '../../hooks/useOnline';
import { fetchCatalog } from '../../lib/catalog';
import { formatDateTime } from '../../lib/date';
import { useAppStore } from '../../store/useAppStore';
import { colors, font } from '../../theme';
import type { SportId, Workout } from '../../types';

type Tab = 'mine' | 'library' | 'online';

export default function Workouts() {
  const [tab, setTab] = useState<Tab>('library');
  const [query, setQuery] = useState('');
  const profileSport = useAppStore((s) => s.profile.sport);
  const [sport, setSport] = useState<SportId | 'all'>(profileSport);
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

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = source.filter(
      (w) =>
        (sport === 'all' || w.sport === sport || tab === 'mine') &&
        (!q || w.title.toLowerCase().includes(q) || w.exercises.some((e) => e.name.toLowerCase().includes(q))),
    );
    return [...filtered].sort((a, b) => Number(favoriteIds.includes(b.id)) - Number(favoriteIds.includes(a.id)));
  }, [source, query, sport, tab, favoriteIds]);

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
        <EmptyState icon="search-outline" title="Ничего не найдено" text="Попробуйте другой вид спорта или запрос." />
      )}
    </Screen>
  );
}
