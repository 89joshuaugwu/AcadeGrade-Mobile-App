import { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Image, RefreshControl, Switch, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { GraduationCap, CheckCircle2, Lightbulb, ChevronRight } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { spacing, radius, type ThemeColors } from '@/constants/theme';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { AcadeMindMark } from '@/components/ui/AcadeMindMark';
import { useAcademicData } from '@/lib/store/useAcademicData';
import { useAuthStore } from '@/lib/store/authStore';
import { db } from '@/lib/firebase/client';
import { getGradeColor } from '@/lib/cgpa/gradeScale';
import { useThemeColors } from '@/lib/store/themeStore';

const { width } = Dimensions.get('window');

/**
 * REBUILT to match the inspiration reference exactly (image 4,
 * "UserDashboard" panel) rather than the previous radial-gauge layout:
 * greeting header, gradient hero card (Current GPA + trend badges),
 * Completed/Credits stat pair, a dismissible "New to AcadeGrade?" tour
 * nudge, Recent Grades list, GPA Trend chart. Light theme throughout,
 * matching every other screen rebuilt this round.
 */
export default function Dashboard() {
  const c = useThemeColors();
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const { semesters, allCourses, cgpa, pi, totalCredits, totalCourses, atRiskCount } = useAcademicData();
  const [refreshing, setRefreshing] = useState(false);
  const [tourDismissed, setTourDismissed] = useState(!!profile?.mobileOnboardingCompleted);
  useEffect(() => setTourDismissed(!!profile?.mobileOnboardingCompleted), [profile?.mobileOnboardingCompleted]);

  const trendData = semesters.map((s, i) => ({ x: i + 1, gpa: s.gpa, pi: s.pi }));
  const recentGrades = useMemo(
    () => [...allCourses].filter((x) => x.grade).sort((a, b) => ((b.updatedAt as any)?.toMillis?.() ?? 0) - ((a.updatedAt as any)?.toMillis?.() ?? 0)).slice(0, 3),
    [allCourses]
  );

  const semesterDelta = semesters.length >= 2 ? semesters[semesters.length - 1].gpa - semesters[semesters.length - 2].gpa : 0;

  async function handleToggleTour(value: boolean) {
    setTourDismissed(!value);
    if (firebaseUser) await db.collection('users').doc(firebaseUser.uid).update({ mobileOnboardingCompleted: !value });
  }

  const firstName = profile?.fullName?.split(' ')[0] ?? 'Student';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.void }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 500); }} tintColor={c.primary} />}
      >
        {/* HEADER */}
        <Animated.View entering={FadeIn.duration(300)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
          <View>
            <Text style={{ color: c.text, fontSize: 22, fontWeight: '800' }}>Hello, {firstName}!</Text>
            <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 2 }}>Your academic journey is looking strong.</Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/profile')}>
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={{ width: 44, height: 44, borderRadius: 22 }} />
            ) : (
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.primaryDim, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: c.primary, fontWeight: '800' }}>{firstName.charAt(0)}</Text>
              </View>
            )}
          </Pressable>
        </Animated.View>

        {/* GRADIENT HERO CARD */}
        <Animated.View entering={FadeInDown.delay(60).duration(350)}>
          <LinearGradient
            colors={['#B45309', '#7C3AED', '#4F46E5']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' }}>Current GPA</Text>
              <AcadeMindMark size={18} />
            </View>
            <Text style={{ color: '#FFFFFF', fontSize: 40, fontWeight: '800', marginTop: 4 }}>{cgpa.toFixed(2)}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.sm }}>
              <Pill label={`PI ${pi.toFixed(2)} · ${totalCourses} courses`} />
              {semesterDelta !== 0 && <Pill label={`${semesterDelta > 0 ? '+' : ''}${semesterDelta.toFixed(1)} this semester`} />}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* STAT PAIR */}
        <Animated.View entering={FadeInDown.delay(100).duration(350)} style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
          <StatCard colors={c} icon={<GraduationCap size={16} color={c.primary} />} label="Courses" value={totalCourses} />
          <StatCard colors={c} icon={<CheckCircle2 size={16} color={c.success} />} label="Credits" value={totalCredits} />
          <StatCard colors={c} icon={<Lightbulb size={16} color={atRiskCount ? c.danger : c.success} />} label="At risk" value={atRiskCount} danger={atRiskCount > 0} />
        </Animated.View>

        {/* TOUR NUDGE */}
        {!tourDismissed && (
          <Animated.View entering={FadeInDown.delay(140).duration(350)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: c.primaryDim, borderWidth: 1, borderColor: c.primary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg }}>
            <Lightbulb size={18} color={c.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>New to AcadeGrade?</Text>
              <Text style={{ color: c.textMuted, fontSize: 12 }}>Take a 2-minute tour to set up your courses.</Text>
            </View>
            <Switch value={!tourDismissed} onValueChange={handleToggleTour} trackColor={{ true: c.primary, false: c.border }} thumbColor="#FFFFFF" />
          </Animated.View>
        )}

        {/* RECENT GRADES */}
        <Animated.View entering={FadeInDown.delay(180).duration(350)} style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>Recent Grades</Text>
            <Pressable onPress={() => router.push('/(tabs)/results')} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: c.primary, fontSize: 12, fontWeight: '700' }}>View All</Text>
              <ChevronRight size={14} color={c.primary} />
            </Pressable>
          </View>
          {recentGrades.length === 0 ? (
            <Text style={{ color: c.textFaint, fontSize: 13 }}>No graded courses yet.</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {recentGrades.map((course) => {
                const gradeColor = getGradeColor(course.grade!);
                return (
                  <View key={course.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${gradeColor}18`, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
                      <Text style={{ color: gradeColor, fontWeight: '800', fontSize: 13 }}>{course.grade}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.text, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>{course.title || course.code}</Text>
                      <Text style={{ color: c.textFaint, fontSize: 11 }}>{course.grade} · {course.units} Credits</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: gradeColor, fontWeight: '800', fontSize: 14 }}>{course.totalScore ?? '—'}/100</Text>
                      <Text style={{ color: c.textFaint, fontSize: 10 }}>Score</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Animated.View>

        {/* GPA TREND */}
        {trendData.length > 1 && (
          <Animated.View entering={FadeInDown.delay(220).duration(350)} style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 14, marginBottom: spacing.sm }}>GPA Trend</Text>
            <TrendChart data={trendData} width={width - spacing.lg * 2 - 32} height={150} themeColors={c} />
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

function StatCard({ icon, label, value, danger, colors }: { icon: React.ReactNode; label: string; value: number; danger?: boolean; colors: ThemeColors }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {icon}
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
      </View>
      <Text style={{ color: danger ? colors.danger : colors.text, fontSize: 22, fontWeight: '800' }}>{value}</Text>
    </View>
  );
}
