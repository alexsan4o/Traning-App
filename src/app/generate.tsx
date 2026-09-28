import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { ExerciseItem } from '../components/ExerciseItem';
import { WorkoutTimeline } from '../components/WorkoutTimeline';
import { SportIcon } from '../components/WorkoutCard';
import { Badge, Button, Card, Chip, ChipGroup, Field, Notice, Screen, Segmented } from '../components/ui';
import { ALL_EQUIPMENT, ALL_GOALS, ALL_LEVELS, ALL_MUSCLES, equipmentLabels, goalLabels, levelLabels, muscleLabels } from '../data/labels';
import { SPORT_LIST, SPORTS } from '../data/sports';
import { useOnline } from '../hooks/useOnline';
import { AiError, generateWithAi } from '../lib/ai';
import { generateWorkout, type GenerateRequest } from '../lib/generator';
import { getApiKey } from '../lib/secure';
import { estimateMinutes } from '../lib/workout';
import { useAppStore } from '../store/useAppStore';
import { colors, font } from '../theme';
import type { Equipment, Goal, Level, MuscleGroup, SportId, Workout } from '../types';

const DURATIONS = [15, 30, 45, 60, 90];

export default function Generate() {
  const profile = useAppStore((s) => s.profile);
  const settings = useAppStore((s) => s.settings);
  const sessions = useAppStore((s) => s.sessions);
  const saveWorkout = useAppStore((s) => s.saveWorkout);
  const { online } = useOnline();

  const [sport, setSport] = useState<SportId>(profile.sport);
  const [goal, setGoal] = useState<Goal>(SPORTS[profile.sport].defaultGoals[0]);
  const [level, setLevel] = useState<Level>(profile.level);
  const [duration, setDuration] = useState(45);
  const [equipment, setEquipment] = useState<Equipment[]>(profile.equipment);
  const [focus, setFocus] = useState<MuscleGroup[]>([]);
  const [wishes, setWishes] = useState('');
  const [apiKey, setKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Workout | null>(null);

  useEffect(() => {
    getApiKey().then(setKey);
  }, []);

  const aiAvailable = settings.aiEnabled && online && !!apiKey;
  const aiReason = !settings.aiEnabled
    ? 'ИИ выключен в профиле.'
    : !online
      ? 'Нет интернета или онлайн-функции выключены.'
      : !apiKey
        ? 'Добавьте API-ключ Anthropic в профиле, чтобы генерировать с ИИ.'
        : null;

  const request = (): GenerateRequest => ({ sport, goal, level, durationMin: duration, equipment, focus });

  const run = async (forceOffline = false) => {
    setError(null);
    setResult(null);
    if (!aiAvailable || forceOffline) {
      setResult(generateWorkout(request()));
      return;
    }
    setLoading(true);
    try {
      const w = await generateWithAi(apiKey!, {
        ...request(),
        wishes,
        recentSessions: sessions.slice(0, 5).map((s) => ({ title: s.title, finishedAt: s.finishedAt, rpe: s.rpe })),
      });
      setResult(w);
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Не удалось сгенерировать тренировку.');
    } finally {
      setLoading(false);
    }
  };

  const save = (thenStart: boolean) => {
    if (!result) return;
    saveWorkout(result);
    if (thenStart) router.replace({ pathname: '/workout/play', params: { id: result.id } });
    else router.replace(`/workout/${result.id}`);
  };

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <Screen edges={[]}>
      <Notice
        icon={aiAvailable ? 'sparkles' : 'hardware-chip-outline'}
        color={aiAvailable ? colors.accent : colors.textDim}
        text={aiAvailable ? 'Тренировку составит ИИ-тренер Claude с учётом ваших пожеланий и истории.' : `Офлайн-генератор. ${aiReason ?? ''}`}
      />

      <Card>
        <Text style={font.h3}>Вид спорта</Text>
        <ChipGroup>
          {SPORT_LIST.map((s) => (
            <Chip
              key={s.id}
              label={s.name}
              color={s.color}
              selected={sport === s.id}
              onPress={() => {
                setSport(s.id);
                setGoal(s.defaultGoals[0]);
              }}
              icon={<SportIcon sport={s.id} size={12} />}
            />
          ))}
        </ChipGroup>
        <Text style={font.h3}>Цель</Text>
        <ChipGroup>
          {ALL_GOALS.map((g) => (
            <Chip key={g} label={goalLabels[g]} selected={goal === g} onPress={() => setGoal(g)} />
          ))}
        </ChipGroup>
        <Text style={font.small}>Рекомендуется для спорта: {SPORTS[sport].defaultGoals.map((g) => goalLabels[g].toLowerCase()).join(', ')}</Text>
      </Card>

      <Card>
        <Text style={font.h3}>Уровень и время</Text>
        <Segmented options={ALL_LEVELS.map((l) => ({ value: l, label: levelLabels[l] }))} value={level} onChange={setLevel} />
        <ChipGroup>
          {DURATIONS.map((d) => (
            <Chip key={d} label={`${d} мин`} selected={duration === d} onPress={() => setDuration(d)} />
          ))}
        </ChipGroup>
      </Card>

      <Card>
        <Text style={font.h3}>Оборудование</Text>
        <ChipGroup>
          {ALL_EQUIPMENT.map((e) => (
            <Chip key={e} label={equipmentLabels[e]} selected={equipment.includes(e)} onPress={() => setEquipment(toggle(equipment, e))} />
          ))}
        </ChipGroup>
        <Text style={font.h3}>Акцент на мышцы (необязательно)</Text>
        <ChipGroup>
          {ALL_MUSCLES.map((m) => (
            <Chip key={m} label={muscleLabels[m]} selected={focus.includes(m)} onPress={() => setFocus(toggle(focus, m))} />
          ))}
        </ChipGroup>
      </Card>

      {aiAvailable ? (
        <Field
          label="Пожелания ИИ-тренеру"
          placeholder="Например: гонка в субботу, болит колено — без прыжков"
          value={wishes}
          onChangeText={setWishes}
          multiline
          style={{ minHeight: 70, textAlignVertical: 'top' }}
        />
      ) : null}

      <Button
        title={loading ? 'ИИ составляет тренировку…' : result ? 'Сгенерировать заново' : 'Сгенерировать'}
        icon="sparkles"
        loading={loading}
        onPress={() => run()}
      />

      {error ? (
        <Card style={{ borderColor: colors.danger }}>
          <Notice icon="alert-circle-outline" color={colors.danger} text={error} />
          <Button title="Сгенерировать офлайн" icon="hardware-chip-outline" variant="secondary" onPress={() => run(true)} />
        </Card>
      ) : null}

      {result ? (
        <Card>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <SportIcon sport={result.sport} />
            <View style={{ flex: 1 }}>
              <Text style={font.h2}>{result.title}</Text>
              <Text style={font.dim}>
                ~{estimateMinutes(result)} мин · {result.exercises.length} упражнений
              </Text>
            </View>
          </View>
          <Badge label={result.source === 'ai' ? 'ИИ (Claude)' : 'Офлайн-генератор'} color={result.source === 'ai' ? colors.accent : colors.textDim} />
          {result.description ? <Text style={font.dim}>{result.description}</Text> : null}
          <WorkoutTimeline workout={result} />
          {result.exercises.map((e, i) => (
            <ExerciseItem key={e.uid} item={e} index={i} />
          ))}
          {result.tips.length ? (
            <View style={{ gap: 4 }}>
              <Text style={font.h3}>Советы</Text>
              {result.tips.map((t) => (
                <Text key={t} style={font.body}>
                  • {t}
                </Text>
              ))}
            </View>
          ) : null}
          <Button title="Сохранить и начать" icon="play" onPress={() => save(true)} />
          <Button title="Сохранить" icon="bookmark-outline" variant="secondary" onPress={() => save(false)} />
        </Card>
      ) : null}
    </Screen>
  );
}
