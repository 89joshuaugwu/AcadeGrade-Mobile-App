import { useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, RefreshControl, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { GraduationCap, CheckCircle2, Lightbulb, ChevronRight, BookOpen } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { DEGREE_CLASSES, spacing, radius, type ThemeColors } from '@/constants/theme';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { AcadeMindMark } from '@/components/ui/AcadeMindMark';
import { useAcademicData } from '@/lib/store/useAcademicData';
import { useAuthStore } from '@/lib/store/authStore';
import { getGradeColor } from '@/lib/cgpa/gradeScale';
import { useThemeColors } from '@/lib/store/themeStore';
import { TourTarget } from '@/components/tour/TourTarget';
import { useAutoTour } from '@/lib/tour/useAutoTour';
import { SkeletonBlock, SkeletonCircle, SkeletonLine, SkeletonPulse } from '@/components/ui/Skeleton';
import { HeaderFadeEdge, useHeaderScrollEdge } from '@/components/ui/HeaderFadeEdge';

const PERFORMANCE_GRADIENTS = {
  first: '#166534',
  secondUpper: '#3730A3',
  secondLower: '#B45309',
  third: '#C2410C',
  pass: '#B91C1C',
  fail: '#475569',
} as const;

function getPerformanceClass(value: number) {
  const degreeClass = DEGREE_CLASSES.find((entry) => value >= entry.minCGPA && value <= entry.maxCGPA) ?? DEGREE_CLASSES[DEGREE_CLASSES.length - 1];
  const gradientKey = degreeClass.label === 'First Class'
    ? 'first'
    : degreeClass.label.includes('Upper')
      ? 'secondUpper'
      : degreeClass.label.includes('Lower')
        ? 'secondLower'
        : degreeClass.label === 'Third Class'
          ? 'third'
          : degreeClass.label === 'Pass'
            ? 'pass'
            : 'fail';
  return { ...degreeClass, gradient: PERFORMANCE_GRADIENTS[gradientKey] };
}

function blendHexColors(first: string, second: string, firstWeight: number) {
  const parse = (hex: string) => [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  const [firstRed, firstGreen, firstBlue] = parse(first);
  const [secondRed, secondGreen, secondBlue] = parse(second);
  const secondWeight = 1 - firstWeight;
  const channel = (a: number, b: number) => Math.round(a * firstWeight + b * secondWeight).toString(16).padStart(2, '0');
  return `#${channel(firstRed, secondRed)}${channel(firstGreen, secondGreen)}${channel(firstBlue, secondBlue)}`;
}

function timestampMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  const parsed = new Date(value as string).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export default function Dashboard() {
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const { semesters, coursesBySemester, cgpa, pi, totalCredits, totalCourses, atRiskCount, loading } = useAcademicData();
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const { edgeVisible, onHeaderScroll } = useHeaderScrollEdge();
  useAutoTour('dashboard', 850, !loading);

  const trendData = semesters.map((s, i) => ({ x: i + 1, gpa: s.gpa, pi: s.pi }));
  const recentGrades = useMemo(() => {
    const semesterById = new Map(semesters.map((semester) => [semester.id, semester]));
    return Object.entries(coursesBySemester)
      .flatMap(([semesterId, courses]) => courses.map((course) => ({
        ...course,
        semesterId,
        semester: semesterById.get(semesterId),
      })))
      .filter((course) => Boolean(course.grade) && !course.pending)
      .sort((a, b) => {
        const updatedDifference = timestampMillis(b.updatedAt ?? b.createdAt) - timestampMillis(a.updatedAt ?? a.createdAt);
        if (updatedDifference !== 0) return updatedDifference;
        const levelDifference = (b.semester?.level ?? 0) - (a.semester?.level ?? 0);
        if (levelDifference !== 0) return levelDifference;
        const semesterDifference = (b.semester?.semester ?? 0) - (a.semester?.semester ?? 0);
        if (semesterDifference !== 0) return semesterDifference;
        return (a.code || a.title).localeCompare(b.code || b.title);
      })
      .slice(0, 3);
  }, [coursesBySemester, semesters]);
  const semesterDelta = semesters.length >= 2 ? semesters[semesters.length - 1].gpa - semesters[semesters.length - 2].gpa : 0;
  const firstName = profile?.fullName?.split(' ')[0] ?? 'Student';
  const isPiPrimary = profile?.gradeMode === 'pi';
  const primaryMetric = isPiPrimary ? pi : cgpa;
  const secondaryMetric = isPiPrimary ? cgpa : pi;
  const primaryClass = getPerformanceClass(primaryMetric);
  const secondaryClass = getPerformanceClass(secondaryMetric);
  // The blend stays soft like the card reference: metric values influence
  // where the centre colour sits, never creating a visible hard split.
  const primaryGradientShare = Math.min(0.88, Math.max(0.12, primaryMetric / Math.max(primaryMetric + secondaryMetric, 0.01)));
  const gradientMidpoint = blendHexColors(primaryClass.gradient, secondaryClass.gradient, primaryGradientShare);
  const gradientColors = [primaryClass.gradient, gradientMidpoint, secondaryClass.gradient] as const;
  const gradientLocations = [0, primaryGradientShare, 1] as const;

  if (loading) return <DashboardSkeleton firstName={firstName} avatarUrl={profile?.avatarUrl ?? undefined} colors={c} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.void }}>
      {/* Fixed academic snapshot. Detailed information scrolls underneath. */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, backgroundColor: c.void, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl, zIndex: 2 }}>
        <Animated.View entering={FadeIn.duration(300)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
          <TourTarget tourId="dashboard-header" style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: c.text, fontSize: 22, fontWeight: '800' }}>Hello, {firstName}!</Text>
              <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 2 }}>Your academic journey is looking strong.</Text>
            </View>
            <Pressable onPress={() => router.push('/(tabs)/profile')} accessibilityLabel="Open settings">
              {profile?.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} style={{ width: 42, height: 42, borderRadius: 21 }} />
              ) : (
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: c.primaryDim, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: c.primary, fontWeight: '800' }}>{firstName.charAt(0)}</Text>
                </View>
              )}
            </Pressable>
          </TourTarget>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(350)}>
          <TourTarget tourId="dashboard-performance">
            <LinearGradient colors={gradientColors} locations={gradientLocations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.84)', fontSize: 12, fontWeight: '700' }}>PRIMARY METRIC · {isPiPrimary ? 'PI' : 'CGPA'}</Text>
                  <Text style={{ color: '#FFFFFF', fontSize: 40, fontWeight: '900', marginTop: 2 }}>{primaryMetric.toFixed(2)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <AcadeMindMark size={18} />
                  <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 11, fontWeight: '800', marginTop: 9 }}>{primaryClass.shortLabel} · {primaryClass.label}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.sm }}>
                <Pill label={`${isPiPrimary ? 'CGPA' : 'PI'} ${secondaryMetric.toFixed(2)} · ${secondaryClass.shortLabel}`} />
                <Pill label={`${totalCourses} courses`} />
                {semesterDelta !== 0 && <Pill label={`${semesterDelta > 0 ? '+' : ''}${semesterDelta.toFixed(1)} GPA`} />}
              </View>
            </LinearGradient>
          </TourTarget>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(350)} style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
          <TourTarget tourId="dashboard-stats" style={{ flex: 1, flexDirection: 'row', gap: spacing.md }}>
            <StatCard colors={c} icon={<GraduationCap size={16} color={c.primary} />} label="Courses" value={totalCourses} />
            <StatCard colors={c} icon={<CheckCircle2 size={16} color={c.success} />} label="Credits" value={totalCredits} />
            <StatCard colors={c} icon={<Lightbulb size={16} color={atRiskCount ? c.danger : c.success} />} label="At risk" value={atRiskCount} danger={atRiskCount > 0} />
          </TourTarget>
        </Animated.View>

        <HeaderFadeEdge visible={edgeVisible} height={20} />
      </View>

      <ScrollView
        ref={scrollRef}
        onScroll={onHeaderScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 500); }} tintColor={c.primary} />}
      >
        <Animated.View entering={FadeInDown.delay(160).duration(350)} style={{ marginBottom: spacing.lg }}>
          <TourTarget tourId="dashboard-recent" onTourFocus={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primaryDim }}>
                  <BookOpen size={15} color={c.primary} />
                </View>
                <View>
                  <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>Recent grades</Text>
                  <Text style={{ color: c.textFaint, fontSize: 10, marginTop: 1 }}>Your latest result updates</Text>
                </View>
              </View>
              <Pressable onPress={() => router.push('/(tabs)/results')} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: c.primary, fontSize: 12, fontWeight: '800' }}>View all</Text>
                <ChevronRight size={14} color={c.primary} />
              </Pressable>
            </View>
            {recentGrades.length === 0 ? (
              <View style={{ minHeight: 92, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
                <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '700' }}>No graded courses yet</Text>
                <Text style={{ color: c.textFaint, fontSize: 11, marginTop: 3 }}>Your newest results will appear here.</Text>
              </View>
            ) : (
              <View style={{ borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
                {recentGrades.map((course, index) => {
                  const gradeColor = getGradeColor(course.grade!);
                  const hasNumericScore = course.totalScore != null;
                  return (
                    <Pressable
                      key={`${course.semesterId}-${course.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${course.code || course.title} result`}
                      accessibilityHint="Opens the semester containing this course"
                      onPress={() => router.push({ pathname: '/(tabs)/results/[semesterId]', params: { semesterId: course.semesterId } })}
                      style={({ pressed }) => ({
                        minHeight: 78,
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: spacing.md,
                        paddingVertical: 11,
                        backgroundColor: pressed ? c.overlay : c.surface,
                        borderTopWidth: index === 0 ? 0 : 1,
                        borderTopColor: c.borderSubtle,
                        opacity: pressed ? 0.9 : 1,
                      })}
                    >
                      <View style={{ position: 'absolute', left: 0, top: 13, bottom: 13, width: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3, backgroundColor: gradeColor }} />
                      <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: `${gradeColor}18`, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
                        <Text style={{ color: gradeColor, fontWeight: '900', fontSize: 16 }}>{course.grade}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0, paddingRight: spacing.sm }}>
                        <Text style={{ color: c.text, fontWeight: '800', fontSize: 12 }} numberOfLines={1}>{course.code || 'COURSE'}</Text>
                        <Text style={{ color: c.textMuted, fontWeight: '600', fontSize: 11, marginTop: 2 }} numberOfLines={1}>{course.title || 'Untitled course'}</Text>
                        <Text style={{ color: c.textFaint, fontSize: 9, marginTop: 3 }} numberOfLines={1}>{course.semester?.label ?? 'Semester result'} · {course.units} unit{course.units === 1 ? '' : 's'}</Text>
                      </View>
                      <View style={{ minWidth: 57, alignItems: 'flex-end' }}>
                        <View style={{ paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: `${gradeColor}14` }}>
                          <Text style={{ color: gradeColor, fontWeight: '900', fontSize: 12, fontVariant: ['tabular-nums'] }}>{hasNumericScore ? course.totalScore : course.gradePoint.toFixed(1)}</Text>
                        </View>
                        <Text style={{ color: c.textFaint, fontSize: 9, marginTop: 3 }}>{hasNumericScore ? 'out of 100' : 'grade point'}</Text>
                      </View>
                      <ChevronRight size={14} color={c.textFaint} style={{ marginLeft: 4 }} />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </TourTarget>
        </Animated.View>

        {trendData.length > 1 && (
          <Animated.View entering={FadeInDown.delay(200).duration(350)} style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 14, marginBottom: spacing.sm }}>GPA Trend</Text>
            <TrendChart data={trendData} width={width - spacing.lg * 2 - 32} height={150} themeColors={c} />
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DashboardSkeleton({ firstName, avatarUrl, colors }: { firstName: string; avatarUrl?: string; colors: ThemeColors }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} scrollEnabled={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
          <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>Hello, {firstName}!</Text><Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>Preparing your academic overview…</Text></View>
          {avatarUrl ? <Image source={{ uri: avatarUrl }} style={{ width: 44, height: 44, borderRadius: 22 }} /> : <SkeletonCircle size={44} />}
        </View>
        <SkeletonPulse accessibilityLabel="Loading your academic dashboard"><SkeletonBlock height={150} borderRadius={radius.xl} style={{ marginBottom: spacing.md }} /><View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl }}><SkeletonBlock flex={1} height={82} /><SkeletonBlock flex={1} height={82} /><SkeletonBlock flex={1} height={82} /></View><View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}><SkeletonLine width="36%" height={14} /><SkeletonLine width="18%" /></View>{[0, 1, 2].map((item) => <SkeletonBlock key={item} height={66} style={{ marginBottom: 8 }} />)}<SkeletonBlock height={176} style={{ marginTop: spacing.md }} /></SkeletonPulse>
      </ScrollView>
    </SafeAreaView>
  );
}

function Pill({ label }: { label: string }) {
  return <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '600' }}>{label}</Text></View>;
}

function StatCard({ icon, label, value, danger, colors }: { icon: React.ReactNode; label: string; value: number; danger?: boolean; colors: ThemeColors }) {
  return <View style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>{icon}<Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text></View><Text style={{ color: danger ? colors.danger : colors.text, fontSize: 22, fontWeight: '800' }}>{value}</Text></View>;
}
