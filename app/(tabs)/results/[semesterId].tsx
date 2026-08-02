import { useState, useEffect } from 'react';
import { View, Text, FlatList, Modal, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { ArrowLeft, Plus, Camera, ImageIcon, FileUp, Trash2, X, Sparkles } from 'lucide-react-native';
import firestore from '@react-native-firebase/firestore';
import { lightColors as colors, spacing, radius } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AcadeMindMark } from '@/components/ui/AcadeMindMark';
import { db } from '@/lib/firebase/client';
import { useAuthStore } from '@/lib/store/authStore';
import { computeCourseMetrics, computeSemesterGPA } from '@/lib/cgpa/calculator';
import { getGradeColor } from '@/lib/cgpa/gradeScale';
import { resultsApi } from '@/lib/api/client';
import type { CourseWithId, CourseInput } from '@/types/course';

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
  const router = useRouter();
  const { semesterId } = useLocalSearchParams<{ semesterId: string }>();
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const [courses, setCourses] = useState<CourseWithId[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [scanMenuOpen, setScanMenuOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [reviewCourses, setReviewCourses] = useState<CourseInput[] | null>(null);

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

  const metrics = courses.map((c) => computeCourseMetrics(c));
  const semResult = computeSemesterGPA(metrics);

  useEffect(() => {
    if (!uid || !semesterId || courses.length === 0) return;
    db.collection('users').doc(uid).collection('semesters').doc(semesterId).update({
      gpa: semResult.gpa,
      pi: semResult.pi,
      creditLoaded: semResult.creditLoaded,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  }, [courses.length, semResult.gpa, semResult.pi]);

  async function deleteCourse(courseId: string) {
    if (!uid || !semesterId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await db.collection('users').doc(uid).collection('semesters').doc(semesterId).collection('courses').doc(courseId).delete();
  }

  async function runExtraction(base64Data: string, mimeType: string) {
    setScanMenuOpen(false);
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
          estimated: true,
        }))
      );
    } catch (e: any) {
      setOcrError(e.message ?? 'Extraction failed. Please try again.');
    } finally {
      setOcrLoading(false);
    }
  }

  async function scanWithCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 });
    if (result.canceled || !result.assets[0].base64) return;
    await runExtraction(result.assets[0].base64, 'image/jpeg');
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
    const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
    await runExtraction(base64, result.assets[0].mimeType ?? 'application/pdf');
  }

  async function saveReviewedCourses() {
    if (!uid || !semesterId || !reviewCourses) return;
    const batch = db.batch();
    reviewCourses.forEach((c) => {
      const computed = computeCourseMetrics(c);
      const ref = db.collection('users').doc(uid).collection('semesters').doc(semesterId).collection('courses').doc();
      batch.set(ref, { ...computed, createdAt: firestore.FieldValue.serverTimestamp(), updatedAt: firestore.FieldValue.serverTimestamp() });
    });
    await batch.commit();
    setReviewCourses(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
              onPress={() => setScanMenuOpen(true)}
              loading={ocrLoading}
              fullWidth
            />
          </View>
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
            <Card themeColors={colors} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{item.code} — {item.units} units</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>{item.title}</Text>
              </View>
              <View
                style={{
                  width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: `${getGradeColor(item.grade ?? 'F')}18`, marginRight: spacing.sm,
                }}
              >
                <Text style={{ color: getGradeColor(item.grade ?? 'F'), fontWeight: '800' }}>{item.grade}</Text>
              </View>
              <Pressable onPress={() => deleteCourse(item.id)} hitSlop={8}>
                <Trash2 color={colors.textFaint} size={18} />
              </Pressable>
            </Card>
          </Animated.View>
        )}
      />

      {/* SCAN SOURCE MENU */}
      <Modal visible={scanMenuOpen} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(20,22,43,0.5)', justifyContent: 'flex-end' }} onPress={() => setScanMenuOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xxl }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <AcadeMindMark size={18} />
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>Scan Result Slip</Text>
                </View>
                <Pressable onPress={() => setScanMenuOpen(false)} hitSlop={8}><X size={20} color={colors.textMuted} /></Pressable>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.lg }}>
                AcadeMind reads your courses automatically — nothing is saved until you review and confirm.
              </Text>
              <ScanOption icon={<Camera size={20} color={colors.primary} />} label="Take Photo" subtitle="Live capture with your camera" onPress={scanWithCamera} />
              <ScanOption icon={<ImageIcon size={20} color={colors.primary} />} label="Choose from Gallery" subtitle="Pick an existing photo" onPress={scanFromGallery} />
              <ScanOption icon={<FileUp size={20} color={colors.primary} />} label="Upload Document" subtitle="PDF or image file" onPress={scanDocument} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <AddCourseModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={async (input) => {
          if (!uid || !semesterId) return;
          const computed = computeCourseMetrics(input);
          await db.collection('users').doc(uid).collection('semesters').doc(semesterId).collection('courses').add({
            ...computed,
            createdAt: firestore.FieldValue.serverTimestamp(),
            updatedAt: firestore.FieldValue.serverTimestamp(),
          });
          setModalOpen(false);
        }}
      />

      <Modal visible={!!reviewCourses} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.void, padding: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Sparkles size={16} color={colors.gold} />
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>Review scanned courses</Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: spacing.lg }}>
            Confirm these before saving — AI extraction can misread scores. Nothing is saved automatically.
          </Text>
          <ScrollView style={{ marginBottom: spacing.lg }}>
            {reviewCourses?.map((c, i) => (
              <Card key={i} themeColors={colors} style={{ marginBottom: spacing.sm }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{c.code} — {c.title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {c.units} units · CA {c.caScore ?? '—'} / Exam {c.examScore ?? '—'}
                </Text>
              </Card>
            ))}
          </ScrollView>
          <Button label={`Save ${reviewCourses?.length ?? 0} Courses`} onPress={saveReviewedCourses} fullWidth />
          <View style={{ height: spacing.sm }} />
          <Button label="Discard" variant="ghost" onPress={() => setReviewCourses(null)} fullWidth />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function ScanOption({ icon, label, subtitle, onPress }: { icon: React.ReactNode; label: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>{label}</Text>
        <Text style={{ color: colors.textFaint, fontSize: 11 }}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

function AddCourseModal({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: (input: CourseInput) => void }) {
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [units, setUnits] = useState('3');
  const [caScore, setCaScore] = useState('');
  const [examScore, setExamScore] = useState('');

  const ca = caScore ? Number(caScore) : null;
  const exam = examScore ? Number(examScore) : null;
  const preview = computeCourseMetrics({ code, title, units: Number(units) || 0, caScore: ca, examScore: exam });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.void, padding: spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>Add Course</Text>
          <Pressable onPress={onClose} hitSlop={8}><X size={22} color={colors.textMuted} /></Pressable>
        </View>
        <Input label="Course code" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="CSC 499" themeColors={colors} />
        <Input label="Title" value={title} onChangeText={setTitle} placeholder="Final Year Project" themeColors={colors} />
        <Input label="Units" value={units} onChangeText={setUnits} keyboardType="number-pad" themeColors={colors} />
        <Input label="CA score (max 30)" value={caScore} onChangeText={setCaScore} keyboardType="number-pad" themeColors={colors} />
        <Input label="Exam score (max 70)" value={examScore} onChangeText={setExamScore} keyboardType="number-pad" themeColors={colors} />

        {(ca !== null && exam !== null) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
            <Text style={{ color: colors.textMuted }}>Live preview:</Text>
            <Text style={{ color: getGradeColor(preview.grade), fontWeight: '800', fontSize: 16 }}>
              {preview.grade} ({preview.gradePoint} pts)
            </Text>
          </View>
        )}

        <Button label="Save Course" onPress={() => onSave({ code, title, units: Number(units) || 0, caScore: ca, examScore: exam })} fullWidth />
      </SafeAreaView>
    </Modal>
  );
}
