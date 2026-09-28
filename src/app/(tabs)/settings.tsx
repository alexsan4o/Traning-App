import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { SportIcon } from '../../components/WorkoutCard';
import { Button, Card, Chip, ChipGroup, Field, Notice, Screen, Segmented, Stepper } from '../../components/ui';
import { ALL_EQUIPMENT, ALL_LEVELS, equipmentLabels, levelLabels } from '../../data/labels';
import { SPORT_LIST } from '../../data/sports';
import { useOnline } from '../../hooks/useOnline';
import { AI_MODEL } from '../../lib/ai';
import { exportBackup } from '../../lib/catalog';
import { confirm, notify } from '../../lib/confirm';
import { clearApiKey, getApiKey, setApiKey } from '../../lib/secure';
import { shareText } from '../../lib/share';
import { DEFAULT_CATALOG_URL, useAppStore } from '../../store/useAppStore';
import { colors, font } from '../../theme';
import type { Equipment } from '../../types';

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <View style={{ flex: 1 }}>
        <Text style={font.body}>{label}</Text>
        {hint ? <Text style={font.small}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
        thumbColor={colors.text}
        accessibilityLabel={label}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const profile = useAppStore((s) => s.profile);
  const settings = useAppStore((s) => s.settings);
  const setProfile = useAppStore((s) => s.setProfile);
  const setSettings = useAppStore((s) => s.setSettings);
  const resetAll = useAppStore((s) => s.resetAll);
  const { connected } = useOnline();

  const [keyInput, setKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [catalogUrl, setCatalogUrl] = useState(settings.catalogUrl);

  useEffect(() => {
    getApiKey().then((k) => setHasKey(!!k));
  }, []);

  const toggleEquipment = (e: Equipment) =>
    setProfile({
      equipment: profile.equipment.includes(e) ? profile.equipment.filter((x) => x !== e) : [...profile.equipment, e],
    });

  const saveKey = async () => {
    try {
      await setApiKey(keyInput);
      setHasKey(!!keyInput.trim());
      setKeyInput('');
    } catch {
      notify('Не удалось сохранить ключ');
    }
  };

  const exportData = async () => {
    const s = useAppStore.getState();
    await shareText(exportBackup(s), 'Резервная копия Athlete Coach');
  };

  return (
    <Screen>
      <Text style={font.h1}>Профиль</Text>

      <Card>
        <Field label="Имя" value={profile.name} onChangeText={(name) => setProfile({ name })} placeholder="Ваше имя" />
        <Text style={[font.small, { marginTop: 6 }]}>Основной вид спорта</Text>
        <ChipGroup>
          {SPORT_LIST.map((s) => (
            <Chip
              key={s.id}
              label={s.name}
              color={s.color}
              selected={profile.sport === s.id}
              onPress={() => setProfile({ sport: s.id })}
              icon={<SportIcon sport={s.id} size={12} />}
            />
          ))}
        </ChipGroup>
        <Text style={[font.small, { marginTop: 6 }]}>Уровень</Text>
        <Segmented
          options={ALL_LEVELS.map((l) => ({ value: l, label: levelLabels[l] }))}
          value={profile.level}
          onChange={(level) => setProfile({ level })}
        />
        <View style={styles.toggle}>
          <Text style={[font.body, { flex: 1 }]}>Тренировок в неделю</Text>
          <Stepper value={profile.weeklyTarget} min={1} max={14} onChange={(weeklyTarget) => setProfile({ weeklyTarget })} />
        </View>
        <Text style={[font.small, { marginTop: 6 }]}>Оборудование</Text>
        <ChipGroup>
          {ALL_EQUIPMENT.map((e) => (
            <Chip key={e} label={equipmentLabels[e]} selected={profile.equipment.includes(e)} onPress={() => toggleEquipment(e)} />
          ))}
        </ChipGroup>
      </Card>

      <Card>
        <Text style={font.h3}>Интернет</Text>
        <Toggle
          label="Онлайн-функции"
          hint={`ИИ, онлайн-каталог, база wger.de · сеть: ${connected ? 'есть' : 'нет'}`}
          value={settings.onlineEnabled}
          onChange={(onlineEnabled) => setSettings({ onlineEnabled })}
        />
        <Text style={font.small}>
          Без интернета доступны все тренировки, таймер, счётчики, календарь, статистика и офлайн-генератор.
        </Text>
      </Card>

      <Card>
        <Text style={font.h3}>ИИ-тренер (Claude)</Text>
        <Toggle
          label="Генерировать с помощью ИИ"
          hint={`Модель ${AI_MODEL}. Без ключа или сети используется офлайн-генератор.`}
          value={settings.aiEnabled}
          onChange={(aiEnabled) => setSettings({ aiEnabled })}
        />
        <Notice
          icon={hasKey ? 'key' : 'key-outline'}
          color={hasKey ? colors.success : colors.warning}
          text={
            hasKey
              ? 'API-ключ сохранён в защищённом хранилище устройства.'
              : 'Добавьте API-ключ Anthropic (console.anthropic.com → API Keys). Ключ хранится только на этом устройстве.'
          }
        />
        <Field
          placeholder={hasKey ? 'Новый ключ (sk-ant-…)' : 'sk-ant-…'}
          value={keyInput}
          onChangeText={setKeyInput}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.row}>
          <Button title="Сохранить ключ" small style={{ flex: 1 }} disabled={!keyInput.trim()} onPress={saveKey} />
          {hasKey ? (
            <Button
              title="Удалить"
              small
              variant="danger"
              onPress={() => confirm('Удалить API-ключ?', 'ИИ-генерация станет недоступна до ввода нового ключа.', async () => {
                await clearApiKey();
                setHasKey(false);
              })}
            />
          ) : null}
        </View>
      </Card>

      <Card>
        <Text style={font.h3}>Онлайн-каталог тренировок</Text>
        <Field
          label="Адрес JSON-каталога"
          value={catalogUrl}
          onChangeText={setCatalogUrl}
          onEndEditing={() => setSettings({ catalogUrl: catalogUrl.trim() || DEFAULT_CATALOG_URL })}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Button
          title="Вернуть адрес по умолчанию"
          small
          variant="ghost"
          onPress={() => {
            setCatalogUrl(DEFAULT_CATALOG_URL);
            setSettings({ catalogUrl: DEFAULT_CATALOG_URL });
          }}
        />
      </Card>

      <Card>
        <Text style={font.h3}>Тренировка</Text>
        <View style={styles.toggle}>
          <Text style={[font.body, { flex: 1 }]}>Отдых по умолчанию</Text>
          <Stepper
            value={settings.defaultRestSec}
            step={15}
            min={0}
            max={600}
            suffix="с"
            onChange={(defaultRestSec) => setSettings({ defaultRestSec })}
          />
        </View>
        <Toggle label="Вибрация" value={settings.vibration} onChange={(vibration) => setSettings({ vibration })} />
        <Toggle label="Голосовые подсказки" hint="«Отдых окончен», обратный отсчёт" value={settings.voice} onChange={(voice) => setSettings({ voice })} />
        <Toggle label="Не гасить экран" hint="Во время тренировки" value={settings.keepAwake} onChange={(keepAwake) => setSettings({ keepAwake })} />
        <Toggle
          label="Уведомление об окончании отдыха"
          hint="Если приложение свёрнуто"
          value={settings.restNotifications}
          onChange={(restNotifications) => setSettings({ restNotifications })}
        />
      </Card>

      <Card>
        <Text style={font.h3}>Данные</Text>
        <Text style={font.small}>Все данные хранятся локально на устройстве. Сделайте резервную копию, чтобы перенести их.</Text>
        <Button title="Экспорт резервной копии" icon="share-outline" variant="secondary" onPress={exportData} />
        <Button title="Импорт тренировки или копии" icon="download-outline" variant="secondary" onPress={() => router.push('/import')} />
        <Button
          title="Удалить все данные"
          icon="trash-outline"
          variant="danger"
          onPress={() =>
            confirm('Удалить все данные?', 'Тренировки, история и настройки будут удалены без возможности восстановления.', () => {
              resetAll();
              router.replace('/onboarding');
            })
          }
        />
      </Card>

      <Text style={[font.small, { textAlign: 'center' }]}>Athlete Coach {Constants.expoConfig?.version ?? ''}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
});
