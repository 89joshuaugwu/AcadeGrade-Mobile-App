import React from 'react';
import { Pressable, Text, ActivityIndicator, PressableProps } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, radius, type ThemeColors } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: Variant;
  themeColors?: ThemeColors;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({ label, variant = 'primary', loading, fullWidth, icon, disabled, onPress, themeColors, ...rest }: ButtonProps) {
  const scale = useSharedValue(1);
  const c: ThemeColors = themeColors ?? colors;
  const style = {
    primary: { bg: c.primary, text: '#FFFFFF' },
    secondary: { bg: c.surface, text: c.text, border: c.border },
    ghost: { bg: 'transparent', text: c.primaryGlow },
    danger: { bg: c.danger, text: '#FFFFFF' },
  }[variant];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPressIn={() => { scale.value = withSpring(0.96, { damping: 15 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 12 }); }}
      onPress={(e) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      style={[
        animatedStyle,
        {
          backgroundColor: style.bg,
          borderWidth: style.border ? 1 : 0,
          borderColor: style.border,
          borderRadius: radius.md,
          paddingVertical: 14,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          width: fullWidth ? '100%' : undefined,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={style.text} />
      ) : (
        <>
          {icon}
          <Text style={{ color: style.text, fontSize: 16, fontWeight: '600' }}>{label}</Text>
        </>
      )}
    </AnimatedPressable>
  );
}
