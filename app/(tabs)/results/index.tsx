import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BookOpen, ChevronDown, GraduationCap, Plus, Trash2 } from 'lucide-react-native';
import { radius, spacing } from '@/constants/theme';
import { useAcademicData } from '@/lib/store/useAcademicData';
import { useAuthStore } from '@/lib/store/authStore';
import { db } from '@/lib/firebase/client';
import { useThemeColors } from '@/lib/store/themeStore';
import { useToastStore } from '@/lib/store/toastStore';
import { useConfirmDialogStore } from '@/lib/store/confirmDialogStore';
import { getGradeColor } from '@/lib/cgpa/gradeScale';
import type { CourseWithId } from '@/types/course';
import type { SemesterWithId } from '@/types/semester';
import { getAcademicPlan } from '@/lib/academic/timeline';
import { TourTarget } from '@/components/tour/TourTarget';
import { useAutoTour } from '@/lib/tour/useAutoTour';
import { SkeletonBlock, SkeletonLine, SkeletonPulse } from '@/components/ui/Skeleton';
import { FixedPageHeader } from '@/components/ui/FixedPageHeader';
import { useHeaderScrollEdge } from '@/components/ui/HeaderFadeEdge';

export default function ResultsList() {
  const colors = useThemeColors();
  const router = useRouter();
  const uid = useAuthStore((state) => state.firebaseUser?.uid);
  const profile = useAuthStore((state) => state.profile);
  const showToast = useToastStore((state) => state.show);
  const showConfirm = useConfirmDialogStore((state) => state.show);
  const { semesters, coursesBySemester, cgpa, totalCredits, loading } = useAcademicData();
  const orderedSemesters = useMemo(() => [...semesters].reverse(), [semesters]);
  const academicPlan = useMemo(() => getAcademicPlan(profile, semesters), [profile, semesters]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const { edgeVisible, onHeaderScroll } = useHeaderScrollEdge();
  useAutoTour('results', 650, !loading);

  function markInsightsStale() {
    if (!uid) return;
    db.collection('analytics').doc(uid).set({ insightsStale: true }, { merge: true }).catch(() => undefined);
  }

  useEffect(() => {
    if (!expandedId && orderedSemesters.length) setExpandedId(orderedSemesters[0].id);
    if (expandedId && !orderedSemesters.some((semester) => semester.id === expandedId)) {
      setExpandedId(orderedSemesters[0]?.id ?? null);
    }
  }, [expandedId, orderedSemesters]);

  function openAction(semesterId: string, action?: 'add') {
    router.push({
      pathname: '/(tabs)/results/[semesterId]',
      params: { semesterId, ...(action ? { action } : {}) },
    });
  }

  function confirmDeleteSemester(semester: SemesterWithId) {
    if (!uid) return;
    showConfirm({
      title: 'Delete this semester?',
      message: `${semester.label} and every course inside it will be permanently removed.`,
      confirmLabel: 'Delete semester',
      cancelLabel: 'Keep semester',
      tone: 'danger',
      onConfirm: async () => {
        try {
          const semesterRef = db.collection('users').doc(uid).collection('semesters').doc(semester.id);
          const courses = await semesterRef.collection('courses').get();
          const batch = db.batch();
          courses.docs.forEach((course) => batch.delete(course.ref));
          batch.delete(semesterRef);
          await batch.commit();
          markInsightsStale();
          showToast({ type: 'success', title: 'Semester deleted', message: `${semester.label} and its courses were removed.` });
        } catch (error: any) {
          showToast({ type: 'error', title: 'Could not delete semester', message: error?.message ?? 'Please try again.' });
        }
      },
    });
  }

  function confirmDeleteCourse(semesterId: string, course: CourseWithId) {
    if (!uid) return;
    showConfirm({
      title: 'Delete this course?',
      message: `${course.code} — ${course.title} will be removed from this semester.`,
      confirmLabel: 'Delete course',
      cancelLabel: 'Keep course',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await db.collection('users').doc(uid).collection('semesters').doc(semesterId).collection('courses').doc(course.id).delete();
          markInsightsStale();
          showToast({ type: 'success', title: 'Course deleted', message: `${course.code} was removed.` });
        } catch (error: any) {
          showToast({ type: 'error', title: 'Could not delete course', message: error?.message ?? 'Please try again.' });
        }
      },
    });
  }

  if (loading) {
    return <ResultsSkeleton subtitle={[profile?.university, profile?.department].filter(Boolean).join(' · ') || 'Your academic record'} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <FixedPageHeader
        title="Results Hub"
        subtitle={[profile?.university, profile?.department].filter(Boolean).join(' · ') || 'Your academic record'}
        edgeVisible={edgeVisible}
      />
      <ScrollView
        ref={scrollRef}
        onScroll={onHeaderScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 120 }}
      >
        <View style={{ paddingBottom: spacing.lg }}>
          <TourTarget tourId="results-overview" onTourFocus={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}>
          <Animated.View entering={FadeInDown.springify().damping(20).stiffness(190)} style={{ flexDirection: 'row', gap: spacing.sm }}>
            <StatCard value={cgpa.toFixed(2)} label="CGPA" color={colors.primaryGlow} />
            <StatCard value={String(semesters.length)} label="Semesters" color={colors.info} />
            <StatCard value={String(totalCredits)} label="Credits" color={colors.success} />
          </Animated.View>
          </TourTarget>

          <TourTarget tourId="results-create">
          <Pressable
            disabled={academicPlan.isFullyCreated}
            onPress={() => router.push('/(tabs)/results/new')}
            accessibilityState={{ disabled: academicPlan.isFullyCreated }}
            style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 13, borderRadius: radius.md, borderWidth: 1, borderColor: academicPlan.isFullyCreated ? colors.border : colors.primary, backgroundColor: academicPlan.isFullyCreated ? colors.overlay : colors.primaryDim, opacity: academicPlan.isFullyCreated ? 0.72 : 1 }}
          >
            {academicPlan.isFullyCreated ? <GraduationCap size={16} color={colors.success} /> : <Plus size={16} color={colors.primary} />}
            <Text style={{ color: academicPlan.isFullyCreated ? colors.textMuted : colors.primary, fontSize: 12, fontWeight: '800' }}>{academicPlan.isFullyCreated ? 'All programme semesters added' : 'Create next semester'}</Text>
          </Pressable>
          {academicPlan.isFullyCreated && <Text style={{ color: colors.textFaint, fontSize: 10, textAlign: 'center', marginTop: 6 }}>Increase programme duration in Settings to add another academic year.</Text>}
          </TourTarget>
        </View>

        <TourTarget tourId="results-semesters" onTourFocus={() => scrollRef.current?.scrollTo({ y: 215, animated: true })}>
        {!orderedSemesters.length ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
            <BookOpen size={32} color={colors.primary} />
            <Text style={{ color: colors.text, fontWeight: '800', marginTop: spacing.md }}>No semesters yet</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 4, paddingHorizontal: spacing.xl }}>
              Create your first semester, then add courses manually or scan a result slip.
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {orderedSemesters.map((item, index) => (
              <Animated.View key={item.id} entering={FadeInDown.delay(index * 35).springify().damping(20).stiffness(185)}>
              <SemesterCard
                semester={item}
                courses={coursesBySemester[item.id] ?? []}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId((current) => current === item.id ? null : item.id)}
                onOpen={() => openAction(item.id)}
                onAdd={() => openAction(item.id, 'add')}
                onDeleteSemester={() => confirmDeleteSemester(item)}
                onDeleteCourse={(course) => confirmDeleteCourse(item.id, course)}
              />
              </Animated.View>
            ))}
          </View>
        )}
        </TourTarget>
      </ScrollView>
    </SafeAreaView>
  );
}

function ResultsSkeleton({ subtitle }: { subtitle: string }) {
  const colors = useThemeColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <FixedPageHeader title="Results Hub" subtitle={subtitle} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 120 }} scrollEnabled={false}>
        <SkeletonPulse accessibilityLabel="Loading your results timeline">
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <SkeletonBlock flex={1} height={72} />
            <SkeletonBlock flex={1} height={72} />
            <SkeletonBlock flex={1} height={72} />
          </View>
          <SkeletonBlock height={48} style={{ marginTop: spacing.md, marginBottom: spacing.xl }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <SkeletonLine width="42%" height={13} />
            <SkeletonLine width="16%" />
          </View>
          {[86, 112, 86, 86].map((height, index) => (
            <SkeletonBlock key={`${height}-${index}`} height={height} style={{ marginBottom: spacing.sm }} />
          ))}
        </SkeletonPulse>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ value, label, color }: { value: string; label: string; color: string }) {
  const colors = useThemeColors();
  return (
    <View style={{ flex: 1, minHeight: 72, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ color, fontSize: 19, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ color: colors.textFaint, fontSize: 10, marginTop: 3 }}>{label}</Text>
    </View>
  );
}

function SemesterCard({
  semester,
  courses,
  expanded,
  onToggle,
  onOpen,
  onAdd,
  onDeleteSemester,
  onDeleteCourse,
}: {
  semester: SemesterWithId;
  courses: CourseWithId[];
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onAdd: () => void;
  onDeleteSemester: () => void;
  onDeleteCourse: (course: CourseWithId) => void;
}) {
  const colors = useThemeColors();
  const borderColor = !semester.isComplete ? colors.success : expanded ? colors.primary : colors.border;

  return (
    <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor, backgroundColor: colors.deep, overflow: 'hidden' }}>
        <View style={{ padding: spacing.md, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={onToggle} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          {!semester.isComplete && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success, marginRight: spacing.sm }} />}
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>{semester.label}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 3 }}>
              {semester.isComplete ? `${courses.length} courses · ${semester.creditLoaded || 0} credits` : `Ongoing · ${courses.length} courses added`}
            </Text>
          </View>
          {semester.isComplete && (
            <View style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.primaryDim, borderWidth: 1, borderColor: colors.primary }}>
              <Text style={{ color: colors.primaryGlow, fontWeight: '900', fontSize: 10 }}>GPA {Number(semester.gpa || 0).toFixed(2)}</Text>
            </View>
          )}
          <ChevronDown size={17} color={colors.textFaint} style={{ marginLeft: spacing.sm, transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${semester.label}`}
            hitSlop={8}
            onPress={onDeleteSemester}
            style={{ width: 34, height: 34, marginLeft: spacing.sm, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}
          >
            <Trash2 color={colors.textFaint} size={17} />
          </Pressable>
        </View>

        {expanded && (
          <View style={{ borderTopWidth: 1, borderTopColor: colors.borderSubtle, padding: spacing.md, paddingTop: spacing.sm }}>
            {courses.length > 0 ? (
              <>
                <View style={{ flexDirection: 'row', paddingHorizontal: spacing.sm, paddingBottom: 6 }}>
                  <Text style={{ color: colors.textFaint, fontSize: 9, flex: 1.8 }}>CODE / TITLE</Text>
                  <Text style={{ color: colors.textFaint, fontSize: 9, width: 32, textAlign: 'center' }}>CR</Text>
                  <Text style={{ color: colors.textFaint, fontSize: 9, width: 36, textAlign: 'center' }}>GRD</Text>
                  <Text style={{ color: colors.textFaint, fontSize: 9, width: 42, textAlign: 'right' }}>SCORE</Text>
                </View>
                {courses.map((course) => (
                    <View
                      key={course.id}
                      style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, marginBottom: 5, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: course.totalScore != null && course.totalScore < 50 ? colors.danger : colors.borderSubtle }}
                    >
                      <Pressable onPress={onOpen} style={{ flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ flex: 1.8, paddingRight: spacing.sm }}>
                          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 10 }}>{course.code}</Text>
                          <Text style={{ color: colors.textMuted, fontSize: 9, marginTop: 2 }} numberOfLines={1}>{course.title}</Text>
                        </View>
                        <Text style={{ color: colors.textMuted, fontSize: 10, width: 32, textAlign: 'center' }}>{course.units}</Text>
                        <View style={{ width: 36, alignItems: 'center' }}>
                          <View style={{ minWidth: 22, paddingHorizontal: 5, paddingVertical: 4, borderRadius: 6, backgroundColor: `${getGradeColor(course.grade ?? 'F')}1F` }}>
                            <Text style={{ color: getGradeColor(course.grade ?? 'F'), textAlign: 'center', fontWeight: '900', fontSize: 9 }}>{course.isAR ? 'AR' : course.grade}</Text>
                          </View>
                        </View>
                        <Text style={{ color: course.totalScore != null && course.totalScore < 50 ? colors.danger : colors.textMuted, fontWeight: '800', fontSize: 10, width: 42, textAlign: 'right' }}>
                          {course.isAR ? '—' : course.totalScore == null ? '—' : `${course.totalScore}%`}
                        </Text>
                      </Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${course.code}`} hitSlop={8} onPress={() => onDeleteCourse(course)} style={{ width: 30, height: 34, marginLeft: 5, alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 color={colors.textFaint} size={15} />
                      </Pressable>
                    </View>
                ))}
              </>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                <Plus size={24} color={colors.textFaint} />
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: spacing.sm }}>No courses yet</Text>
                <Text style={{ color: colors.textFaint, fontSize: 9, marginTop: 3 }}>Tap Add Course to start tracking</Text>
              </View>
            )}

            <Pressable onPress={onAdd} style={{ marginTop: spacing.sm, paddingVertical: 11, borderRadius: 9, alignItems: 'center', borderWidth: 1, borderColor: colors.primary }}>
              <Text style={{ color: colors.primaryGlow, fontSize: 11, fontWeight: '800' }}>＋ Add Course</Text>
            </Pressable>
          </View>
        )}
      </View>
  );
}
