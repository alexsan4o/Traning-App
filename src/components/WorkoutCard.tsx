import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { levelLabels, sourceLabels } from '../data/labels';
import { SPORTS } from '../data/sports';
import { estimateMinutes } from '../lib/workout';
import { colors, font, radius } from '../theme';
import type { SportId, Workout } from '../types';
import { WorkoutTimeline } from './WorkoutTimeline';
import { Badge, Card, IconButton } from './ui';

export function SportIcon({ sport, size = 22 }: { sport: SportId; size?: number }) {
  const s = SPORTS[sport];
  return (
    <View style={[styles.sportIcon, { backgroundColor: s.color + '22', width: size + 18, height: size + 18 }]}>
      <MaterialCommunityIcons name={s.icon as ComponentProps<typeof MaterialCommunityIcons>['name']} size={size} color={s.color} />
    </View>
  );
}

export function WorkoutCard({
  workout,
  favorite,
  onPress,
  onToggleFavorite,
}: {
  workout: Workout;
  favorite?: boolean;
  onPress: () => void;
  onToggleFavorite?: () => void;
}) {
  const minutes = estimateMinutes(workout);
  return (
    <Card onPress={onPress}>
      <View style={styles.row}>
        <SportIcon sport={workout.sport} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={font.h3} numberOfLines={2}>
            {workout.title}
          </Text>
          <Text style={font.dim}>
            ~{minutes} мин · {workout.exercises.length} упр. · {levelLabels[workout.level]}
          </Text>
        </View>
        {onToggleFavorite ? (
          <IconButton
            icon={favorite ? 'star' : 'star-outline'}
            color={favorite ? colors.warning : colors.textFaint}
            label={favorite ? 'Убрать из избранного' : 'В избранное'}
            onPress={onToggleFavorite}
          />
        ) : null}
      </View>
      <WorkoutTimeline workout={workout} compact />
      <View style={styles.row}>
        <Badge label={sourceLabels[workout.source]} color={workout.source === 'ai' ? colors.accent : colors.textDim} />
        <Badge label={SPORTS[workout.sport].name} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sportIcon: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
