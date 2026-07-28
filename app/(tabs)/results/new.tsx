import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import firestore from '@react-native-firebase/firestore';
import { colors, spacing, radius } from '@/constants/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/store/authStore';
import { db } from '@/lib/firebase/client';
import { STUDENT_LEVELS } from '@/types/user';

export default function NewSemester() {
  const router = useRouter();
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const [level, setLevel] = useState<number>(100);
  const [semesterNum, setSemesterNum] = useState<1 | 2>(1);
  const [session, setSession] = useState('');
  const [loading, setLoading] = useState(false);

  async function createSemester() {
    if (!uid || !session) return;
    setLoading(true);
    const label = `${level}L — ${semesterNum === 1 ? 'First' : 'Second'} Semester`;
    const ref = await db.collection('users').doc(uid).collection('semesters').add({
      label,
      session,
      level,
      semester: semesterNum,
      gpa: 0,
      pi: 0,
      creditLoaded: 0,
      isComplete: false,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
    setLoading(false);
    router.replace(`/(tabs)/results/${ref.id}`);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.xl }}>
          New Semester
        </Text>

        <Text style={{ color: colors.textMuted, marginBottom: spacing.sm, fontSize: 13, fontWeight: '600' }}>Level</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
          {STUDENT_LEVELS.map((l) => (
            <Pressable
              key={l}
              onPress={() => setLevel(l)}
              style={{
                paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.pill,
                backgroundColor: level === l ? colors.primary : colors.surface,
                borderWidth: 1, borderColor: level === l ? colors.primary : colors.border,
              }}
            >
              <Text style={{ color: level === l ? '#fff' : colors.text, fontWeight: '600' }}>{l}L</Text>
            </Pressable>
          ))}
        </View>

        <Text style={{ color: colors.textMuted, marginBottom: spacing.sm, fontSize: 13, fontWeight: '600' }}>Semester</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
          {[1, 2].map((s) => (
            <Pressable
              key={s}
              onPress={() => setSemesterNum(s as 1 | 2)}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center',
                backgroundColor: semesterNum === s ? colors.primary : colors.surface,
                borderWidth: 1, borderColor: semesterNum === s ? colors.primary : colors.border,
              }}
            >
              <Text style={{ color: semesterNum === s ? '#fff' : colors.text, fontWeight: '600' }}>
                {s === 1 ? 'First' : 'Second'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Input label="Session (e.g. 2025/2026)" value={session} onChangeText={setSession} placeholder="2025/2026" />

        <Button label="Create Semester" onPress={createSemester} loading={loading} fullWidth />
      </ScrollView>
    </SafeAreaView>
  );
}
