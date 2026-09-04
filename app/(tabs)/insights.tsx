import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';
import { AlertTriangle, Clock3, GraduationCap, Minus, RefreshCw, Target, TrendingDown, TrendingUp } from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import Svg, { Circle } from 'react-native-svg';
import { radius, spacing } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AcadeMindMark } from '@/components/ui/AcadeMindMark';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { db } from '@/lib/firebase/client';
import { useAuthStore } from '@/lib/store/authStore';
import { useAcademicData } from '@/lib/store/useAcademicData';
import { aiApi, type ForecastResponse, type InsightsResponse, type WhatIfResponse } from '@/lib/api/client';
import { getGradeColor } from '@/lib/cgpa/gradeScale';
import { useThemeColors } from '@/lib/store/themeStore';
import { useToastStore } from '@/lib/store/toastStore';
import type { CourseWithId } from '@/types/course';
import { getAcademicPlan } from '@/lib/academic/timeline';
import { TourTarget } from '@/components/tour/TourTarget';
import { useAutoTour } from '@/lib/tour/useAutoTour';
import { registerTourAction } from '@/lib/tour/registry';
import { HeaderFadeEdge } from '@/components/ui/HeaderFadeEdge';
import { SkeletonBlock, SkeletonCircle, SkeletonLine, SkeletonPulse } from '@/components/ui/Skeleton';

type TabType = 'forecast' | 'whatif' | 'risk' | 'analysis';
type ProjectionMode = 'pi' | 'cgpa';

const TABS: { id: TabType; label: string }[] = [
  { id: 'forecast', label: 'Forecast' },
  { id: 'whatif', label: 'What-If' },
  { id: 'risk', label: 'Risk' },
  { id: 'analysis', label: 'Written' },
];

function timestampToMillis(value: any): number | null {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function formatCooldown(milliseconds: number) {
  const totalMinutes = Math.max(1, Math.ceil(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function Insights() {
  const colors = useThemeColors();
  const uid = useAuthStore((state) => state.firebaseUser?.uid);
  const profile = useAuthStore((state) => state.profile);
  const showToast = useToastStore((state) => state.show);
  const { semesters, coursesBySemester, loading: academicLoading } = useAcademicData();
  const [tab, setTab] = useState<TabType>('forecast');
  const [projectionMode, setProjectionMode] = useState<ProjectionMode>(profile?.gradeMode ?? 'pi');
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsStale, setInsightsStale] = useState(false);
  const [lastInsightAt, setLastInsightAt] = useState<number | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [retryCooldown, setRetryCooldown] = useState(0);
  const [clock, setClock] = useState(0);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const initialLoading = academicLoading || analyticsLoading;
  useAutoTour('insights', 750, !initialLoading);

  useEffect(() => {
    const cleanups = [
      registerTourAction('insights-show-forecast', () => { setTab('forecast'); scrollRef.current?.scrollTo({ y: 0, animated: true }); }),
      registerTourAction('insights-show-whatif', () => { setTab('whatif'); scrollRef.current?.scrollTo({ y: 0, animated: true }); }),
      registerTourAction('insights-show-risk', () => { setTab('risk'); scrollRef.current?.scrollTo({ y: 0, animated: true }); }),
      registerTourAction('insights-show-analysis', () => { setTab('analysis'); scrollRef.current?.scrollTo({ y: 0, animated: true }); }),
    ];
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  useEffect(() => setProjectionMode(profile?.gradeMode ?? 'pi'), [profile?.gradeMode]);

  const completedSemesters = useMemo(
    () => semesters.filter((semester) => semester.isComplete),
    [semesters],
  );
  const academicPlan = useMemo(() => getAcademicPlan(profile, semesters), [profile, semesters]);

  // Web forecasts semester PI values, while CGPA is cumulative. Keep the mobile contract identical.
  const piHistory = useMemo(
    () => completedSemesters.map((semester) => Number(semester.pi || 0)),
    [completedSemesters],
  );

  const { cgpaHistory, currentCGPA, totalCredits } = useMemo(() => {
    let units = 0;
    let points = 0;
    const history: number[] = [];
    completedSemesters.forEach((semester) => {
      units += semester.creditLoaded || 0;
      points += (semester.gpa || 0) * (semester.creditLoaded || 0);
      history.push(units > 0 ? points / units : 0);
    });
    return { cgpaHistory: history, currentCGPA: history[history.length - 1] ?? 0, totalCredits: units };
  }, [completedSemesters]);

  const flaggedCourses = useMemo(
    () => completedSemesters
      .flatMap((semester) => coursesBySemester[semester.id] ?? [])
      .filter((course) => !course.isAR && course.totalScore != null && course.totalScore < 50),
    [completedSemesters, coursesBySemester],
  );

  useEffect(() => {
    if (!uid) {
      setForecast(null);
      setInsights(null);
      setAnalyticsLoading(false);
      return;
    }
    setAnalyticsLoading(true);
    const timeout = setTimeout(() => setAnalyticsLoading(false), 12000);
    const unsubscribe = db.collection('analytics').doc(uid).onSnapshot({ includeMetadataChanges: true }, (snapshot) => {
      const data = snapshot.data();
      setForecast(data?.forecast ? data.forecast as ForecastResponse : null);
      if (data?.lastInsight?.data) setInsights(data.lastInsight.data as InsightsResponse);
      else if (data?.lastInsight?.strengths) setInsights(data.lastInsight as InsightsResponse);
      else setInsights(null);
      setLastInsightAt(timestampToMillis(data?.lastInsight?.timestamp));
      setInsightsStale(Boolean(data?.insightsStale));
      if (!snapshot.metadata.fromCache || snapshot.exists()) {
        clearTimeout(timeout);
        setAnalyticsLoading(false);
      }
    }, () => {
      clearTimeout(timeout);
      setAnalyticsLoading(false);
    });
    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [uid]);

  useEffect(() => {
    if (retryCooldown <= 0) return;
    const timer = setInterval(() => setRetryCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [retryCooldown]);

  useEffect(() => {
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const writtenCooldownMs = lastInsightAt == null || clock === 0
    ? 0
    : Math.max(0, (12 * 60 * 60 * 1000) - (clock - lastInsightAt));

  const loadForecast = useCallback(async (force = false) => {
    if (!piHistory.length || retryCooldown > 0 || academicPlan.isGraduated) return;
    setForecastLoading(true);
    setRequestError(null);
    try {
      const data = await aiApi.forecast(piHistory, cgpaHistory, force);
      setForecast(data);
      if (force) showToast({ type: 'success', title: 'Forecast updated', message: 'Your latest completed results are now reflected.' });
    } catch (error: any) {
      const retryAfter = error?.retryAfterSeconds ?? 59;
      if (error?.status === 429) setRetryCooldown(retryAfter);
      setRequestError(error?.message ?? 'Could not refresh your forecast.');
      showToast({ type: error?.status === 429 ? 'warning' : 'error', title: error?.status === 429 ? 'Forecast limit reached' : 'Forecast unavailable', message: error?.message });
    } finally {
      setForecastLoading(false);
    }
  }, [academicPlan.isGraduated, cgpaHistory, piHistory, retryCooldown, showToast]);

  const loadInsights = useCallback(async (force = false) => {
    if (!semesters.length || retryCooldown > 0) return;
    if (force && writtenCooldownMs > 0) {
      setRequestError(`Written Analysis unlocks in ${formatCooldown(writtenCooldownMs)}.`);
      return;
    }
    setInsightsLoading(true);
    setRequestError(null);
    try {
      const data = await aiApi.insights(force, semesters, {
        remainingSemesters: academicPlan.remainingSlots.length,
        isGraduated: academicPlan.isGraduated,
        graduationSession: academicPlan.graduationSession,
      });
      setInsights(data);
      setInsightsStale(false);
      if (uid) await db.collection('analytics').doc(uid).set({ insightsStale: false }, { merge: true });
      if (force) showToast({ type: 'success', title: 'Written analysis updated' });
    } catch (error: any) {
      const retryAfter = error?.retryAfterSeconds ?? 59;
      if (error?.status === 429) setRetryCooldown(retryAfter);
      setRequestError(error?.message ?? 'Could not generate written analysis.');
      showToast({ type: error?.status === 429 ? 'warning' : 'error', title: error?.status === 429 ? 'Analysis limit reached' : 'Analysis unavailable', message: error?.message });
    } finally {
      setInsightsLoading(false);
    }
  }, [academicPlan.graduationSession, academicPlan.isGraduated, academicPlan.remainingSlots.length, retryCooldown, semesters, showToast, uid, writtenCooldownMs]);

  useEffect(() => {
    if (initialLoading) return;
    if (!forecast && piHistory.length && !academicPlan.isGraduated) loadForecast();
    if (!insights && semesters.length) loadInsights(false);
    // The callbacks intentionally depend on retry state; auto-generation should only run after initial data load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoading]);

  async function changeProjectionMode(mode: ProjectionMode) {
    setProjectionMode(mode);
    if (!uid) return;
    try {
      await db.collection('users').doc(uid).update({ gradeMode: mode });
    } catch {
      // The local choice remains useful even if preference sync is temporarily offline.
    }
  }

  const forecastIsLoading = forecastLoading || (!forecast && piHistory.length > 0 && !academicPlan.isGraduated && !requestError);
  const insightsAreLoading = insightsLoading || (!insights && semesters.length > 0 && !requestError);

  if (initialLoading) return <InsightsSkeletonScreen />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <View style={{ backgroundColor: colors.void, zIndex: 3 }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <AcadeMindMark size={24} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>AI Insights Hub</Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>Powered by AcadeMind · grounded in your completed results</Text>
          </View>
        </View>
      </View>

      <TourTarget tourId="insights-tabs" style={{ marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.sm, padding: 4, flexDirection: 'row', borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setTab(item.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={{ flex: 1, minHeight: 40 }}
              >
                <Animated.View layout={Layout.springify().damping(18).stiffness(230)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: active ? colors.primaryHover : 'transparent', borderWidth: active ? 1 : 0, borderColor: active ? `${colors.primaryGlow}66` : 'transparent' }}>
                  <Text numberOfLines={1} style={{ color: active ? '#FFFFFF' : colors.textMuted, fontSize: 10, fontWeight: '900' }}>{item.label}</Text>
                </Animated.View>
              </Pressable>
            );
          })}
      </TourTarget>
      <HeaderFadeEdge />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <RateLimitGuide tab={tab} />

        {!!requestError && (
          <NoticeCard icon={<AlertTriangle size={16} color={colors.warning} />} color={colors.warning} title="AcadeMind update" body={`${requestError}${retryCooldown > 0 ? ` Try again in ${retryCooldown}s.` : ''}`} />
        )}

        {insightsStale && (
          <NoticeCard icon={<RefreshCw size={16} color={colors.primary} />} color={colors.primary} title="Your results changed" body="Refresh your forecast and written analysis to use the latest completed results." />
        )}

        {tab === 'forecast' && (
          <TourTarget tourId="insights-forecast-panel">
          <ForecastTab
            forecast={forecast}
            loading={forecastIsLoading}
            onRefresh={() => loadForecast(true)}
            hasHistory={piHistory.length > 0}
            piHistory={piHistory}
            cgpaHistory={cgpaHistory}
            mode={projectionMode}
            onModeChange={changeProjectionMode}
            retryCooldown={retryCooldown}
            remainingSemesterCount={academicPlan.remainingAcademicSemesters}
            graduationSession={academicPlan.graduationSession}
            isGraduated={academicPlan.isGraduated}
          />
          </TourTarget>
        )}
        {tab === 'whatif' && <TourTarget tourId="insights-whatif-panel"><WhatIfTab currentCGPA={currentCGPA} totalCredits={totalCredits} remainingSemesterCount={academicPlan.remainingAcademicSemesters} graduationSession={academicPlan.graduationSession} /></TourTarget>}
        {tab === 'risk' && <TourTarget tourId="insights-risk-panel"><RiskTab courses={flaggedCourses} forecast={forecast} /></TourTarget>}
        {tab === 'analysis' && (
          <TourTarget tourId="insights-written-panel">
          <AnalysisTab
            insights={insights}
            loading={insightsAreLoading}
            cooldownMs={writtenCooldownMs}
            stale={insightsStale}
            onRegenerate={() => loadInsights(true)}
            isGraduated={academicPlan.isGraduated}
          />
          </TourTarget>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InsightsSkeletonScreen() {
  const colors = useThemeColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <AcadeMindMark size={24} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>AI Insights Hub</Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>Preparing your academic intelligence…</Text>
          </View>
        </View>
      </View>

      <SkeletonPulse accessibilityLabel="Loading AI insights">
        <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.sm, padding: 4, flexDirection: 'row', gap: 4, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          {[0, 1, 2, 3].map((item) => <SkeletonBlock key={item} flex={1} height={40} borderRadius={10} />)}
        </View>
        <View style={{ padding: spacing.lg, paddingTop: spacing.md }}>
          <SkeletonBlock height={52} borderRadius={12} style={{ marginBottom: spacing.md }} />
          <SkeletonBlock height={214} borderRadius={radius.lg} />
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <SkeletonBlock flex={1} height={86} />
            <SkeletonBlock flex={1} height={86} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg }}>
            <SkeletonCircle size={38} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <SkeletonLine width="56%" height={12} />
              <SkeletonLine width="82%" height={9} style={{ marginTop: 7 }} />
            </View>
          </View>
          <SkeletonBlock height={50} style={{ marginTop: spacing.lg }} />
        </View>
      </SkeletonPulse>
    </SafeAreaView>
  );
}

function RateLimitGuide({ tab }: { tab: TabType }) {
  const colors = useThemeColors();
  const copy: Record<TabType, string> = {
    forecast: 'Forecasts are cached for an hour. You can generate up to 2 new forecasts per hour and 8 per day.',
    whatif: 'Adjust freely, then request guidance when ready. AI guidance allows 3 requests per 5 minutes and 20 per day.',
    risk: 'Risk analysis uses your saved results and forecast, so viewing this tab does not consume an AI request.',
    analysis: 'Written analysis stays available from cache. Regeneration unlocks after 12 hours and is limited to 3 per day.',
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', padding: spacing.sm, marginBottom: spacing.md, borderRadius: 12, backgroundColor: colors.primaryDim, borderWidth: 1, borderColor: `${colors.primary}35` }}>
      <Clock3 size={14} color={colors.primary} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, color: colors.textMuted, fontSize: 10, lineHeight: 15, marginLeft: 8 }}>{copy[tab]}</Text>
    </View>
  );
}

function ForecastTab({ forecast, loading, onRefresh, hasHistory, piHistory, cgpaHistory, mode, onModeChange, retryCooldown, remainingSemesterCount, graduationSession, isGraduated }: {
  forecast: ForecastResponse | null;
  loading: boolean;
  onRefresh: () => void;
  hasHistory: boolean;
  piHistory: number[];
  cgpaHistory: number[];
  mode: ProjectionMode;
  onModeChange: (mode: ProjectionMode) => void;
  retryCooldown: number;
  remainingSemesterCount: number;
  graduationSession: string;
  isGraduated: boolean;
}) {
  const colors = useThemeColors();
  const { width: screenWidth } = useWindowDimensions();
  if (!hasHistory) return <EmptyState message="Complete at least one semester to unlock your forecast." />;
  if (isGraduated) return <GraduationState graduationSession={graduationSession} message="Your programme timeline is complete, so AcadeMind will not project semesters beyond graduation." />;
  if (loading && !forecast) return <LoadingState label="Forecasting your academic trajectory…" />;
  if (!forecast) return <EmptyState message="No forecast is available yet." onRetry={onRefresh} />;

  const trend = forecast.trendDirection ?? (forecast.slope > 0.02 ? 'improving' : forecast.slope < -0.02 ? 'declining' : 'stable');
  const projectionCount = Math.min(2, remainingSemesterCount);
  const projectedPi = (forecast.projectedPi ?? forecast.projected ?? []).slice(0, projectionCount);
  const projectedCgpa = (forecast.projectedCgpa ?? forecast.projected ?? []).slice(0, projectionCount);
  const chartData = [
    ...piHistory.map((value, index) => ({ x: index + 1, pi: value, gpa: cgpaHistory[index] ?? value })),
    ...projectedPi.map((value, index) => ({
      x: piHistory.length + index + 1,
      pi: value,
      gpa: projectedCgpa[index] ?? value,
    })),
  ];
  const projected = mode === 'pi'
    ? projectedPi[0]
    : projectedCgpa[0];

  return (
    <Animated.View entering={FadeInDown.springify().damping(20).stiffness(190)}>
      <Card themeColors={colors} style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
          <View style={{ flex: 1, paddingRight: spacing.sm }}>
            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 15 }}>{mode === 'pi' ? 'Performance Index Projection' : 'Cumulative GPA Projection'}</Text>
            <Text style={{ color: colors.textFaint, fontSize: 10, marginTop: 3 }}>Completed history + next {projectionCount} of {remainingSemesterCount} remaining</Text>
          </View>
          <ModeToggle mode={mode} onChange={onModeChange} />
        </View>
        {chartData.length > 1 && (
          <TrendChart data={chartData} width={screenWidth - (spacing.lg * 4)} height={184} themeColors={colors} visibleMetrics={[mode === 'cgpa' ? 'gpa' : 'pi']} />
        )}
      </Card>

      <Card themeColors={colors} style={{ marginBottom: spacing.md }}>
        <Text style={{ color: colors.textFaint, fontSize: 10, fontWeight: '800' }}>PROJECTED NEXT SEMESTER {mode.toUpperCase()}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 5 }}>
          <Text style={{ color: colors.primaryGlow, fontSize: 30, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{projected?.toFixed(2) ?? '—'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: trend === 'improving' ? colors.successDim : trend === 'declining' ? colors.dangerDim : colors.overlay }}>
            {trend === 'improving' ? <TrendingUp size={14} color={colors.success} /> : trend === 'declining' ? <TrendingDown size={14} color={colors.danger} /> : <Minus size={14} color={colors.textMuted} />}
            <Text style={{ color: trend === 'improving' ? colors.success : trend === 'declining' ? colors.danger : colors.textMuted, fontWeight: '800', fontSize: 10 }}>{forecast.trendLabel}</Text>
          </View>
        </View>
      </Card>

      <Pressable disabled={loading || retryCooldown > 0} onPress={onRefresh} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm, opacity: loading || retryCooldown > 0 ? 0.5 : 1 }}>
        <RefreshCw size={13} color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>{loading ? 'Refreshing…' : retryCooldown > 0 ? `Try again in ${retryCooldown}s` : 'Refresh forecast'}</Text>
      </Pressable>
    </Animated.View>
  );
}

function ModeToggle({ mode, onChange }: { mode: ProjectionMode; onChange: (mode: ProjectionMode) => void }) {
  const colors = useThemeColors();
  return (
    <View accessibilityRole="tablist" accessibilityLabel="Projection metric" style={{ flexDirection: 'row', padding: 3, borderRadius: 12, backgroundColor: colors.overlay, borderWidth: 1, borderColor: colors.border }}>
      {(['pi', 'cgpa'] as const).map((item) => (
        <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: mode === item }} accessibilityLabel={`Show ${item.toUpperCase()} projection`} onPress={() => onChange(item)} style={{ minHeight: 36 }}>
          <Animated.View layout={Layout.springify().damping(18).stiffness(230)} style={{ height: 36, minWidth: 52, paddingHorizontal: 8, gap: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: mode === item ? colors.primaryHover : 'transparent' }}>
            {item === 'cgpa' ? <GraduationCap size={12} color={mode === item ? '#FFFFFF' : colors.textMuted} /> : <Target size={12} color={mode === item ? '#FFFFFF' : colors.textMuted} />}
            <Text style={{ color: mode === item ? '#FFFFFF' : colors.textMuted, fontWeight: '900', fontSize: 10 }}>{item.toUpperCase()}</Text>
          </Animated.View>
        </Pressable>
      ))}
    </View>
  );
}

function WhatIfTab({ currentCGPA, totalCredits, remainingSemesterCount, graduationSession }: { currentCGPA: number; totalCredits: number; remainingSemesterCount: number; graduationSession: string }) {
  const colors = useThemeColors();
  const showToast = useToastStore((state) => state.show);
  const [targetCGPA, setTargetCGPA] = useState(Math.min(5, currentCGPA + 0.2));
  const [remainingSemesters, setRemainingSemesters] = useState(String(Math.max(1, Math.min(2, remainingSemesterCount))));
  const [creditLoad, setCreditLoad] = useState('18');
  const [result, setResult] = useState<WhatIfResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const scenarioSemesters = Math.max(1, Math.min(remainingSemesterCount || 1, Number(remainingSemesters) || 1));
  const futureCredits = scenarioSemesters * Math.max(1, Number(creditLoad) || 1);
  const requiredGPA = ((targetCGPA * (totalCredits + futureCredits)) - (currentCGPA * totalCredits)) / futureCredits;
  const requiredAverage = (requiredGPA / 5) * 100;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    setRemainingSemesters((value) => String(Math.max(1, Math.min(remainingSemesterCount || 1, Number(value) || 1))));
  }, [remainingSemesterCount]);

  async function calculate() {
    if (loading || cooldown > 0) return;
    setLoading(true);
    setError(null);
    try {
      const data = await aiApi.whatIf(currentCGPA, totalCredits, targetCGPA, scenarioSemesters, Number(creditLoad) || 18);
      setResult(data);
      setCooldown(30);
      showToast({ type: 'success', title: 'Scenario analyzed', message: 'AI guidance is ready below.' });
    } catch (requestError: any) {
      const retryAfter = requestError?.retryAfterSeconds ?? 30;
      if (requestError?.status === 429) setCooldown(retryAfter);
      setError(requestError?.message ?? 'Could not analyze this scenario.');
      showToast({ type: requestError?.status === 429 ? 'warning' : 'error', title: requestError?.status === 429 ? 'Guidance limit reached' : 'Scenario unavailable', message: requestError?.message });
    } finally {
      setLoading(false);
    }
  }

  if (remainingSemesterCount <= 0) {
    return <GraduationState graduationSession={graduationSession} message="What-If scenarios are closed because every semester in your programme has been completed." />;
  }

  return (
    <Animated.View entering={FadeInDown.springify().damping(20).stiffness(190)}>
      <Card themeColors={colors} style={{ marginBottom: spacing.md, padding: 0, overflow: 'hidden' }}>
        <View style={{ padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View>
              <Text style={{ color: colors.textFaint, fontSize: 10, fontWeight: '800' }}>TARGET CGPA</Text>
              <Text style={{ color: colors.text, fontSize: 30, fontWeight: '900', marginTop: 3 }}>{targetCGPA.toFixed(2)} <Text style={{ color: colors.textMuted, fontSize: 12 }}>/ 5.00</Text></Text>
            </View>
            <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7 }}>
              <Text style={{ color: colors.textMuted, fontSize: 10 }}>Current: {currentCGPA.toFixed(2)}</Text>
            </View>
          </View>
          <Slider minimumValue={Math.min(currentCGPA, 5)} maximumValue={5} step={0.01} value={targetCGPA} onValueChange={setTargetCGPA} minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} thumbTintColor={colors.primaryGlow} style={{ marginTop: spacing.sm }} />
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <View style={{ flex: 1 }}><Input label={`Remaining semesters (max ${remainingSemesterCount})`} keyboardType="number-pad" maxLength={2} value={remainingSemesters} onChangeText={(value) => setRemainingSemesters(value === '' ? '' : String(Math.min(remainingSemesterCount, Math.max(1, Number(value) || 1))))} themeColors={colors} /></View>
            <View style={{ flex: 1 }}><Input label="Units / semester" keyboardType="number-pad" value={creditLoad} onChangeText={setCreditLoad} themeColors={colors} /></View>
          </View>
        </View>

        <View style={{ padding: spacing.lg, backgroundColor: colors.deep }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
            <Metric value={requiredGPA > 5 ? '>5.00' : Math.max(0, requiredGPA).toFixed(2)} label="Required GPA" color={requiredGPA > 5 ? colors.danger : colors.primaryGlow} />
            <View style={{ width: 1, height: 46, backgroundColor: colors.border, marginHorizontal: spacing.lg }} />
            <Metric value={requiredGPA > 5 ? 'Impossible' : `~${Math.max(0, requiredAverage).toFixed(0)}%`} label="Target avg score" color={colors.text} />
          </View>
          {(result?.feasibilityNote || loading) && (
            <View style={{ minHeight: 70, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}><AcadeMindMark size={14} /><Text style={{ color: colors.text, fontWeight: '800', fontSize: 11 }}>AcadeMind guidance</Text></View>
              {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18 }}>{result?.feasibilityNote}</Text>}
            </View>
          )}
          <Button label={cooldown > 0 ? `AI guidance unlocks in ${cooldown}s` : 'Get AI guidance'} icon={<Target size={16} color="#FFFFFF" />} onPress={calculate} loading={loading} disabled={cooldown > 0} fullWidth themeColors={colors} />
          {!!error && <Text style={{ color: colors.danger, fontSize: 11, marginTop: spacing.sm }}>{error}</Text>}
        </View>
      </Card>
      <Text style={{ color: colors.textFaint, fontSize: 10, textAlign: 'center' }}>The mathematical result updates instantly. AI guidance uses a 30-second client cooldown.</Text>
    </Animated.View>
  );
}

function Metric({ value, label, color }: { value: string; label: string; color: string }) {
  const colors = useThemeColors();
  return <View style={{ flex: 1 }}><Text style={{ color: colors.textFaint, fontSize: 9, fontWeight: '800' }}>{label.toUpperCase()}</Text><Text style={{ color, fontSize: 23, fontWeight: '900', marginTop: 4 }}>{value}</Text></View>;
}

function RiskTab({ courses, forecast }: { courses: CourseWithId[]; forecast: ForecastResponse | null }) {
  const colors = useThemeColors();
  const riskScore = forecast?.riskScore ?? 1;
  const riskColor = riskScore >= 5 ? colors.danger : riskScore >= 4 ? colors.warning : colors.success;
  const trend = forecast?.trendDirection ?? 'stable';
  const circumference = 2 * Math.PI * 49;

  return (
    <Animated.View entering={FadeInDown.springify().damping(20).stiffness(190)}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
        <Card themeColors={colors} style={{ width: 142, alignItems: 'center' }}>
          <Text style={{ color: colors.textFaint, fontSize: 10, fontWeight: '800', marginBottom: spacing.sm }}>RISK LEVEL</Text>
          <View style={{ width: 116, height: 116, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={116} height={116} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
              <Circle cx={58} cy={58} r={49} stroke={colors.deep} strokeWidth={10} fill="none" />
              <Circle cx={58} cy={58} r={49} stroke={riskColor} strokeWidth={10} fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference - (circumference * riskScore) / 5} />
            </Svg>
            <Text style={{ color: colors.text, fontSize: 31, fontWeight: '900' }}>{riskScore}</Text>
            <Text style={{ color: colors.textFaint, fontSize: 9 }}>/ 5</Text>
          </View>
        </Card>
        <Card themeColors={colors} style={{ flex: 1, justifyContent: 'center' }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: trend === 'improving' ? colors.successDim : trend === 'declining' ? colors.dangerDim : colors.overlay }}>
            {trend === 'improving' ? <TrendingUp size={23} color={colors.success} /> : trend === 'declining' ? <TrendingDown size={23} color={colors.danger} /> : <Minus size={23} color={colors.textMuted} />}
          </View>
          <Text style={{ color: colors.text, fontWeight: '900', fontSize: 15, marginTop: spacing.md, textTransform: 'capitalize' }}>{trend} performance</Text>
          <Text style={{ color: colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 4 }}>{forecast?.trendLabel ?? 'Add completed semesters to establish a trend.'}</Text>
        </Card>
      </View>

      <Card themeColors={colors} style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ padding: spacing.md, backgroundColor: colors.deep, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <AlertTriangle size={16} color={colors.danger} />
          <Text style={{ color: colors.text, fontWeight: '900', fontSize: 13 }}>Flagged courses</Text>
        </View>
        {courses.length ? courses.map((course, index) => (
          <View key={course.id} style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: index === courses.length - 1 ? 0 : 1, borderBottomColor: colors.borderSubtle }}>
            <View style={{ width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerDim }}><Text style={{ color: colors.danger, fontWeight: '900', fontSize: 9 }}>{course.code.split(' ')[0]}</Text></View>
            <View style={{ flex: 1, marginLeft: spacing.sm }}><Text style={{ color: colors.text, fontWeight: '800', fontSize: 12 }}>{course.code}</Text><Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 2 }} numberOfLines={1}>{course.title}</Text></View>
            <Text style={{ color: getGradeColor(course.grade ?? 'F'), fontWeight: '900', fontSize: 12 }}>{course.totalScore}%</Text>
          </View>
        )) : (
          <View style={{ alignItems: 'center', padding: spacing.xxl }}><Text style={{ fontSize: 28 }}>🎉</Text><Text style={{ color: colors.success, fontWeight: '800', marginTop: spacing.sm }}>No flagged courses</Text><Text style={{ color: colors.textMuted, textAlign: 'center', fontSize: 11, marginTop: 4 }}>No completed course is currently below 50%.</Text></View>
        )}
      </Card>
    </Animated.View>
  );
}

function AnalysisTab({ insights, loading, cooldownMs, stale, onRegenerate, isGraduated }: { insights: InsightsResponse | null; loading: boolean; cooldownMs: number; stale: boolean; onRegenerate: () => void; isGraduated: boolean }) {
  const colors = useThemeColors();
  if (loading && !insights) return <LoadingState label="AcadeMind is writing your analysis…" />;
  if (!insights) return <EmptyState message="No written analysis is available yet." onRetry={onRegenerate} />;
  const locked = cooldownMs > 0;

  return (
    <Animated.View entering={FadeInDown.springify().damping(20).stiffness(190)} style={{ gap: spacing.md }}>
      {isGraduated && <NoticeCard icon={<GraduationCap size={16} color={colors.success} />} color={colors.success} title="Final academic review" body="Your programme timeline is complete. Degree Outlook is treated as a final summary, not a future projection." />}
      {locked && <NoticeCard icon={<Clock3 size={16} color={colors.warning} />} color={colors.warning} title="Quota protection is active" body={`Written Analysis can be regenerated in ${formatCooldown(cooldownMs)}. Cached analysis remains available.`} />}
      <InsightSection title="Identified Strengths" items={insights.strengths} color={colors.success} />
      <InsightSection title="Areas of Concern" items={insights.concerns} color={colors.warning} />
      <InsightSection title="Actionable Recommendations" items={insights.recommendations} color={colors.primary} />
      <Card themeColors={colors}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: spacing.sm }}><AcadeMindMark size={16} /><Text style={{ color: colors.text, fontWeight: '900' }}>{isGraduated ? 'Final Degree Review' : 'Degree Outlook'}</Text></View>
        <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20 }}>{insights.degreeOutlook}</Text>
      </Card>
      <Button label={locked ? `Unlocks in ${formatCooldown(cooldownMs)}` : stale ? 'Refresh written analysis' : 'Regenerate written analysis'} variant="secondary" onPress={onRegenerate} loading={loading} disabled={locked} fullWidth themeColors={colors} />
    </Animated.View>
  );
}

function InsightSection({ title, items, color }: { title: string; items: string[]; color: string }) {
  const colors = useThemeColors();
  if (!items?.length) return null;
  return (
    <Card themeColors={colors}>
      <Text style={{ color: colors.text, fontWeight: '900', marginBottom: spacing.sm }}>{title}</Text>
      {items.map((item, index) => <View key={index} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginTop: 6 }} /><Text style={{ color: colors.textMuted, fontSize: 13, flex: 1, lineHeight: 19 }}>{item}</Text></View>)}
    </Card>
  );
}

function NoticeCard({ icon, color, title, body }: { icon: React.ReactNode; color: string; title: string; body: string }) {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: `${color}12`, borderWidth: 1, borderColor: `${color}55`, marginBottom: spacing.md }}>
      {icon}
      <View style={{ flex: 1 }}><Text style={{ color, fontWeight: '900', fontSize: 12 }}>{title}</Text><Text style={{ color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 }}>{body}</Text></View>
    </View>
  );
}

function GraduationState({ graduationSession, message }: { graduationSession: string; message: string }) {
  const colors = useThemeColors();
  return (
    <Animated.View entering={FadeInDown.springify().damping(20).stiffness(190)} style={{ alignItems: 'center', backgroundColor: colors.successDim, borderWidth: 1, borderColor: `${colors.success}55`, borderRadius: radius.xl, padding: spacing.xl }}>
      <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        <GraduationCap size={31} color={colors.success} />
      </View>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'center', marginTop: spacing.md }}>Graduation point reached</Text>
      {!!graduationSession && <Text style={{ color: colors.success, fontSize: 12, fontWeight: '900', marginTop: 5 }}>{graduationSession}</Text>}
      <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: spacing.sm }}>{message}</Text>
    </Animated.View>
  );
}

function EmptyState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const colors = useThemeColors();
  return (
    <Animated.View entering={FadeIn.duration(250)} style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
      <AcadeMindMark size={34} />
      <Text style={{ color: colors.textMuted, textAlign: 'center', marginVertical: spacing.md }}>{message}</Text>
      {onRetry && <Button label="Try Again" variant="secondary" onPress={onRetry} themeColors={colors} />}
    </Animated.View>
  );
}

function LoadingState({ label }: { label: string }) {
  const colors = useThemeColors();
  return <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.textMuted, marginTop: spacing.md }}>{label}</Text></View>;
}
