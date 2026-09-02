import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { TrendingUp, TrendingDown, AlertTriangle, RefreshCw, Target } from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import { lightColors as colors, spacing, radius } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AcadeMindMark } from '@/components/ui/AcadeMindMark';
import { db } from '@/lib/firebase/client';
import { useAuthStore } from '@/lib/store/authStore';
import { useAcademicData } from '@/lib/store/useAcademicData';
import { aiApi, type ForecastResponse, type InsightsResponse, type WhatIfResponse } from '@/lib/api/client';
import { getGradeColor } from '@/lib/cgpa/gradeScale';
import type { CourseWithId } from '@/types/course';

type TabType = 'forecast' | 'whatif' | 'risk' | 'analysis';
const TABS: { id: TabType; label: string }[] = [
  { id: 'forecast', label: 'Forecast' },
  { id: 'whatif', label: 'What-If' },
  { id: 'risk', label: 'Risk' },
  { id: 'analysis', label: 'Analysis' },
];

/**
 * REBUILT as a real 4-tab screen matching web's actual
 * `app/(student)/insights/page.tsx` (Forecast / What-If / Risk Analysis /
 * Written Analysis) — the previous version had no tabs and no Forecast at
 * all. Also fixes three confirmed API-contract bugs (see `lib/api/client.ts`):
 * the request bodies previously sent didn't match what the real endpoints
 * expect, and the Written Analysis response type referenced fields
 * (`summary`) that don't exist on the actual response.
 * Reads/writes the same `analytics/{uid}` cache doc web uses, so a
 * forecast or written analysis generated on web shows up here too.
 */
export default function Insights() {
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const { semesters, allCourses, cgpa, pi, totalCredits, loading } = useAcademicData();
  const [tab, setTab] = useState<TabType>('forecast');

  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);

  const completedSemesters = useMemo(() => semesters.filter((s) => s.isComplete), [semesters]);
  const piHistory = useMemo(() => {
    let units = 0, points = 0;
    const hist: number[] = [];
    completedSemesters.forEach((s) => { units += s.creditLoaded || 0; points += (s.pi || 0) * (s.creditLoaded || 0); hist.push(units > 0 ? points / units : 0); });
    return hist;
  }, [completedSemesters]);
  const cgpaHistory = useMemo(() => {
    let units = 0, points = 0;
    const hist: number[] = [];
    completedSemesters.forEach((s) => { units += s.creditLoaded || 0; points += (s.gpa || 0) * (s.creditLoaded || 0); hist.push(units > 0 ? points / units : 0); });
    return hist;
  }, [completedSemesters]);

  const flaggedCourses = useMemo(
    () => allCourses.filter((c) => (c.totalScore ?? 0) < 50),
    [allCourses]
  );

  // Load cached analytics doc first (instant paint), matching web's caching pattern
  useEffect(() => {
    if (!uid) return;
    db.collection('analytics').doc(uid).get().then((snap) => {
      const data = snap.data();
      if (data?.forecast) setForecast(data.forecast);
      if (data?.lastInsight) setInsights(data.lastInsight);
    });
  }, [uid]);

  const loadForecast = useCallback(async (force = false) => {
    if (piHistory.length === 0) return;
    setForecastLoading(true);
    setRateLimited(false);
    try {
      const data = await aiApi.forecast(piHistory, cgpaHistory);
      setForecast(data);
      if (uid) await db.collection('analytics').doc(uid).set({ forecast: data }, { merge: true });
    } catch (e: any) {
      if (e.status === 429) setRateLimited(true);
    } finally {
      setForecastLoading(false);
    }
  }, [piHistory, cgpaHistory, uid]);

  const loadInsights = useCallback(async (force = false) => {
    setInsightsLoading(true);
    setRateLimited(false);
    try {
      // Web sends the raw semesters array as `semesterData` — same contract here.
      const data = await aiApi.insights(force, semesters);
      setInsights(data);
      if (uid) await db.collection('analytics').doc(uid).set({ lastInsight: data }, { merge: true });
    } catch (e: any) {
      if (e.status === 429) setRateLimited(true);
    } finally {
      setInsightsLoading(false);
    }
  }, [semesters, uid]);

  useEffect(() => {
    if (!loading && !forecast && piHistory.length > 0) loadForecast();
    if (!loading && !insights) loadInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm }}>
        <AcadeMindMark size={22} />
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>AcadeMind Insights</Text>
      </View>

      <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg, gap: 6, marginBottom: spacing.md }}>
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            style={{
              flex: 1, paddingVertical: 8, borderRadius: radius.pill, alignItems: 'center',
              backgroundColor: tab === t.id ? colors.primary : colors.overlay,
            }}
          >
            <Text style={{ color: tab === t.id ? '#fff' : colors.textMuted, fontSize: 12, fontWeight: '700' }}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {rateLimited && (
        <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.dangerDim, padding: spacing.sm, borderRadius: radius.md }}>
          <Text style={{ color: colors.danger, fontSize: 12 }}>AI quota reached — try again shortly.</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: 120 }}>
        {tab === 'forecast' && (
          <ForecastTab forecast={forecast} loading={forecastLoading} onRefresh={() => loadForecast(true)} hasHistory={piHistory.length > 0} />
        )}
        {tab === 'whatif' && <WhatIfTab currentCGPA={cgpa} totalCredits={totalCredits} />}
        {tab === 'risk' && <RiskTab courses={flaggedCourses} />}
        {tab === 'analysis' && (
          <AnalysisTab insights={insights} loading={insightsLoading} onRegenerate={() => loadInsights(true)} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ForecastTab({ forecast, loading, onRefresh, hasHistory }: { forecast: ForecastResponse | null; loading: boolean; onRefresh: () => void; hasHistory: boolean }) {
  if (!hasHistory) {
    return <EmptyState message="Complete at least one semester to unlock your forecast." />;
  }
  if (loading && !forecast) return <LoadingState label="Forecasting your trajectory…" />;
  if (!forecast) return <EmptyState message="No forecast yet." onRetry={onRefresh} />;

  const trend = forecast.slope > 0.02 ? 'up' : forecast.slope < -0.02 ? 'down' : 'flat';

  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      <Card themeColors={colors} style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm }}>
          {trend === 'up' ? <TrendingUp size={18} color={colors.success} /> : trend === 'down' ? <TrendingDown size={18} color={colors.danger} /> : <TrendingUp size={18} color={colors.textMuted} />}
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>{forecast.trendLabel}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.lg }}>
          <View>
            <Text style={{ color: colors.textFaint, fontSize: 11 }}>Projected PI</Text>
            <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '800' }}>{forecast.projectedPi?.[1]?.toFixed(2) ?? '—'}</Text>
          </View>
          <View>
            <Text style={{ color: colors.textFaint, fontSize: 11 }}>Projected CGPA</Text>
            <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '800' }}>{forecast.projectedCgpa?.[1]?.toFixed(2) ?? '—'}</Text>
          </View>
          <View>
            <Text style={{ color: colors.textFaint, fontSize: 11 }}>Risk Score</Text>
            <Text style={{ color: forecast.riskScore > 60 ? colors.danger : colors.success, fontSize: 18, fontWeight: '800' }}>{forecast.riskScore}</Text>
          </View>
        </View>
      </Card>
      <Pressable onPress={onRefresh} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm }}>
        <RefreshCw size={13} color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>{loading ? 'Refreshing…' : 'Refresh Forecast'}</Text>
      </Pressable>
    </Animated.View>
  );
}

function WhatIfTab({ currentCGPA, totalCredits }: { currentCGPA: number; totalCredits: number }) {
  const [targetCGPA, setTargetCGPA] = useState(Math.min(5, currentCGPA + 0.3));
  const [remainingSemesters, setRemainingSemesters] = useState('2');
  const [creditLoad, setCreditLoad] = useState('18');
  const [result, setResult] = useState<WhatIfResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function calculate() {
    setLoading(true);
    try {
      const data = await aiApi.whatIf(currentCGPA, totalCredits, targetCGPA, Number(remainingSemesters) || 1, Number(creditLoad) || 15);
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      <Card themeColors={colors} style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm }}>
          <Target size={16} color={colors.primary} />
          <Text style={{ color: colors.text, fontWeight: '800' }}>Target CGPA: {targetCGPA.toFixed(2)}</Text>
        </View>
        <Slider minimumValue={currentCGPA} maximumValue={5} value={targetCGPA} onValueChange={setTargetCGPA} minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} thumbTintColor={colors.primary} />
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Input label="Remaining semesters" keyboardType="number-pad" value={remainingSemesters} onChangeText={setRemainingSemesters} themeColors={colors} />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Credit load / semester" keyboardType="number-pad" value={creditLoad} onChangeText={setCreditLoad} themeColors={colors} />
          </View>
        </View>
        <Button label="Calculate" onPress={calculate} loading={loading} fullWidth />
      </Card>

      {result && (
        <Card themeColors={colors}>
          <Text style={{ color: colors.textFaint, fontSize: 11 }}>Required GPA per remaining semester</Text>
          <Text style={{ color: colors.primary, fontSize: 24, fontWeight: '800', marginBottom: spacing.sm }}>{result.requiredGPA.toFixed(2)}</Text>
          <Text style={{ color: colors.textFaint, fontSize: 11 }}>Required average score</Text>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing.sm }}>{result.requiredAvgScore.toFixed(1)}%</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18 }}>{result.feasibilityNote}</Text>
        </Card>
      )}
    </Animated.View>
  );
}

function RiskTab({ courses }: { courses: CourseWithId[] }) {
  if (courses.length === 0) return <EmptyState message="No courses currently flagged as at-risk. Great job!" positive />;
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={{ gap: spacing.sm }}>
      {courses.map((c) => (
        <Card key={c.id} themeColors={colors} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AlertTriangle size={16} color={colors.danger} style={{ marginRight: spacing.sm }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{c.code}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>{c.title}</Text>
          </View>
          <Text style={{ color: getGradeColor(c.grade ?? 'F'), fontWeight: '800' }}>{c.totalScore ?? '—'}</Text>
        </Card>
      ))}
    </Animated.View>
  );
}

function AnalysisTab({ insights, loading, onRegenerate }: { insights: InsightsResponse | null; loading: boolean; onRegenerate: () => void }) {
  if (loading && !insights) return <LoadingState label="AcadeMind is writing your analysis…" />;
  if (!insights) return <EmptyState message="No written analysis yet." onRetry={onRegenerate} />;

  return (
    <Animated.View entering={FadeInDown.duration(300)} style={{ gap: spacing.md }}>
      <InsightSection title="Strengths" items={insights.strengths} color={colors.success} />
      <InsightSection title="Areas of Concern" items={insights.concerns} color={colors.danger} />
      <InsightSection title="Recommendations" items={insights.recommendations} color={colors.primary} />
      <Card themeColors={colors}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm }}>
          <AcadeMindMark size={16} />
          <Text style={{ color: colors.text, fontWeight: '800' }}>Degree Outlook</Text>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20 }}>{insights.degreeOutlook}</Text>
      </Card>
      <Pressable onPress={onRegenerate} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm }}>
        <RefreshCw size={13} color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Regenerate (12h cooldown applies)</Text>
      </Pressable>
    </Animated.View>
  );
}

function InsightSection({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (!items?.length) return null;
  return (
    <Card themeColors={colors}>
      <Text style={{ color: colors.text, fontWeight: '800', marginBottom: spacing.sm }}>{title}</Text>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color, marginTop: 6 }} />
          <Text style={{ color: colors.textMuted, fontSize: 13, flex: 1, lineHeight: 19 }}>{item}</Text>
        </View>
      ))}
    </Card>
  );
}

function EmptyState({ message, onRetry, positive }: { message: string; onRetry?: () => void; positive?: boolean }) {
  return (
    <Animated.View entering={FadeIn.duration(250)} style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
      <Text style={{ fontSize: 32, marginBottom: spacing.sm }}>{positive ? '🎉' : '✨'}</Text>
      <Text style={{ color: colors.textMuted, textAlign: 'center', marginBottom: spacing.md }}>{message}</Text>
      {onRetry && <Button label="Try Again" variant="secondary" onPress={onRetry} />}
    </Animated.View>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
      <ActivityIndicator color={colors.primary} />
      <Text style={{ color: colors.textMuted, marginTop: spacing.md }}>{label}</Text>
    </View>
  );
}
