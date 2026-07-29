import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming, withDelay, Easing } from 'react-native-reanimated';
import { colors } from '@/constants/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Checkmark draw-in, per the upgrade prompt: "Add a success animation
 * (checkmark draw-in or brief particle burst ...) instead of a static ✅
 * emoji." Ring draws in first, then the check stroke, using
 * strokeDashoffset — same technique as CGPAArc's ring animation elsewhere
 * in the app, so the motion language is consistent.
 */
export function SuccessCheck({ size = 88 }: { size?: number }) {
  const ringProgress = useSharedValue(0);
  const checkProgress = useSharedValue(0);

  useEffect(() => {
    ringProgress.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
    checkProgress.value = withDelay(400, withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) }));
  }, []);

  const r = size / 2 - 4;
  const circumference = 2 * Math.PI * r;

  const ringAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - ringProgress.value),
  }));
  const checkAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: 40 * (1 - checkProgress.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={3} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.success}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={ringAnimatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <AnimatedPath
          d={`M ${size * 0.3} ${size * 0.52} L ${size * 0.44} ${size * 0.66} L ${size * 0.72} ${size * 0.36}`}
          stroke={colors.success}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={40}
          animatedProps={checkAnimatedProps}
        />
      </Svg>
    </View>
  );
}
