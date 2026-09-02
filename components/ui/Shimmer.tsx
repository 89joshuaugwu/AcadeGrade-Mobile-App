import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '@/constants/theme';

/**
 * Gradient-sweep skeleton, not a spinner. 2026 research note: "we're past
 * the era of bounce animations — micro-interactions communicate system
 * intelligence" (letsgroto.com, Dec 2025). A shimmer reads as "the system
 * is actively working on something specific," a spinner just reads as
 * "wait." Used for AI insight generation, OCR extraction, transcript gen.
 */
export function ShimmerBlock({ width = '100%', height = 16, style }: { width?: number | string; height?: number; style?: object }) {
  const translateX = useSharedValue(-1);

  useEffect(() => {
    translateX.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false);
  }, [translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value * 200 }],
  }));

  return (
    <View style={[{ width, height, borderRadius: radius.sm, backgroundColor: colors.overlay, overflow: 'hidden' }, style]}>
      <Animated.View style={[{ width: 80, height: '100%' }, animatedStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(129,140,248,0.25)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: '100%', height: '100%' }}
        />
      </Animated.View>
    </View>
  );
}

/** Multi-line skeleton for AI-generated text blocks (insights summary, forecast) */
export function ShimmerText({ lines = 3 }: { lines?: number }) {
  return (
    <View style={{ gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <ShimmerBlock key={i} width={i === lines - 1 ? '60%' : '100%'} height={12} />
      ))}
    </View>
  );
}
