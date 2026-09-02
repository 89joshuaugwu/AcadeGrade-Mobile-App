import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { AlertTriangle, Clock3, Minus, RefreshCw, Target, TrendingDown, TrendingUp } from 'lucide-react-native';
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

const { width: screenWidth } = Dimensions.get('window');

type TabType = 'forecast' | 'whatif' | 'risk' | 'analysis';
type ProjectionMode = 'pi' | 'cgpa';

const TABS: { id: TabType; label: string }[] = [
  { id: 'forecast', label: 'Forecast' },
  { id: 'whatif', label: 'What-If' },
  { id: 'risk', label: 'Risk Analysis' },
  { id: 'analysis', label: 'Written Analysis' },
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
  const { semesters, coursesBySemester, loading } = useAcademicData();
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

  useEffect(() => setProjectionMode(profile?.gradeMode ?? 'pi'), [profile?.gradeMode]);

  const completedSemesters = useMemo(
    () => semesters.filter((semester) => semester.isComplete),
    [semesters],
  );

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
    if (!uid) return;
    return db.collection('analytics').doc(uid).onSnapshot((snapshot) => {
      const data = snapshot.data();
      if (data?.forecast) setForecast(data.forecast as ForecastResponse);
      if (data?.lastInsight?.data) setInsights(data.lastInsight.data as InsightsResponse);
      else if (data?.lastInsight?.strengths) setInsights(data.lastInsight as InsightsResponse);
      setLastInsightAt(timestampToMillis(data?.lastInsight?.timestamp));
      setInsightsStale(Boolean(data?.insightsStale));
    });
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
    if (!piHistory.length || retryCooldown > 0) return;
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
  }, [cgpaHistory, piHistory, retryCooldown, showToast]);

  const loadInsights = useCallback(async (force = false) => {
    if (!semesters.length || retryCooldown > 0) return;
    if (force && writtenCooldownMs > 0) {
      setRequestError(`Written Analysis unlocks in ${formatCooldown(writtenCooldownMs)}.`);
      return;
    }
    setInsightsLoading(true);
    setRequestError(null);
    try {
      const data = await aiApi.insights(force, semesters);
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
  }, [retryCooldown, semesters, showToast, uid, writtenCooldownMs]);

  useEffect(() => {
    if (loading) return;
    if (!forecast && piHistory.length) loadForecast();
    if (!insights && semesters.length) loadInsights(false);
    // The callbacks intentionally depend on retry state; auto-generation should only run after initial data load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  async function changeProjectionMode(mode: ProjectionMode) {
    setProjectionMode(mode);
    if (!uid) return;
    try {
      await db.collection('users').doc(uid).update({ gradeMode: mode });
    } catch {
      // The local choice remains useful even if preference sync is temporarily offline.
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <AcadeMindMark size={24} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>AI Insights Hub</Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>Powered by AcadeMind · grounded in your completed results</Text>
          </View>
        </View>
      </View>

      <View style={{ height: 48 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 6 }}>
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setTab(item.id)}
                style={{ justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: active ? colors.primary : colors.surface, borderWidth: 1, borderColor: active ? colors.primaryGlow : colors.border }}
              >
                <Text style={{ color: active ? '#FFFFFF' : colors.textMuted, fontSize: 11, fontWeight: '800' }}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.md, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {!!requestError && (
          <NoticeCard icon={<AlertTriangle size={16} color={colors.warning} />} color={colors.warning} title="AcadeMind update" body={`${requestError}${retryCooldown > 0 ? ` Try again in ${retryCooldown}s.` : ''}`} />
        )}

        {insightsStale && (
          <NoticeCard icon={<RefreshCw size={16} color={colors.primary} />} color={colors.primary} title="Your results changed" body="Refresh your forecast and written analysis to use the latest completed results." />
        )}

        {tab === 'forecast' && (
          <ForecastTab
            forecast={forecast}
            loading={forecastLoading}
            onRefresh={() => loadForecast(true)}
            hasHistory={piHistory.length > 0}
            piHistory={piHistory}
            cgpaHistory={cgpaHistory}
            mode={projectionMode}
            onModeChange={changeProjectionMode}
            retryCooldown={retryCooldown}
          />
        )}
        {tab === 'whatif' && <WhatIfTab currentCGPA={currentCGPA} totalCredits={totalCredits} />}
        {tab === 'risk' && <RiskTab courses={flaggedCourses} forecast={forecast} />}
        {tab === 'analysis' && (
          <AnalysisTab
            insights={insights}
            loading={insightsLoading}
            cooldownMs={writtenCooldownMs}
            stale={insightsStale}
            onRegenerate={() => loadInsights(true)}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ForecastTab({ forecast, loading, onRefresh, hasHistory, piHistory, cgpaHistory, mode, onModeChange, retryCooldown }: {
  forecast: ForecastResponse | null;
  loading: boolean;
  onRefresh: () => void;
  hasHistory: boolean;
  piHistory: number[];
  cgpaHistory: number[];
  mode: ProjectionMode;
  onModeChange: (mode: ProjectionMode) => void;
  retryCooldown: number;
}) {
  const colors = useThemeColors();
  if (!hasHistory) return <EmptyState message="Complete at least one semester to unlock your forecast." />;
  if (loading && !forecast) return <LoadingState label="Forecasting your academic trajectory…" />;
  if (!forecast) return <EmptyState message="No forecast is available yet." onRetry={onRefresh} />;

  const trend = forecast.trendDirection ?? (forecast.slope > 0.02 ? 'improving' : forecast.slope < -0.02 ? 'declining' : 'stable');
  const chartData = [
    ...piHistory.map((value, index) => ({ x: index + 1, pi: value, gpa: cgpaHistory[index] ?? value })),
    ...(forecast.projectedPi ?? forecast.projected ?? []).map((value, index) => ({
      x: piHistory.length + index + 1,
      pi: value,
      gpa: forecast.projectedCgpa?.[index] ?? forecast.projected?.[index] ?? value,
    })),
  ];
  const projected = mode === 'pi'
    ? (forecast.projectedPi ?? forecast.projected)?.[0]
    : (forecast.projectedCgpa ?? forecast.projected)?.[0];

  return (
    <Animated.View entering={FadeInDown.duration(280)}>
      <Card themeColors={colors} style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
          <View style={{ flex: 1, paddingRight: spacing.sm }}>
            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 15 }}>{mode === 'pi' ? 'Performance Index Projection' : 'Cumulative GPA Projection'}</Text>
            <Text style={{ color: colors.textFaint, fontSize: 10, marginTop: 3 }}>Completed history + next two semesters</Text>
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
    <View style={{ flexDirection: 'row', padding: 3, borderRadius: 9, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.border }}>
      {(['pi', 'cgpa'] as const).map((item) => (
        <Pressable key={item} onPress={() => onChange(item)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7, backgroundColor: mode === item ? colors.surface : 'transparent' }}>
          <Text style={{ color: mode === item ? colors.text : colors.textMuted, fontWeight: '900', fontSize: 10 }}>{item.toUpperCase()}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function WhatIfTab({ currentCGPA, totalCredits }: { currentCGPA: number; totalCredits: number }) {
  const colors = useThemeColors();
  const showToast = useToastStore((state) => state.show);
  const [targetCGPA, setTargetCGPA] = useState(Math.min(5, currentCGPA + 0.2));
  const [remainingSemesters, setRemainingSemesters] = useState('2');
  const [creditLoad, setCreditLoad] = useState('18');
  const [result, setResult] = useState<WhatIfResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const futureCredits = Math.max(1, Number(remainingSemesters) || 1) * Math.max(1, Number(creditLoad) || 1);
  const requiredGPA = ((targetCGPA * (totalCredits + futureCredits)) - (currentCGPA * totalCredits)) / futureCredits;
  const requiredAverage = (requiredGPA / 5) * 100;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function calculate() {
    if (loading || cooldown > 0) return;
    setLoading(true);
    setError(null);
    try {
      const data = await aiApi.whatIf(currentCGPA, totalCredits, targetCGPA, Number(remainingSemesters) || 1, Number(creditLoad) || 18);
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

  return (
    <Animated.View entering={FadeInDown.duration(280)}>
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
            <View style={{ flex: 1 }}><Input label="Remaining semesters" keyboardType="number-pad" value={remainingSemesters} onChangeText={setRemainingSemesters} themeColors={colors} /></View>
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
    <Animated.View entering={FadeInDown.duration(280)}>
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

function AnalysisTab({ insights, loading, cooldownMs, stale, onRegenerate }: { insights: InsightsResponse | null; loading: boolean; cooldownMs: number; stale: boolean; onRegenerate: () => void }) {
  const colors = useThemeColors();
  if (loading && !insights) return <LoadingState label="AcadeMind is writing your analysis…" />;
  if (!insights) return <EmptyState message="No written analysis is available yet." onRetry={onRegenerate} />;
  const locked = cooldownMs > 0;

  return (
    <Animated.View entering={FadeInDown.duration(280)} style={{ gap: spacing.md }}>
      {locked && <NoticeCard icon={<Clock3 size={16} color={colors.warning} />} color={colors.warning} title="Quota protection is active" body={`Written Analysis can be regenerated in ${formatCooldown(cooldownMs)}. Cached analysis remains available.`} />}
      <InsightSection title="Identified Strengths" items={insights.strengths} color={colors.success} />
      <InsightSection title="Areas of Concern" items={insights.concerns} color={colors.warning} />
      <InsightSection title="Actionable Recommendations" items={insights.recommendations} color={colors.primary} />
      <Card themeColors={colors}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: spacing.sm }}><AcadeMindMark size={16} /><Text style={{ color: colors.text, fontWeight: '900' }}>Degree Outlook</Text></View>
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
