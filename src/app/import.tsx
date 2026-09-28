import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button, Field, Notice, Screen } from '../components/ui';
import { CatalogError, parseImport } from '../lib/catalog';
import { confirm, notify } from '../lib/confirm';
import { useAppStore } from '../store/useAppStore';
import { colors, font } from '../theme';

export default function ImportScreen() {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const saveWorkout = useAppStore((s) => s.saveWorkout);
  const importData = useAppStore((s) => s.importData);

  const paste = async () => {
    try {
      setText(await Clipboard.getStringAsync());
    } catch {
      setError('Не удалось прочитать буфер обмена. Вставьте текст вручную.');
    }
  };

  const run = () => {
    setError(null);
    try {
      const result = parseImport(text);
      if (result.kind === 'workout') {
        saveWorkout(result.workout);
        router.replace(`/workout/${result.workout.id}`);
      } else {
        confirm(
          'Импортировать резервную копию?',
          `Тренировок: ${result.data.workouts?.length ?? 0}, записей: ${result.data.sessions?.length ?? 0}. Данные объединятся с текущими.`,
          () => {
            importData(result.data);
            notify('Готово', 'Данные импортированы.');
            router.back();
          },
          'Импортировать',
        );
      }
    } catch (e) {
      setError(e instanceof CatalogError ? e.message : 'Не удалось импортировать данные.');
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Text style={font.dim}>
        Вставьте тренировку, которой с вами поделились (кнопка «Поделиться» в тренировке), JSON из интернета или резервную
        копию из профиля.
      </Text>
      <Button title="Вставить из буфера" icon="clipboard-outline" variant="secondary" onPress={paste} />
      <Field
        placeholder='{"app":"athlete-coach","type":"workout",…}'
        value={text}
        onChangeText={setText}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        style={{ minHeight: 180, textAlignVertical: 'top', fontFamily: 'monospace', fontSize: 13 }}
      />
      {error ? <Notice icon="alert-circle-outline" color={colors.danger} text={error} /> : null}
      <Button title="Импортировать" icon="download-outline" disabled={!text.trim()} onPress={run} />
    </Screen>
  );
}
