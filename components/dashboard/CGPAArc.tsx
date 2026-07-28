import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withSpring } from 'react-native-reanimated';
import { colors } from '@/constants/theme';
import { resolveDegreeClass } from '@/lib/cgpa/degreeClass';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SIZE = 220;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface CGPAArcProps {
  value: number; // 0–5.0
  label: string; // "CGPA" or "PI"
}

export function CGPAArc({ value, label }: CGPAArcProps) {
  const progress = useSharedValue(0);
  const degreeClass = resolveDegreeClass(value);

  useEffect(() => {
    // Spring with slight overshoot then settle — per 02_DESIGN.md §3, not a linear tween
    progress.value = withSpring(value / 5, { damping: 10, stiffness: 60, mass: 0.9 });
  }, [value]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={colors.border}
          strokeWidth={STROKE}
          fill="none"
        />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={degreeClass.color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          animatedProps={animatedProps}
          rotation="-90"
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>

      <Text style={{ color: colors.text, fontSize: 44, fontWeight: '800' }}>{value.toFixed(2)}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 13, letterSpacing: 1 }}>{label} / 5.0</Text>
      <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text style={{ fontSize: 13 }}>{degreeClass.icon}</Text>
        <Text style={{ color: degreeClass.color, fontSize: 12, fontWeight: '700' }}>{degreeClass.shortLabel}</Text>
      </View>
    </View>
  );
}
