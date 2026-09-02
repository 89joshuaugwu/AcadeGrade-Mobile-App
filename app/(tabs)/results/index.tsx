import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BookOpen, Camera, ChevronDown, Plus, Trash2 } from 'lucide-react-native';
import { radius, spacing } from '@/constants/theme';
import { useAcademicData } from '@/lib/store/useAcademicData';
import { useAuthStore } from '@/lib/store/authStore';
import { db } from '@/lib/firebase/client';
import { useThemeColors } from '@/lib/store/themeStore';
import { useToastStore } from '@/lib/store/toastStore';
import { getGradeColor } from '@/lib/cgpa/gradeScale';
import type { CourseWithId } from '@/types/course';
import type { SemesterWithId } from '@/types/semester';

export default function ResultsList() {
  const colors = useThemeColors();
  const router = useRouter();
  const uid = useAuthStore((state) => state.firebaseUser?.uid);
  const profile = useAuthStore((state) => state.profile);
  const showToast = useToastStore((state) => state.show);
  const { semesters, coursesBySemester, cgpa, totalCredits, loading } = useAcademicData();
  const orderedSemesters = useMemo(() => [...semesters].reverse(), [semesters]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  function openAction(semesterId: string, action?: 'add' | 'scan') {
    router.push({
      pathname: '/(tabs)/results/[semesterId]',
      params: { semesterId, ...(action ? { action } : {}) },
    });
  }

  function openScanner() {
    const destination = orderedSemesters.find((semester) => !semester.isComplete) ?? orderedSemesters[0];
    if (!destination) {
      Alert.alert('Create a semester first', 'A result scan needs a semester where the detected courses can be saved.');
      return;
    }
    openAction(destination.id, 'scan');
  }

  function confirmDeleteSemester(semester: SemesterWithId) {
    if (!uid) return;
    Alert.alert(
      'Delete semester?',
      `${semester.label} and every course inside it will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete semester',
          style: 'destructive',
          onPress: async () => {
            try {
              const semesterRef = db.collection('users').doc(uid).collection('semesters').doc(semester.id);
              const courses = await semesterRef.collection('courses').get();
              const batch = db.batch();
              courses.docs.forEach((course) => batch.delete(course.ref));
              batch.delete(semesterRef);
              await batch.commit();
              markInsightsStale();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              showToast({ type: 'success', title: 'Semester deleted', message: `${semester.label} and its courses were removed.` });
            } catch (error: any) {
              Alert.alert('Could not delete semester', error?.message ?? 'Please try again.');
            }
          },
        },
      ],
    );
  }

  function confirmDeleteCourse(semesterId: string, course: CourseWithId) {
    if (!uid) return;
    Alert.alert('Delete course?', `${course.code} — ${course.title} will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete course',
        style: 'destructive',
        onPress: async () => {
          try {
            await db.collection('users').doc(uid).collection('semesters').doc(semesterId).collection('courses').doc(course.id).delete();
            markInsightsStale();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            showToast({ type: 'success', title: 'Course deleted', message: `${course.code} was removed.` });
          } catch (error: any) {
            Alert.alert('Could not delete course', error?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <FlatList
        data={orderedSemesters}
        keyExtractor={(semester) => semester.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 120, gap: spacing.sm }}
        ListHeaderComponent={
          <View style={{ paddingTop: spacing.md, paddingBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: spacing.md }}>
                <Text style={{ color: colors.text, fontSize: 25, fontWeight: '900', letterSpacing: -0.7 }}>Results Hub</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 3 }} numberOfLines={1}>
                  {[profile?.university, profile?.department].filter(Boolean).join(' · ') || 'Your academic record'}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Scan a result slip"
                onPress={openScanner}
                style={{ width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
              >
                <Camera size={19} color={colors.text} />
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              <StatCard value={cgpa.toFixed(2)} label="CGPA" color={colors.primaryGlow} />
              <StatCard value={String(semesters.length)} label="Semesters" color={colors.info} />
              <StatCard value={String(totalCredits)} label="Credits" color={colors.success} />
            </View>

            <Pressable
              onPress={() => router.push('/(tabs)/results/new')}
              style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.deep }}
            >
              <Plus size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>New semester</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
              <BookOpen size={32} color={colors.primary} />
              <Text style={{ color: colors.text, fontWeight: '800', marginTop: spacing.md }}>No semesters yet</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 4, paddingHorizontal: spacing.xl }}>
                Create your first semester, then add courses manually or scan a result slip.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 45).duration(260)} layout={LinearTransition.duration(200)}>
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
        )}
      />
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
          <Animated.View entering={FadeInDown.duration(180)} style={{ borderTopWidth: 1, borderTopColor: colors.borderSubtle, padding: spacing.md, paddingTop: spacing.sm }}>
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
          </Animated.View>
        )}
      </View>
  );
}
