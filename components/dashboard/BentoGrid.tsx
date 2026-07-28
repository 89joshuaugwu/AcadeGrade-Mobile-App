import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GlassCard } from './GlassCard';
import { colors, spacing } from '@/constants/theme';

type Span = 'full' | 'half' | 'third' | 'twoThirds';

const spanWidth: Record<Span, string> = {
  full: '100%',
  half: '48%',
  third: '31%',
  twoThirds: '65%',
};

interface BentoTileProps {
  span: Span;
  delayMs?: number;
  aiActive?: boolean;
  style?: ViewStyle;
  children: React.ReactNode;
}

/** One cell of the bento grid — a GlassCard sized to a fraction of row width. */
export function BentoTile({ span, delayMs = 0, aiActive, style, children }: BentoTileProps) {
  return (
    <Animated.View entering={FadeInDown.duration(450).delay(delayMs)} style={{ width: spanWidth[span] as any }}>
      <GlassCard aiActive={aiActive} style={[{ height: '100%' }, style]}>
        {children}
      </GlassCard>
    </Animated.View>
  );
}

/** Wraps tiles into a flex-wrapped row grid with consistent gutters. */
export function BentoGrid({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, rowGap: spacing.sm }}>
      {children}
    </View>
  );
}

/** Compact stat used inside a small bento tile — label + big number. */
export function BentoStat({ label, value, color = colors.text }: { label: string; value: string | number; color?: string }) {
  return (
    <View>
      <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 4 }}>{label}</Text>
      <Text style={{ color, fontSize: 24, fontWeight: '800' }}>{value}</Text>
    </View>
  );
}
