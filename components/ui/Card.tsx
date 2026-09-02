import React from 'react';
import { View, ViewProps } from 'react-native';
import { colors as darkColors, radius, spacing, type ThemeColors } from '@/constants/theme';

interface CardProps extends ViewProps {
  themeColors?: ThemeColors;
}

/** EXTENDED with optional themeColors override (backward compatible — every existing call keeps working unchanged). */
export function Card({ style, children, themeColors, ...rest }: CardProps) {
  const colors = themeColors ?? darkColors;
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: spacing.lg,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
