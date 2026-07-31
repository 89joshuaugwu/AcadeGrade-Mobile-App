import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, useAnimatedStyle, withSpring, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { colors } from '@/constants/theme';
import { resolveDegreeClass } from '@/lib/cgpa/degreeClass';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SIZE = 240;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const SWEEP_DEG = 270; // open at the bottom, matches the inspiration reference exactly
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC_LENGTH = CIRCUMFERENCE * (SWEEP_DEG / 360);
const START_ANGLE = 135; // rotation so the gap sits at the bottom

interface CGPAArcProps {
  value: number; // 0–5.0
  label: string; // "CGPA" or "PI"
}

/**
 * REBUILT — the previous version was a plain full-circle ring, which looked
 * flat next to the inspiration reference (a 270° gradient arc, glowing tip
 * dot, degree badge sitting INSIDE the ring, not below it). This matches
 * that composition: indigo→lighter-blue gradient stroke, a pulsing glow dot
 * at the arc's leading edge, degree class badge centered inside.
 */
export function CGPAArc({ value, label }: CGPAArcProps) {
  const progress = useSharedValue(0);
  const dotPulse = useSharedValue(1);
  const degreeClass = resolveDegreeClass(value);

  useEffect(() => {
    progress.value = withSpring(value / 5, { damping: 11, stiffness: 55, mass: 0.9 });
    dotPulse.value = withRepeat(withSequence(withTiming(1.3, { duration: 1000 }), withTiming(1, { duration: 1000 })), -1, true);
  }, [value]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: ARC_LENGTH * (1 - progress.value),
  }));

  const dotStyle = useAnimatedStyle(() => {
    const angle = ((START_ANGLE + SWEEP_DEG * progress.value) * Math.PI) / 180;
    const cx = SIZE / 2 + RADIUS * Math.cos(angle);
    const cy = SIZE / 2 + RADIUS * Math.sin(angle);
    return {
      position: 'absolute',
      left: cx - 7,
      top: cy - 7,
      transform: [{ scale: dotPulse.value }],
    };
  });

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={colors.primary} />
            <Stop offset="100%" stopColor={colors.primaryGlow} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
          stroke={colors.border} strokeWidth={STROKE} fill="none"
          strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE}`}
          rotation={START_ANGLE} origin={`${SIZE / 2}, ${SIZE / 2}`}
          strokeLinecap="round"
        />
        <AnimatedCircle
          cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
          stroke="url(#arcGrad)" strokeWidth={STROKE} fill="none"
          strokeLinecap="round"
          strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE}`}
          animatedProps={animatedProps}
          rotation={START_ANGLE} origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>

      <Animated.View style={dotStyle}>
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.primaryGlow, shadowColor: colors.primaryGlow, shadowOpacity: 0.9, shadowRadius: 8, elevation: 6 }} />
      </Animated.View>

      <Text style={{ color: colors.textMuted, fontSize: 12, letterSpacing: 1.5, marginBottom: 2 }}>{label.toUpperCase()}</Text>
      <Text style={{ color: colors.text, fontSize: 48, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{value.toFixed(2)}</Text>
      <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${degreeClass.color}22`, borderWidth: 1, borderColor: `${degreeClass.color}55`, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999 }}>
        <Text style={{ fontSize: 13 }}>{degreeClass.icon}</Text>
        <Text style={{ color: degreeClass.color, fontSize: 12, fontWeight: '700' }}>{degreeClass.shortLabel}</Text>
      </View>
    </View>
  );
}
