import React from 'react';
import { Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Card } from '@/components/ui/Card';
import { colors, spacing } from '@/constants/theme';

interface KPICardProps {
  label: string;
  value: string | number;
  color?: string;
  delayMs: number; // ~40ms offset from the previous card, per 02_DESIGN.md
}

export function KPICard({ label, value, color = colors.text, delayMs }: KPICardProps) {
  return (
    <Animated.View entering={FadeInDown.duration(400).delay(delayMs)} style={{ flex: 1, minWidth: '47%' }}>
      <Card style={{ paddingVertical: spacing.md }}>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>{label}</Text>
        <Text style={{ color, fontSize: 22, fontWeight: '800' }}>{value}</Text>
      </Card>
    </Animated.View>
  );
}
