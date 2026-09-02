import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, spacing } from '@/constants/theme';
import { resolveDegreeClass } from '@/lib/cgpa/degreeClass';

interface SmartNudgeProps {
  cgpa: number;
  atRiskCount: number;
  hasGeneratedInsight: boolean;
}

/**
 * One contextual line, computed from real data already on-device — not a
 * server call, not a generic tip. 2026 research: "home screens are no
 * longer dashboards, they're becoming smart hubs" (letsgroto.com). This is
 * the mobile-only equivalent of that pattern, built from data this app
 * already has (CGPA, at-risk count) rather than inventing a new feature.
 */
export function SmartNudge({ cgpa, atRiskCount, hasGeneratedInsight }: SmartNudgeProps) {
  const router = useRouter();
  const nudge = computeNudge(cgpa, atRiskCount, hasGeneratedInsight);
  if (!nudge) return null;

  return (
    <Animated.View entering={FadeIn.duration(400)}>
      <Pressable onPress={() => nudge.route && router.push(nudge.route as any)}>
        <GlassCard aiActive style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
          <Text style={{ fontSize: 22 }}>{nudge.emoji}</Text>
          <Text style={{ color: colors.text, fontSize: 13, flex: 1, lineHeight: 18 }}>{nudge.text}</Text>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}

function computeNudge(cgpa: number, atRiskCount: number, hasGeneratedInsight: boolean) {
  if (atRiskCount > 0) {
    return {
      emoji: '⚠️',
      text: `${atRiskCount} course${atRiskCount > 1 ? 's are' : ' is'} dragging your average — tap to see which ones in Insights.`,
      route: '/(tabs)/insights',
    };
  }
  const degreeClass = resolveDegreeClass(cgpa);
  const nextThreshold = getNextThreshold(cgpa);
  if (nextThreshold) {
    return {
      emoji: '🎯',
      text: `You're ${nextThreshold.gap.toFixed(2)} points from ${nextThreshold.label} — see what it'll take in the What-If calculator.`,
      route: '/(tabs)/insights',
    };
  }
  if (!hasGeneratedInsight) {
    return {
      emoji: '✨',
      text: `You haven't generated an AI analysis yet — get a personalized read on your trajectory.`,
      route: '/(tabs)/insights',
    };
  }
  return null;
}

function getNextThreshold(cgpa: number): { label: string; gap: number } | null {
  const thresholds = [
    { min: 4.5, label: 'First Class' },
    { min: 3.5, label: '2:1' },
    { min: 2.4, label: '2:2' },
    { min: 1.5, label: 'Third Class' },
  ];
  for (const t of thresholds) {
    if (cgpa < t.min && t.min - cgpa <= 0.3) {
      return { label: t.label, gap: t.min - cgpa };
    }
  }
  return null;
}
