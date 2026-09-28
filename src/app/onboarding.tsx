import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { LevelPicker } from '../components/LevelPicker';
import { SportIcon } from '../components/WorkoutCard';
import { Button, Card, Chip, ChipGroup, Field, Screen, Stepper } from '../components/ui';
import { ALL_EQUIPMENT, equipmentLabels } from '../data/labels';
import { SPORT_LIST } from '../data/sports';
import { useAppStore } from '../store/useAppStore';
import { font } from '../theme';
import type { Equipment, Experience, Level, SportId } from '../types';

export default function Onboarding() {
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  const [name, setName] = useState(profile.name);
  const [sport, setSport] = useState<SportId>(profile.sport);
  const [level, setLevel] = useState<Level>(profile.level);
  const [experience, setExperience] = useState<Experience | undefined>(profile.experience);
  const [equipment, setEquipment] = useState<Equipment[]>(profile.equipment);
  const [weeklyTarget, setWeeklyTarget] = useState(profile.weeklyTarget);

  const toggleEquipment = (e: Equipment) =>
    setEquipment((cur) => (cur.includes(e) ? cur.filter((x) => x !== e) : [...cur, e]));

  const finish = () => {
    setProfile({ name: name.trim(), sport, level, experience, equipment, weeklyTarget, onboarded: true });
    router.replace('/');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ gap: 6, marginTop: 12 }}>
        <Text style={font.h1}>Athlete Coach</Text>
        <Text style={font.dim}>
          Тренировки для спортсменов: готовые программы, генерация с ИИ, таймер отдыха, счётчик подходов и календарь.
          Работает и без интернета.
        </Text>
      </View>

      <Field label="Как вас зовут?" placeholder="Имя (необязательно)" value={name} onChangeText={setName} />

      <Card>
        <Text style={font.h3}>Ваш вид спорта</Text>
        <ChipGroup>
          {SPORT_LIST.map((s) => (
            <Chip
              key={s.id}
              label={s.name}
              selected={sport === s.id}
              color={s.color}
              onPress={() => setSport(s.id)}
              icon={<SportIcon sport={s.id} size={14} />}
            />
          ))}
        </ChipGroup>
      </Card>

      <Card>
        <Text style={font.h3}>Уровень подготовки</Text>
        <Text style={font.dim}>Сколько вы тренируетесь регулярно? Уровень определится по стажу.</Text>
        <LevelPicker
          experience={experience}
          level={level}
          onChange={(p) => {
            setExperience(p.experience);
            setLevel(p.level);
          }}
        />
      </Card>

      <Card>
        <Text style={font.h3}>Доступное оборудование</Text>
        <Text style={font.dim}>Генератор подберёт упражнения только под то, что у вас есть.</Text>
        <ChipGroup>
          {ALL_EQUIPMENT.map((e) => (
            <Chip key={e} label={equipmentLabels[e]} selected={equipment.includes(e)} onPress={() => toggleEquipment(e)} />
          ))}
        </ChipGroup>
      </Card>

      <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={font.h3}>Цель на неделю</Text>
          <Text style={font.dim}>Тренировок в неделю</Text>
        </View>
        <Stepper value={weeklyTarget} onChange={setWeeklyTarget} min={1} max={14} />
      </Card>

      <Button title="Начать тренироваться" icon="arrow-forward" onPress={finish} />
    </Screen>
  );
}
