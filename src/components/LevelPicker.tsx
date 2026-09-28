import { Text } from 'react-native';

import { ALL_EXPERIENCE, ALL_LEVELS, experienceLabels, levelDescriptions, levelFromExperience, levelLabels } from '../data/labels';
import { font } from '../theme';
import type { Experience, Level } from '../types';
import { Chip, ChipGroup, Segmented } from './ui';

/**
 * Выбор уровня по тренировочному стажу: стаж задаёт уровень автоматически,
 * но его можно поправить вручную (например, после долгого перерыва).
 */
export function LevelPicker({
  experience,
  level,
  onChange,
}: {
  experience?: Experience;
  level: Level;
  onChange: (patch: { experience?: Experience; level: Level }) => void;
}) {
  const suggested = experience ? levelFromExperience(experience) : undefined;
  return (
    <>
      <Text style={font.small}>Тренировочный стаж</Text>
      <ChipGroup>
        {ALL_EXPERIENCE.map((x) => (
          <Chip key={x} label={experienceLabels[x]} selected={experience === x} onPress={() => onChange({ experience: x, level: levelFromExperience(x) })} />
        ))}
      </ChipGroup>
      <Text style={font.small}>Уровень</Text>
      <Segmented
        options={ALL_LEVELS.map((l) => ({ value: l, label: levelLabels[l] }))}
        value={level}
        onChange={(l) => onChange({ experience, level: l })}
      />
      <Text style={font.dim}>{levelDescriptions[level]}</Text>
      {suggested && suggested !== level ? (
        <Text style={font.small}>
          По стажу рекомендуем «{levelLabels[suggested]}». Выбран другой уровень — программы будут подстроены под него.
        </Text>
      ) : null}
    </>
  );
}
