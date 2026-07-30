import React from 'react';
import { View, Text, Image } from 'react-native';
import { colors } from '@/constants/theme';

/**
 * FIX: no Logo component existed anywhere in this codebase — every auth
 * screen was missing the actual brand mark. `assets/icon.png` is (confirmed
 * by matching MD5 checksum) the exact same file as the web app's
 * `public/android-chrome-512x512.png` — the real logo was sitting in the
 * project the whole time, just never wired into a component or used
 * anywhere. Copied to `assets/logo.png` for a clearer name and used here.
 */
interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  tagline?: string;
}

export function Logo({ size = 64, showWordmark = true, tagline }: LogoProps) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Image
        source={require('../../assets/logo.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityLabel="AcadeGrade logo"
      />
      {showWordmark && (
        <Text style={{ color: colors.text, fontSize: size * 0.34, fontWeight: '800', marginTop: 8 }}>
          AcadeGrade
        </Text>
      )}
      {tagline && (
        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>{tagline}</Text>
      )}
    </View>
  );
}
