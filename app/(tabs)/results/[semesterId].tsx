import { useState, useEffect } from 'react';
import { View, Text, FlatList, Modal, ScrollView, Pressable, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { ArrowLeft, Plus, Camera, Trash2, X } from 'lucide-react-native';
import firestore from '@react-native-firebase/firestore';
import { spacing } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ResultScannerModal } from '@/components/results/ResultScannerModal';
import { db } from '@/lib/firebase/client';
import { useAuthStore } from '@/lib/store/authStore';
import { computeCourseMetrics, computeSemesterGPA } from '@/lib/cgpa/calculator';
import { getGradeColor } from '@/lib/cgpa/gradeScale';
import { resultsApi } from '@/lib/api/client';
import type { CourseWithId, CourseInput } from '@/types/course';
import { useThemeColors } from '@/lib/store/themeStore';

/**
 * REBUILT: light theme + a proper multi-source OCR upload menu, matching
 * what web actually supports (`app/api/results/extract/route.ts` accepts
 * both `application/pdf` and any `image/*` mimeType) — mobile previously
 * only offered live camera capture. Added Gallery and Document (PDF) as
 * upload sources too, via a new bottom sheet-style action menu.
 * Also fixed a real bug in `resultsApi.extract()` itself (see lib/api/client.ts) —
 * it was sending the wrong field name, so every scan silently failed
 * server-side regardless of the source picked here.
 */
export default function SemesterDetail() {
  const colors = useThemeColors();
  const router = useRouter();
  const { semesterId, action } = useLocalSearchParams<{ semesterId: string; action?: string }>();
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const [courses, setCourses] = useState<CourseWithId[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [reviewCourses, setReviewCourses] = useState<CourseInput[] | null>(null);
  const [savingScan, setSavingScan] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseWithId | null>(null);
  const [completing, setCompleting] = useState(false);

  function markInsightsStale() {
    if (!uid) return;
    db.collection('analytics').doc(uid).set({ insightsStale: true }, { merge: true }).catch(() => undefined);
  }

  useEffect(() => {
    if (action === 'add') setModalOpen(true);
    if (action === 'scan') setScannerOpen(true);
  }, [action]);

  useEffect(() => {
    if (!uid || !semesterId) return;
    return db
      .collection('users').doc(uid)
      .collection('semesters').doc(semesterId)
      .collection('courses')
      .onSnapshot((snap) => {
        setCourses(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as CourseWithId[]);
      });
  }, [uid, semesterId]);

  const metrics = courses.map((c) => computeCourseMetrics({ ...c, grade: c.grade ?? undefined }));
  const semResult = computeSemesterGPA(metrics);

  useEffect(() => {
    if (!uid || !semesterId) return;
    db.collection('users').doc(uid).collection('semesters').doc(semesterId).update({
      gpa: semResult.gpa,
      pi: semResult.pi,
      creditLoaded: semResult.creditLoaded,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  }, [courses.length, semResult.gpa, semResult.pi, semResult.creditLoaded, uid, semesterId]);

  async function completeSemester() {
    if (!uid || !semesterId) return;
    if (!courses.length) {
      Alert.alert('Add courses first', 'A semester needs at least one course before it can be completed.');
      return;
    }
    setCompleting(true);
    try {
      await db.collection('users').doc(uid).collection('semesters').doc(semesterId).update({
        gpa: semResult.gpa, pi: semResult.pi, creditLoaded: semResult.creditLoaded,
        isComplete: true, updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      markInsightsStale();
      router.back();
    } catch (e: any) {
      Alert.alert('Could not complete semester', e?.message ?? 'Please try again.');
    } finally {
      setCompleting(false);
    }
  }

  async function deleteCourse(courseId: string) {
    if (!uid || !semesterId) return;
    Alert.alert('Delete course?', 'This removes the course from the semester.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        await db.collection('users').doc(uid).collection('semesters').doc(semesterId).collection('courses').doc(courseId).delete();
        markInsightsStale();
      } },
    ]);
  }

  async function runExtraction(base64Data: string, mimeType: string) {
    setOcrLoading(true);
    setOcrError(null);
    try {
      const { courses: extracted } = await resultsApi.extract(base64Data, mimeType);
      if (!extracted?.length) {
        setOcrError('No courses were detected in that file. Try a clearer photo or a different document.');
        return;
      }
      setReviewCourses(
        extracted.map((c) => ({
          code: c.code, title: c.title, units: c.units,
          caScore: c.caScore ?? null, examScore: c.examScore ?? null,
          grade: c.grade,
          isAR: c.isAR,
          estimated: true,
        }))
      );
    } catch (e: any) {
      setOcrError(e.message ?? 'Extraction failed. Please try again.');
    } finally {
      setOcrLoading(false);
    }
  }

  async function scanFromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });
    if (result.canceled || !result.assets[0].base64) return;
    await runExtraction(result.assets[0].base64, result.assets[0].mimeType ?? 'image/jpeg');
  }

  async function scanDocument() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const base64 = await new File(result.assets[0].uri).base64();
    await runExtraction(base64, result.assets[0].mimeType ?? 'application/pdf');
  }

  async function saveReviewedCourses() {
    if (!uid || !semesterId || !reviewCourses) return;
    setSavingScan(true);
    const batch = db.batch();
    try {
      reviewCourses.forEach((c) => {
        const computed = computeCourseMetrics(c);
        const ref = db.collection('users').doc(uid).collection('semesters').doc(semesterId).collection('courses').doc();
        batch.set(ref, { ...computed, createdAt: firestore.FieldValue.serverTimestamp(), updatedAt: firestore.FieldValue.serverTimestamp() });
      });
      await batch.commit();
      markInsightsStale();
      setReviewCourses(null);
      setScannerOpen(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Alert.alert('Could not save scanned courses', error?.message ?? 'Please try again.');
    } finally {
      setSavingScan(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <View style={{ padding: spacing.lg }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginBottom: spacing.md }}>
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>

        <Animated.View entering={FadeInDown.duration(300)}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.md }}>
            <View>
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>SEMESTER GPA</Text>
              <Text style={{ color: colors.primary, fontSize: 32, fontWeight: '800' }}>{semResult.gpa.toFixed(2)}</Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{semResult.creditLoaded} units · {semResult.courseCount} courses</Text>
          </View>
        </Animated.View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button label="Add Course" icon={<Plus color="#fff" size={16} />} onPress={() => setModalOpen(true)} fullWidth />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={ocrLoading ? 'Scanning…' : 'Scan Results'}
              variant="secondary"
              icon={<Camera color={colors.text} size={16} />}
              onPress={() => setScannerOpen(true)}
              loading={ocrLoading}
              fullWidth
            />
          </View>
        </View>
        <View style={{ marginTop: spacing.sm }}>
          <Button label="Complete semester" variant="ghost" onPress={completeSemester} loading={completing} fullWidth />
        </View>

        {ocrError && (
          <Animated.Text entering={FadeIn.duration(200)} style={{ color: colors.danger, fontSize: 12, marginTop: spacing.sm }}>
            {ocrError}
          </Animated.Text>
        )}
      </View>

      <FlatList
        data={courses}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 120, gap: spacing.sm }}
        ListEmptyComponent={
          <Card themeColors={colors} style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
            <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
              No courses yet. Add one manually or scan a result slip.
            </Text>
          </Card>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 40).duration(250)}>
            <Swipeable
              overshootRight={false}
              rightThreshold={36}
              renderRightActions={() => (
                <Pressable
                  accessibilityLabel={`Delete ${item.code}`}
                  onPress={() => deleteCourse(item.id)}
                  style={{
                    width: 78,
                    marginLeft: spacing.sm,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.dangerDim,
                    borderWidth: 1,
                    borderColor: colors.danger,
                  }}
                >
                  <Trash2 color={colors.danger} size={19} />
                  <Text style={{ color: colors.danger, fontSize: 10, fontWeight: '800', marginTop: 4 }}>Delete</Text>
                </Pressable>
              )}
            >
              <Pressable onPress={() => { setEditingCourse(item); setModalOpen(true); }}>
                <Card themeColors={colors} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{item.code} · {item.units} units</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>{item.title}</Text>
                  </View>
                  <View
                    style={{
                      minWidth: 34, height: 32, paddingHorizontal: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: `${getGradeColor(item.grade ?? 'F')}18`, marginLeft: spacing.sm,
                    }}
                  >
                    <Text style={{ color: getGradeColor(item.grade ?? 'F'), fontWeight: '800' }}>{item.isAR ? 'AR' : item.grade}</Text>
                  </View>
                </Card>
              </Pressable>
            </Swipeable>
          </Animated.View>
        )}
      />

      <ResultScannerModal
        visible={scannerOpen}
        loading={ocrLoading}
        error={ocrError}
        courses={reviewCourses}
        saving={savingScan}
        onClose={() => {
          if (ocrLoading || savingScan) return;
          setScannerOpen(false);
          setReviewCourses(null);
          setOcrError(null);
        }}
        onCapture={runExtraction}
        onGallery={scanFromGallery}
        onDocument={scanDocument}
        onConfirm={saveReviewedCourses}
        onReset={() => {
          setReviewCourses(null);
          setOcrError(null);
        }}
        onManual={() => {
          setScannerOpen(false);
          setModalOpen(true);
        }}
      />

      <AddCourseModal
        visible={modalOpen}
        initialCourse={editingCourse}
        onClose={() => { setModalOpen(false); setEditingCourse(null); }}
        onSave={async (input) => {
          if (!uid || !semesterId) return;
          const computed = computeCourseMetrics(input);
          const courseCollection = db.collection('users').doc(uid).collection('semesters').doc(semesterId).collection('courses');
          const courseRef = input.id ? courseCollection.doc(input.id) : courseCollection.doc();
          await courseRef.set({
            ...computed,
            createdAt: firestore.FieldValue.serverTimestamp(),
            updatedAt: firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
          markInsightsStale();
          setModalOpen(false);
          setEditingCourse(null);
        }}
      />

    </SafeAreaView>
  );
}

function AddCourseModal({ visible, onClose, onSave, initialCourse }: { visible: boolean; onClose: () => void; onSave: (input: CourseInput) => Promise<void>; initialCourse: CourseWithId | null }) {
  const colors = useThemeColors();
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [units, setUnits] = useState(3);
  const [score, setScore] = useState('');
  const [grade, setGrade] = useState<CourseInput['grade']>();
  const [inputMode, setInputMode] = useState<'score' | 'grade'>('score');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setCode(initialCourse?.code ?? '');
    setTitle(initialCourse?.title ?? '');
    setUnits(initialCourse?.units ?? 3);
    setScore(initialCourse?.totalScore == null ? '' : String(initialCourse.totalScore));
    setGrade(initialCourse?.grade ?? undefined);
    setInputMode(initialCourse?.totalScore == null && initialCourse?.grade ? 'grade' : 'score');
    setError(null);
  }, [visible, initialCourse]);

  const numericScore = score === '' ? null : Number(score);
  const ca = inputMode === 'score' && numericScore != null ? Number((numericScore * 0.3).toFixed(1)) : null;
  const exam = inputMode === 'score' && numericScore != null ? Number((numericScore * 0.7).toFixed(1)) : null;
  const preview = computeCourseMetrics({ code, title, units, caScore: ca, examScore: exam, grade: inputMode === 'grade' ? grade : undefined });

  async function submit() {
    if (!code.trim() || !title.trim()) {
      setError('Enter both the course code and course title.');
      return;
    }
    if (inputMode === 'score' && (numericScore == null || Number.isNaN(numericScore) || numericScore < 0 || numericScore > 100)) {
      setError('Enter a total score between 0 and 100.');
      return;
    }
    if (inputMode === 'grade' && !grade) {
      setError('Select a letter grade.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        id: initialCourse?.id,
        code: code.trim().toUpperCase(),
        title: title.trim(),
        units,
        caScore: ca,
        examScore: exam,
        grade: inputMode === 'grade' ? grade : undefined,
        estimated: inputMode === 'score',
      });
    } catch (saveError: any) {
      setError(saveError?.message ?? 'Could not save this course.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,4,10,0.72)' }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            maxHeight: '78%',
            backgroundColor: colors.deep,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1,
            borderColor: colors.border,
            paddingTop: spacing.sm,
          }}
        >
          <View style={{ width: 42, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md }} />
          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
              <View>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{initialCourse ? 'Edit Course' : 'Add Course'}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 3 }}>Quick entry · you can edit this later</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={8}><X size={22} color={colors.textMuted} /></Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 0.8 }}>
                <Input label="Course code" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="CSC301" themeColors={colors} />
              </View>
              <View style={{ flex: 1.8 }}>
                <Input label="Course title" value={title} onChangeText={setTitle} placeholder="Software Engineering" themeColors={colors} />
              </View>
            </View>

            <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 7 }}>Credit units</Text>
            <View style={{ flexDirection: 'row', gap: 7, marginBottom: spacing.md }}>
              {[1, 2, 3, 4, 5, 6].map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setUnits(value)}
                  style={{
                    flex: 1,
                    paddingVertical: 11,
                    alignItems: 'center',
                    borderRadius: 9,
                    backgroundColor: units === value ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor: units === value ? colors.primaryGlow : colors.border,
                  }}
                >
                  <Text style={{ color: units === value ? '#FFFFFF' : colors.textMuted, fontWeight: '800' }}>{value}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 10, padding: 3, marginBottom: spacing.md }}>
              {(['score', 'grade'] as const).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => setInputMode(mode)}
                  style={{ flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 8, backgroundColor: inputMode === mode ? colors.overlay : 'transparent' }}
                >
                  <Text style={{ color: inputMode === mode ? colors.text : colors.textMuted, fontWeight: '800', fontSize: 12 }}>
                    {mode === 'score' ? 'Total Score' : 'Letter Grade'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {inputMode === 'score' ? (
              <Input label="Score (0–100)" value={score} onChangeText={setScore} keyboardType="decimal-pad" placeholder="75" themeColors={colors} />
            ) : (
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: spacing.md }}>
                {(['A', 'B', 'C', 'D', 'E', 'F'] as const).map((letter) => (
                  <Pressable key={letter} onPress={() => setGrade(letter)} style={{ flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 8, backgroundColor: grade === letter ? getGradeColor(letter) : colors.surface, borderWidth: 1, borderColor: grade === letter ? getGradeColor(letter) : colors.border }}>
                    <Text style={{ color: grade === letter ? '#fff' : colors.textMuted, fontWeight: '800' }}>{letter}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {(numericScore != null || grade) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderRadius: 10, backgroundColor: colors.surface, marginBottom: spacing.md }}>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>Live preview</Text>
                <Text style={{ color: getGradeColor(preview.grade), fontWeight: '800' }}>{preview.grade} · {preview.gradePoint.toFixed(1)} points</Text>
              </View>
            )}

            {!!error && <Text style={{ color: colors.danger, fontSize: 12, marginBottom: spacing.md }}>{error}</Text>}
            <Button label={initialCourse ? 'Update Course' : 'Save Course'} onPress={submit} loading={saving} fullWidth themeColors={colors} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
