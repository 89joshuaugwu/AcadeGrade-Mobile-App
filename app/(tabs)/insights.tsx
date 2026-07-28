import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { colors, spacing } from '@/constants/theme';
import { GlassCard } from '@/components/ui/GlassCard';
import { AIPulseBadge } from '@/components/ui/AIPulseBadge';
import { ShimmerText } from '@/components/ui/Shimmer';
import { Button } from '@/components/ui/Button';
import { useAcademicData } from '@/lib/store/useAcademicData';
import { aiApi, ApiError } from '@/lib/api/client';
import type { InsightsResponse } from '@/lib/api/client';

export default function Insights() {
  const { semesters, cgpa } = useAcademicData();
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldownMs, setCooldownMs] = useState(0);
  const [typedSummary, setTypedSummary] = useState('');
  const [targetCGPA, setTargetCGPA] = useState(4.5);
  const [whatIfResult, setWhatIfResult] = useState<{ requiredGPA: number; achievable: boolean } | null>(null);
  const lastHaptic = useRef(0);

  useEffect(() => {
    if (cooldownMs <= 0) return;
    const t = setInterval(() => setCooldownMs((ms) => Math.max(0, ms - 1000)), 1000);
    return () => clearInterval(t);
  }, [cooldownMs]);

  // Typing/character-reveal animation — ported conceptually from web, per
  // 02_DESIGN.md §3 ("it works well and is cheap to port conceptually").
  useEffect(() => {
    if (!insights?.summary) return;
    setTypedSummary('');
    let i = 0;
    const interval = setInterval(() => {
      i += 3;
      setTypedSummary(insights.summary.slice(0, i));
      if (i >= insights.summary.length) clearInterval(interval);
    }, 16);
    return () => clearInterval(interval);
  }, [insights?.summary]);

  async function loadInsights(force = false) {
    setLoading(true);
    try {
      const data = await aiApi.insights(force);
      setInsights(data);
      const cooldownEnd = new Date(data.cooldownEndsAt).getTime();
      setCooldownMs(Math.max(0, cooldownEnd - Date.now()));
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        // Cooldown still active server-side — this is UI treatment only,
        // the server is the source of truth per 02_DESIGN.md §3.
      }
    } finally {
      setLoading(false);
    }
  }

  async function runWhatIf(target: number) {
    const remainingSemesters = Math.max(1, 8 - semesters.length);
    const avgCredits = semesters.length
      ? semesters.reduce((s, sem) => s + sem.creditLoaded, 0) / semesters.length
      : 18;
    try {
      const result = await aiApi.whatIf(target, remainingSemesters, Math.round(avgCredits));
      setWhatIfResult(result);
    } catch {
      // Non-fatal — leave previous result showing
    }
  }

  function onSliderChange(v: number) {
    setTargetCGPA(v);
    // Haptic on each whole-point crossed, per 02_DESIGN.md §3
    const whole = Math.floor(v);
    if (whole !== lastHaptic.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      lastHaptic.current = whole;
    }
  }

  const cooldownLabel = cooldownMs > 0 ? formatCooldown(cooldownMs) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.lg }}>AI Insights</Text>

        <GlassCard aiActive style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
            <AIPulseBadge label="Written Analysis" />
            {cooldownLabel && <Text style={{ color: colors.textMuted, fontSize: 11 }}>Next refresh in {cooldownLabel}</Text>}
          </View>
          {loading ? (
            <ShimmerText lines={3} />
          ) : insights ? (
            <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 21 }}>{typedSummary}</Text>
          ) : (
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>No analysis yet — generate one below.</Text>
          )}
          <View style={{ height: spacing.md }} />
          <Button
            label={insights ? 'Refresh Analysis' : 'Generate Analysis'}
            onPress={() => loadInsights(!!insights)}
            loading={loading}
            disabled={!!cooldownLabel}
            fullWidth
          />
        </GlassCard>

        {insights?.riskCourses && insights.riskCourses.length > 0 && (
          <GlassCard style={{ marginBottom: spacing.lg, borderColor: colors.danger }}>
            <Text style={{ color: colors.danger, fontWeight: '700', marginBottom: spacing.sm }}>⚠️ Risk Analysis</Text>
            {insights.riskCourses.map((c, i) => (
              <Text key={i} style={{ color: colors.textMuted, fontSize: 13 }}>{c.code} — Grade {c.grade}</Text>
            ))}
          </GlassCard>
        )}

        <GlassCard>
          <Text style={{ color: colors.text, fontWeight: '700', marginBottom: spacing.sm }}>What-If Calculator</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: spacing.md }}>
            Target CGPA: <Text style={{ color: colors.primaryGlow, fontWeight: '800' }}>{targetCGPA.toFixed(2)}</Text>
          </Text>
          <Slider
            minimumValue={cgpa}
            maximumValue={5}
            value={targetCGPA}
            onValueChange={onSliderChange}
            onSlidingComplete={runWhatIf}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primaryGlow}
          />
          {whatIfResult && (
            <Text style={{ color: colors.text, marginTop: spacing.md, fontSize: 14 }}>
              You need a GPA of{' '}
              <Text style={{ color: whatIfResult.achievable ? colors.success : colors.danger, fontWeight: '800' }}>
                {whatIfResult.requiredGPA.toFixed(2)}
              </Text>{' '}
              in your remaining semesters to hit this target
              {!whatIfResult.achievable ? ' — mathematically not achievable from here.' : '.'}
            </Text>
          )}
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatCooldown(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}
