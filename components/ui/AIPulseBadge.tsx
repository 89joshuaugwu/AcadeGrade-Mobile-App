import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { colors } from '@/constants/theme';

/**
 * Small pulsing dot + label, used wherever the AI feature is "live" (has
 * fresh data available, or is mid-generation). Distinct from a loading
 * spinner: this communicates ongoing state, not "please wait."
 */
export function AIPulseBadge({ label = 'AcadeMind' }: { label?: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(withSequence(withTiming(1.6, { duration: 900 }), withTiming(1, { duration: 0 })), -1, false);
    opacity.value = withRepeat(withSequence(withTiming(0, { duration: 900 }), withTiming(1, { duration: 0 })), -1, false);
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={[
            ringStyle,
            { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primaryGlow },
          ]}
        />
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primaryGlow }} />
      </View>
      <Text style={{ color: colors.primaryGlow, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}
