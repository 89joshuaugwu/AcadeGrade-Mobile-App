import { useState, useEffect } from 'react';
import { View, Text, FlatList, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Plus, Camera, Trash2 } from 'lucide-react-native';
import firestore from '@react-native-firebase/firestore';
import { colors, spacing, radius } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { db } from '@/lib/firebase/client';
import { useAuthStore } from '@/lib/store/authStore';
import { computeCourseMetrics, computeSemesterGPA } from '@/lib/cgpa/calculator';
import { getGradeColor } from '@/lib/cgpa/gradeScale';
import { resultsApi } from '@/lib/api/client';
import type { CourseWithId, CourseInput } from '@/types/course';

export default function SemesterDetail() {
  const { semesterId } = useLocalSearchParams<{ semesterId: string }>();
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const [courses, setCourses] = useState<CourseWithId[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
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

  // Recalculate + persist semester aggregate whenever courses change —
  // matches web's "instant recalculation whenever a course is added, edited,
  // or deleted" (2_student_features.md §2).
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

  async function scanResultSlip() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;

    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 });
    if (result.canceled || !result.assets[0].base64) return;

    setOcrLoading(true);
    try {
      const { courses: extracted } = await resultsApi.extract(result.assets[0].base64, 'image/jpeg');
      setReviewCourses(
        extracted.map((c) => ({
          code: c.code,
          title: c.title,
          units: c.units,
          caScore: c.caScore ?? null,
          examScore: c.examScore ?? null,
          grade: c.grade as any,
          estimated: false,
        }))
      );
    } catch (e) {
      // Surface via toast in production — kept minimal here
      console.error('OCR extraction failed', e);
    } finally {
      setOcrLoading(false);
    }
  }

  async function saveReviewedCourses() {
    if (!uid || !semesterId || !reviewCourses) return;
    const batch = db.batch();
    reviewCourses.forEach((c) => {
      const metrics = computeCourseMetrics(c);
      const ref = db.collection('users').doc(uid).collection('semesters').doc(semesterId).collection('courses').doc();
      batch.set(ref, {
        ...metrics,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    setReviewCourses(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <View style={{ padding: spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
          <View>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>Semester GPA: {semResult.gpa.toFixed(2)}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{semResult.creditLoaded} units · {semResult.courseCount} courses</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button label="Add Course" icon={<Plus color="#fff" size={16} />} onPress={() => setModalOpen(true)} />
          <Button
            label={ocrLoading ? 'Scanning…' : 'Scan Slip'}
            variant="secondary"
            icon={<Camera color={colors.text} size={16} />}
            onPress={scanResultSlip}
            loading={ocrLoading}
          />
        </View>
      </View>

      <FlatList
        data={courses}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 120, gap: spacing.sm }}
        renderItem={({ item }) => (
          <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{item.code} — {item.units} units</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>{item.title}</Text>
            </View>
            <View
              style={{
                width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                backgroundColor: `${getGradeColor(item.grade ?? 'F')}22`, marginRight: spacing.sm,
              }}
            >
              <Text style={{ color: getGradeColor(item.grade ?? 'F'), fontWeight: '800' }}>{item.grade}</Text>
            </View>
            <Trash2 color={colors.textFaint} size={18} onPress={() => deleteCourse(item.id)} />
          </Card>
        )}
      />

      <AddCourseModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={async (input) => {
          if (!uid || !semesterId) return;
          const metrics = computeCourseMetrics(input);
          await db.collection('users').doc(uid).collection('semesters').doc(semesterId).collection('courses').add({
            ...metrics,
            createdAt: firestore.FieldValue.serverTimestamp(),
            updatedAt: firestore.FieldValue.serverTimestamp(),
          });
          setModalOpen(false);
        }}
      />

      <Modal visible={!!reviewCourses} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.void, padding: spacing.lg }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: spacing.md }}>
            Review scanned courses
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: spacing.lg }}>
            Confirm these before saving — AI extraction can misread scores. Nothing is saved automatically.
          </Text>
          <ScrollView style={{ marginBottom: spacing.lg }}>
            {reviewCourses?.map((c, i) => (
              <Card key={i} style={{ marginBottom: spacing.sm }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{c.code} — {c.title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {c.units} units · Grade {c.grade ?? '—'} · CA {c.caScore ?? '—'} / Exam {c.examScore ?? '—'}
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

function AddCourseModal({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: (input: CourseInput) => void }) {
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [units, setUnits] = useState('3');
  const [caScore, setCaScore] = useState('');
  const [examScore, setExamScore] = useState('');

  const ca = caScore ? Number(caScore) : null;
  const exam = examScore ? Number(examScore) : null;
  const preview = computeCourseMetrics({
    code, title, units: Number(units) || 0, caScore: ca, examScore: exam,
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.void, padding: spacing.lg }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: spacing.lg }}>Add Course</Text>
        <Input label="Course code" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="CSC 499" />
        <Input label="Title" value={title} onChangeText={setTitle} placeholder="Final Year Project" />
        <Input label="Units" value={units} onChangeText={setUnits} keyboardType="number-pad" />
        <Input label="CA score (max 30)" value={caScore} onChangeText={setCaScore} keyboardType="number-pad" />
        <Input label="Exam score (max 70)" value={examScore} onChangeText={setExamScore} keyboardType="number-pad" />

        {(ca !== null && exam !== null) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
            <Text style={{ color: colors.textMuted }}>Live preview:</Text>
            <Text style={{ color: getGradeColor(preview.grade), fontWeight: '800', fontSize: 16 }}>
              {preview.grade} ({preview.gradePoint} pts)
            </Text>
          </View>
        )}

        <Button
          label="Save Course"
          onPress={() => onSave({ code, title, units: Number(units) || 0, caScore: ca, examScore: exam })}
          fullWidth
        />
        <View style={{ height: spacing.sm }} />
        <Button label="Cancel" variant="ghost" onPress={onClose} fullWidth />
      </SafeAreaView>
    </Modal>
  );
}
