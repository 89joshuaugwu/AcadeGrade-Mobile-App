import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withDelay, Easing } from 'react-native-reanimated';
import * as LucideIcons from 'lucide-react-native';
import { colors } from '@/constants/theme';
import { AcadeMindMark } from './AcadeMindMark';

interface HeroArtProps {
  icon: keyof typeof LucideIcons;
  size?: number;
  color?: string;
  /** Renders the AcadeMind logo instead of the lucide icon — for the AI-themed onboarding slide. */
  useAcademindLogo?: boolean;
}

/**
 * Replaces both the emoji hero art (Welcome/Onboarding Tour) AND the
 * mistakenly-populated `assets/lottie/` folder (which contained font files,
 * not Lottie JSON — flagged in the upgrade prompt). Rather than chase down
 * a real Lottie asset, this builds the "subtle looping motion" the prompt
 * asks for directly from lucide-react-native (already a dependency) +
 * react-native-svg + Reanimated: a soft pulsing glow ring behind a
 * float/breathe animated icon. No new dependency, matches the prompt's own
 * "SVG built from the existing icon set" option.
 */
export function HeroArt({ icon, size = 96, color = colors.primaryGlow, useAcademindLogo }: HeroArtProps) {
  const Icon = LucideIcons[icon] as React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  const float = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    float.value = withRepeat(withSequence(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) })), -1, false);
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 2200, easing: Easing.out(Easing.ease) }), withDelay(200, withTiming(0, { duration: 0 }))), -1, false);
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 + float.value * 12 }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.35 }],
    opacity: 0.35 * (1 - pulse.value),
  }));

  const ringSize = size * 1.9;

  return (
    <View style={{ width: ringSize, height: ringSize, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[ringStyle, { position: 'absolute' }]}>
        <Svg width={ringSize} height={ringSize}>
          <Circle cx={ringSize / 2} cy={ringSize / 2} r={size / 2} stroke={color} strokeWidth={2} fill="none" />
        </Svg>
      </Animated.View>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: 'rgba(99,102,241,0.12)',
          borderWidth: 1,
          borderColor: 'rgba(232,237,255,0.14)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Animated.View style={floatStyle}>
          {useAcademindLogo ? (
            <AcadeMindMark size={size * 0.5} />
          ) : Icon ? (
            <Icon size={size * 0.42} color={color} strokeWidth={1.75} />
          ) : null}
        </Animated.View>
      </View>
    </View>
  );
}
