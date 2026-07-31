import React from 'react';
import { View, Text, Image } from 'react-native';
import { colors as darkColors } from '@/constants/theme';

/**
 * `assets/icon.png` is (confirmed by matching MD5 checksum) the exact same
 * file as the web app's `public/android-chrome-512x512.png`. Copied to
 * `assets/logo.png` for a clearer name and used here.
 *
 * FIXED: now accepts a `themeColors` override — the original version
 * hardcoded dark text, which was invisible against the new light-themed
 * auth screens (near-white text on a near-white background). Defaults to
 * dark for any existing usage that doesn't pass it.
 */
interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  tagline?: string;
  themeColors?: typeof darkColors;
}

export function Logo({ size = 64, showWordmark = true, tagline, themeColors }: LogoProps) {
  const c = themeColors ?? darkColors;
  return (
    <View style={{ alignItems: 'center' }}>
      <Image
        source={require('../../assets/logo.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityLabel="AcadeGrade logo"
      />
      {showWordmark && (
        <Text style={{ color: c.text, fontSize: size * 0.34, fontWeight: '800', marginTop: 8 }}>
          AcadeGrade
        </Text>
      )}
      {tagline && (
        <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 2 }}>{tagline}</Text>
      )}
    </View>
  );
}
