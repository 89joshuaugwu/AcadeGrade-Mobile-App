import React from 'react';
import { TextInput, View, Text, TextInputProps } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { colors as darkColors, radius, spacing, type ThemeColors } from '@/constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  /** Icon rendered inside the field, left-aligned (e.g. mail/lock icons per the inspiration reference). */
  leftIcon?: React.ReactNode;
  /** Element rendered inside the field, right-aligned (e.g. the password show/hide toggle). */
  rightElement?: React.ReactNode;
  /** Override token set — pass `lightColors` for screens using the light theme. Defaults to the existing dark palette so every current usage is unaffected. */
  themeColors?: ThemeColors;
}

/**
 * EXTENDED (backward compatible — every existing `<Input label=.../>` call
 * across ~10 screens keeps working unchanged): added `leftIcon`,
 * `rightElement` (for password visibility toggles), and an optional
 * `themeColors` override so the light-themed screens being rebuilt this
 * round (Login, Register, Forgot Password) can use the same component
 * instead of a duplicate.
 */
export function Input({ label, error, leftIcon, rightElement, themeColors, onFocus, onBlur, style, ...rest }: InputProps) {
  const colors = themeColors ?? darkColors;
  const glow = useSharedValue(0);

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: glow.value === 1 ? colors.primaryGlow : error ? colors.danger : colors.border,
    shadowOpacity: glow.value * 0.4,
  }));

  return (
    <View style={{ marginBottom: spacing.md }}>
      {label && (
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 6, fontWeight: '500' }}>
          {label}
        </Text>
      )}
      <Animated.View
        style={[
          borderStyle,
          {
            borderWidth: 1.5,
            borderRadius: radius.md,
            backgroundColor: colors.deep,
            shadowColor: colors.primaryGlow,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 0 },
            flexDirection: 'row',
            alignItems: 'center',
          },
        ]}
      >
        {leftIcon && <View style={{ paddingLeft: 14 }}>{leftIcon}</View>}
        <TextInput
          placeholderTextColor={colors.textFaint}
          onFocus={(e) => {
            glow.value = withTiming(1, { duration: 180 });
            onFocus?.(e);
          }}
          onBlur={(e) => {
            glow.value = withTiming(0, { duration: 180 });
            onBlur?.(e);
          }}
          style={[
            { flex: 1, color: colors.text, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12 },
            style as object,
          ]}
          {...rest}
        />
        {rightElement && <View style={{ paddingRight: 14 }}>{rightElement}</View>}
      </Animated.View>
      {error && <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>{error}</Text>}
    </View>
  );
}
