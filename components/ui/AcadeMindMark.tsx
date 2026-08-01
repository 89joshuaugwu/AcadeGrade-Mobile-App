import React from 'react';
import { Image } from 'react-native';

/**
 * The AI-specific brand mark (ported from the web app's
 * `public/acadegradeailogo.png`) — used everywhere a generic Sparkles icon
 * was previously standing in for "this is an AI feature": the Insights tab
 * icon, the Dashboard hero card's AI indicator, the "Smart Insights"
 * feature pill on Welcome, and the AI-themed Onboarding slide.
 */
export function AcadeMindMark({ size = 20 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/acadegrade-ai-logo.png')}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityLabel="AcadeMind"
    />
  );
}
