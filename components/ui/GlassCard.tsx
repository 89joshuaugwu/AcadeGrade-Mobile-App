import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { glass, radius } from '@/constants/theme';

interface GlassCardProps extends ViewProps {
  /** Subtle indigo wash for surfaces representing "AI is active here" — used
   *  sparingly (Insights written-analysis card, AI Degree Outlook) so it
   *  reads as a signal, not decoration everywhere. */
  aiActive?: boolean;
  elevated?: boolean;
}

/**
 * Liquid Glass surface — translucent blur + a hairline border that catches
 * light from the top, instead of a flat solid-color card. This is the 2026
 * mobile design standard (Apple's "Liquid Glass" evolution of
 * Glassmorphism): motion and depth on translucent surfaces rather than
 * static frosted panels. Brand colors are unchanged — this only changes
 * HOW the existing surface/overlay colors are presented (as a wash over
 * blur instead of flat fill).
 */
export function GlassCard({ style, children, aiActive, elevated, ...rest }: GlassCardProps) {
  return (
    <View
      style={[
        {
          borderRadius: radius.lg,
          overflow: 'hidden',
          borderWidth: 1,
          borderTopColor: glass.borderTop,
          borderLeftColor: glass.borderTop,
          borderRightColor: glass.borderBottom,
          borderBottomColor: glass.borderBottom,
        },
        style,
      ]}
      {...rest}
    >
      <BlurView intensity={glass.intensity} tint={glass.tint} style={StyleSheet.absoluteFill} />
      <View
        style={{
          backgroundColor: aiActive ? glass.primaryGlowWash : elevated ? glass.washElevated : glass.wash,
          padding: 16,
        }}
      >
        {children}
      </View>
    </View>
  );
}
