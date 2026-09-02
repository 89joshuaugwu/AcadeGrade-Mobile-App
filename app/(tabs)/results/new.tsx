import { useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import firestore from '@react-native-firebase/firestore';
import { ArrowLeft, GraduationCap } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { spacing, radius } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/store/authStore';
import { db } from '@/lib/firebase/client';
import { STUDENT_LEVELS } from '@/types/user';
import { useThemeColors } from '@/lib/store/themeStore';

/** Converted to light theme + polish this round. Firestore write shape unchanged. */
export default function NewSemester() {
  const colors = useThemeColors();
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
      label, session, level, semester: semesterNum,
      gpa: 0, pi: 0, creditLoaded: 0, isComplete: false,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
    setLoading(false);
    router.replace(`/(tabs)/results/${ref.id}`);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginBottom: spacing.md }}>
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>

          <Animated.View entering={FadeInDown.duration(300)} style={{ alignItems: 'center', marginBottom: spacing.xl }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
              <GraduationCap size={26} color={colors.primary} />
            </View>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>New Semester</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>Set up a semester to start adding results</Text>
          </Animated.View>

          <Card themeColors={colors}>
            <Text style={{ color: colors.textMuted, marginBottom: spacing.sm, fontSize: 13, fontWeight: '600' }}>Level</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
              {STUDENT_LEVELS.map((l) => (
                <Pressable
                  key={l}
                  onPress={() => setLevel(l)}
                  style={{
                    paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.pill,
                    backgroundColor: level === l ? colors.primary : colors.overlay,
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
                    backgroundColor: semesterNum === s ? colors.primary : colors.overlay,
                    borderWidth: 1, borderColor: semesterNum === s ? colors.primary : colors.border,
                  }}
                >
                  <Text style={{ color: semesterNum === s ? '#fff' : colors.text, fontWeight: '600' }}>
                    {s === 1 ? 'First' : 'Second'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Input label="Session (e.g. 2025/2026)" value={session} onChangeText={setSession} placeholder="2025/2026" themeColors={colors} />
            <Button label="Create Semester" onPress={createSemester} loading={loading} fullWidth />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
