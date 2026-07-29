import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { colors } from '@/constants/theme';

/**
 * Ambient animated glow behind auth screens, per the UI upgrade prompt:
 * "Replace the flat black background with a subtle animated gradient or
 * soft moving glow ... this is the user's very first impression, it
 * shouldn't be a plain void." Built from two soft, slow-drifting radial
 * blobs (primaryGlow + gold, both existing brand tokens — nothing
 * recolored) using only Reanimated + View, no new dependency.
 */
export function AuthGlow() {
  const t1 = useSharedValue(0);
  const t2 = useSharedValue(0);

  useEffect(() => {
    t1.value = withRepeat(withSequence(withTiming(1, { duration: 7000, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 7000, easing: Easing.inOut(Easing.sin) })), -1, false);
    t2.value = withRepeat(withSequence(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 9000, easing: Easing.inOut(Easing.sin) })), -1, false);
  }, []);

  const blob1 = useAnimatedStyle(() => ({
    transform: [{ translateX: t1.value * 40 - 20 }, { translateY: t1.value * -30 }],
    opacity: 0.16 + t1.value * 0.06,
  }));
  const blob2 = useAnimatedStyle(() => ({
    transform: [{ translateX: t2.value * -35 }, { translateY: t2.value * 25 }],
    opacity: 0.12 + t2.value * 0.05,
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.void }]} />
      <Animated.View
        style={[
          blob1,
          {
            position: 'absolute',
            top: -120,
            left: -80,
            width: 320,
            height: 320,
            borderRadius: 160,
            backgroundColor: colors.primaryGlow,
          },
        ]}
      />
      <Animated.View
        style={[
          blob2,
          {
            position: 'absolute',
            bottom: -100,
            right: -90,
            width: 300,
            height: 300,
            borderRadius: 150,
            backgroundColor: colors.gold,
          },
        ]}
      />
      <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
    </View>
  );
}
