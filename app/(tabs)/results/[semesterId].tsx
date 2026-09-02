import { useState, useEffect } from 'react';
import { View, Text, FlatList, Modal, ScrollView, Pressable, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { ArrowLeft, Plus, Camera, Trash2, X, Download, Share2, Copy, BookOpen, CheckCircle2 } from 'lucide-react-native';
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
import type { SemesterWithId } from '@/types/semester';
import { useThemeColors } from '@/lib/store/themeStore';
import { useToastStore } from '@/lib/store/toastStore';

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
  const showToast = useToastStore((state) => state.show);
  const [semester, setSemester] = useState<SemesterWithId | null>(null);
  const [courses, setCourses] = useState<CourseWithId[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [reviewCourses, setReviewCourses] = useState<CourseInput[] | null>(null);
  const [savingScan, setSavingScan] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseWithId | null>(null);
  const [completing, setCompleting] = useState(false);
  const [codeModal, setCodeModal] = useState<'import' | 'share' | null>(null);
  const [shareCode, setShareCode] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [codeWorking, setCodeWorking] = useState(false);

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
    const unsubscribeSemester = db
      .collection('users').doc(uid)
      .collection('semesters').doc(semesterId)
      .onSnapshot((snap) => {
        if (snap.exists()) setSemester({ id: snap.id, ...(snap.data() as any) } as SemesterWithId);
      });
    const unsubscribeCourses = db
      .collection('users').doc(uid)
      .collection('semesters').doc(semesterId)
      .collection('courses')
      .onSnapshot((snap) => {
        setCourses(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as CourseWithId[]);
      });
    return () => {
      unsubscribeSemester();
      unsubscribeCourses();
    };
  }, [uid, semesterId]);

  const metrics = courses
    .filter((course) => !course.pending)
    .map((c) => computeCourseMetrics({ ...c, grade: c.grade ?? undefined }));
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
    const pendingCount = courses.filter((course) => course.pending).length;
    if (pendingCount > 0) {
      Alert.alert('Scores still needed', `Add a score or grade to ${pendingCount} imported course${pendingCount === 1 ? '' : 's'} before completing this semester.`);
      return;
    }
    setCompleting(true);
    try {
      await db.collection('users').doc(uid).collection('semesters').doc(semesterId).update({
        gpa: semResult.gpa, pi: semResult.pi, creditLoaded: semResult.creditLoaded,
        isComplete: true, updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      markInsightsStale();
      showToast({ type: 'success', title: 'Semester completed', message: 'Dashboard and transcript totals have been updated.' });
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
        showToast({ type: 'success', title: 'Course deleted' });
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
      showToast({ type: 'success', title: `${extracted.length} courses detected`, message: 'Review the extracted values before saving.' });
    } catch (e: any) {
      setOcrError(e.message ?? 'Extraction failed. Please try again.');
      showToast({ type: e?.status === 429 ? 'warning' : 'error', title: e?.status === 429 ? 'Scan limit reached' : 'Scan failed', message: e?.message });
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
      showToast({ type: 'success', title: 'Scanned courses saved', message: `${reviewCourses.length} courses were added to this semester.` });
    } catch (error: any) {
      Alert.alert('Could not save scanned courses', error?.message ?? 'Please try again.');
    } finally {
      setSavingScan(false);
    }
  }

  async function generateShareCode() {
    if (!uid) return;
    if (courses.length < 3) {
      showToast({ type: 'info', title: 'Add at least 3 courses', message: 'A course code shares course names and units only—never your scores.' });
      return;
    }
    setCodeWorking(true);
    try {
      let generated = '';
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const candidate = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, 'X');
        const existing = await db.collection('shareCodes').doc(candidate).get();
        if (!existing.exists()) {
          generated = candidate;
          break;
        }
      }
      if (!generated) throw new Error('Could not reserve a unique code. Please try again.');
      await db.collection('shareCodes').doc(generated).set({
        code: generated,
        authorId: uid,
        useCount: 0,
        createdAt: firestore.FieldValue.serverTimestamp(),
        courses: courses.map(({ code, title, units }) => ({ code, title, units })),
      });
      setShareCode(generated);
      setCodeModal('share');
      showToast({ type: 'success', title: 'Course code ready', message: 'Only course names and units are included.' });
    } catch (error: any) {
      showToast({ type: 'error', title: 'Could not create code', message: error?.message ?? 'Please try again.' });
    } finally {
      setCodeWorking(false);
    }
  }

  async function importCourseCode() {
    if (!uid || !semesterId) return;
    const normalized = codeInput.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(normalized)) {
      showToast({ type: 'warning', title: 'Enter a valid code', message: 'Course codes contain exactly 6 letters or numbers.' });
      return;
    }
    setCodeWorking(true);
    try {
      const codeRef = db.collection('shareCodes').doc(normalized);
      const snapshot = await codeRef.get();
      const shared = snapshot.data();
      if (!snapshot.exists() || !Array.isArray(shared?.courses)) throw new Error('That course code was not found.');

      const existingCodes = new Set(courses.map((course) => course.code.trim().toUpperCase()));
      const incoming = shared.courses
        .filter((course: any) => course && typeof course.code === 'string' && typeof course.title === 'string' && Number.isFinite(Number(course.units)))
        .filter((course: any) => !existingCodes.has(course.code.trim().toUpperCase()))
        .slice(0, 50);
      if (!incoming.length) throw new Error('Every course in this code is already in your semester.');

      const batch = db.batch();
      incoming.forEach((course: any) => {
        const ref = db.collection('users').doc(uid).collection('semesters').doc(semesterId).collection('courses').doc();
        batch.set(ref, {
          code: course.code.trim().toUpperCase(), title: course.title.trim(), units: Math.max(1, Math.min(6, Number(course.units))),
          caScore: null, examScore: null, totalScore: null, grade: null, gradePoint: 0, piPoint: 0,
          estimated: false, pending: true,
          createdAt: firestore.FieldValue.serverTimestamp(), updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      });
      batch.update(codeRef, { useCount: firestore.FieldValue.increment(1) });
      await batch.commit();
      setCodeInput('');
      setCodeModal(null);
      showToast({ type: 'success', title: `${incoming.length} courses imported`, message: 'Tap each course to add its score or grade.' });
    } catch (error: any) {
      showToast({ type: 'error', title: 'Import failed', message: error?.message ?? 'Please try again.' });
    } finally {
      setCodeWorking(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <FlatList
        data={courses}
        keyExtractor={(c) => c.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120, gap: spacing.sm }}
        ListHeaderComponent={
          <View style={{ paddingBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
              <Pressable onPress={() => router.back()} accessibilityLabel="Back to results" hitSlop={10} style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                <ArrowLeft size={20} color={colors.text} />
              </Pressable>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }} numberOfLines={1}>{semester?.label ?? 'Semester results'}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>{semester?.session || 'Course record'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99, backgroundColor: semester?.isComplete ? colors.successDim : `${colors.warning}18` }}>
                {semester?.isComplete && <CheckCircle2 size={12} color={colors.success} />}
                <Text style={{ color: semester?.isComplete ? colors.success : colors.warning, fontSize: 9, fontWeight: '900' }}>{semester?.isComplete ? 'COMPLETE' : 'IN PROGRESS'}</Text>
              </View>
            </View>

            <View style={{ padding: spacing.lg, borderRadius: 20, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.primaryDim }}>
              <Text style={{ color: colors.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>SEMESTER GPA</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 4 }}>
                <Text style={{ color: colors.primaryGlow, fontSize: 38, lineHeight: 43, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{semResult.gpa.toFixed(2)}</Text>
                <Text style={{ color: colors.textFaint, fontSize: 12, marginLeft: 5, marginBottom: 6 }}>/ 5.00</Text>
              </View>
              <View style={{ flexDirection: 'row', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderSubtle }}>
                <Metric label="Courses" value={String(courses.length)} colors={colors} />
                <Metric label="Graded" value={String(metrics.length)} colors={colors} />
                <Metric label="Credits" value={String(semResult.creditLoaded)} colors={colors} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <View style={{ flex: 1 }}><Button label="Add course" icon={<Plus color="#fff" size={16} />} onPress={() => setModalOpen(true)} fullWidth themeColors={colors} /></View>
              <View style={{ flex: 1 }}><Button label={ocrLoading ? 'Scanning…' : 'Scan result'} variant="secondary" icon={<Camera color={colors.text} size={16} />} onPress={() => setScannerOpen(true)} loading={ocrLoading} fullWidth themeColors={colors} /></View>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <CodeAction icon={<Download size={16} color={colors.primary} />} label="Import code" onPress={() => setCodeModal('import')} colors={colors} />
              <CodeAction icon={<Share2 size={16} color={colors.primary} />} label={codeWorking ? 'Creating…' : 'Export code'} onPress={generateShareCode} colors={colors} />
            </View>

            <View style={{ marginTop: spacing.sm }}>
              <Button label={semester?.isComplete ? 'Semester completed' : 'Complete semester'} variant="ghost" icon={semester?.isComplete ? <CheckCircle2 size={16} color={colors.success} /> : undefined} onPress={completeSemester} loading={completing} disabled={semester?.isComplete} fullWidth themeColors={colors} />
            </View>

            {ocrError && <Animated.Text entering={FadeIn.duration(200)} style={{ color: colors.danger, fontSize: 12, marginTop: spacing.sm }}>{ocrError}</Animated.Text>}

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: 2 }}>
              <View>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>Courses</Text>
                <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 2 }}>Tap a course to edit its score or grade</Text>
              </View>
              <BookOpen size={18} color={colors.textFaint} />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface }}>
            <Plus size={26} color={colors.primary} />
            <Text style={{ color: colors.text, fontWeight: '800', marginTop: spacing.sm }}>No courses yet</Text>
            <Text style={{ color: colors.textMuted, textAlign: 'center', fontSize: 11, marginTop: 4 }}>Add one manually, import a class code, or scan your result.</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 40).duration(250)}>
              <Card themeColors={colors} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md }}>
                <Pressable onPress={() => { setEditingCourse(item); setModalOpen(true); }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>{item.code}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 3 }} numberOfLines={1}>{item.title} · {item.units} units</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', marginLeft: spacing.sm }}>
                    <View style={{ minWidth: item.pending ? 65 : 34, height: 30, paddingHorizontal: 8, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: item.pending ? `${colors.warning}18` : `${getGradeColor(item.grade ?? 'F')}18` }}>
                      <Text style={{ color: item.pending ? colors.warning : getGradeColor(item.grade ?? 'F'), fontWeight: '900', fontSize: item.pending ? 9 : 13 }}>{item.pending ? 'ADD SCORE' : item.isAR ? 'AR' : item.grade}</Text>
                    </View>
                    {!item.pending && item.totalScore != null && <Text style={{ color: colors.textFaint, fontSize: 9, marginTop: 3 }}>{item.totalScore}%</Text>}
                  </View>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${item.code}`} onPress={() => deleteCourse(item.id)} hitSlop={8} style={{ width: 34, height: 34, marginLeft: spacing.sm, alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 color={colors.textFaint} size={18} />
                </Pressable>
              </Card>
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

      <CourseCodeModal
        mode={codeModal}
        shareCode={shareCode}
        codeInput={codeInput}
        working={codeWorking}
        onCodeChange={(value) => setCodeInput(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
        onClose={() => { if (!codeWorking) setCodeModal(null); }}
        onImport={importCourseCode}
        onCopy={async () => {
          await Clipboard.setStringAsync(shareCode);
          showToast({ type: 'success', title: 'Code copied' });
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
            pending: false,
            createdAt: firestore.FieldValue.serverTimestamp(),
            updatedAt: firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
          markInsightsStale();
          showToast({ type: 'success', title: input.id ? 'Course updated' : 'Course added', message: `${input.code} has been saved.` });
          setModalOpen(false);
          setEditingCourse(null);
        }}
      />

    </SafeAreaView>
  );
}

function Metric({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useThemeColors> }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ color: colors.textFaint, fontSize: 9, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function CodeAction({ icon, label, onPress, colors }: { icon: React.ReactNode; label: string; onPress: () => void; colors: ReturnType<typeof useThemeColors> }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1, minHeight: 46, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
    >
      {icon}
      <Text style={{ color: colors.text, fontSize: 11, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

function CourseCodeModal({ mode, shareCode, codeInput, working, onCodeChange, onClose, onImport, onCopy }: {
  mode: 'import' | 'share' | null;
  shareCode: string;
  codeInput: string;
  working: boolean;
  onCodeChange: (value: string) => void;
  onClose: () => void;
  onImport: () => void;
  onCopy: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Modal visible={mode !== null} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,4,10,0.7)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: colors.deep, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, paddingBottom: spacing.xxl }}>
          <View style={{ width: 42, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <Text style={{ color: colors.text, fontSize: 19, fontWeight: '900' }}>{mode === 'share' ? 'Share course list' : 'Import course list'}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 4 }}>
                {mode === 'share' ? 'Classmates receive course names and units only. Your grades and scores stay private.' : 'Enter a classmate’s 6-character code. Imported courses wait for you to enter private scores.'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}><X size={21} color={colors.textFaint} /></Pressable>
          </View>

          {mode === 'share' ? (
            <View style={{ marginTop: spacing.xl }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primaryDim }}>
                <Text selectable style={{ flex: 1, color: colors.primaryGlow, fontSize: 27, fontWeight: '900', letterSpacing: 5, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{shareCode}</Text>
                <Pressable onPress={onCopy} accessibilityLabel="Copy course code" style={{ width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryDim }}>
                  <Copy size={18} color={colors.primary} />
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={{ marginTop: spacing.xl }}>
              <Input label="Course code" value={codeInput} onChangeText={onCodeChange} autoCapitalize="characters" maxLength={6} placeholder="ABC123" themeColors={colors} style={{ textAlign: 'center', fontSize: 22, fontWeight: '900', letterSpacing: 5 }} />
              <Button label="Import courses" icon={<Download size={16} color="#FFFFFF" />} onPress={onImport} loading={working} disabled={codeInput.length !== 6} fullWidth themeColors={colors} />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
