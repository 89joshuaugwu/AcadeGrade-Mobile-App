import React, { useState } from 'react';
import { TextInput, View, Text, TextInputProps } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { colors, radius, spacing } from '@/constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, onFocus, onBlur, style, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
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
          },
        ]}
      >
        <TextInput
          placeholderTextColor={colors.textFaint}
          onFocus={(e) => {
            setFocused(true);
            glow.value = withTiming(1, { duration: 180 });
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            glow.value = withTiming(0, { duration: 180 });
            onBlur?.(e);
          }}
          style={[
            { color: colors.text, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12 },
            style as object,
          ]}
          {...rest}
        />
      </Animated.View>
      {error && <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>{error}</Text>}
    </View>
  );
}
