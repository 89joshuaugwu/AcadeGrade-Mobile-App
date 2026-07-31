import { useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Plus, ChevronRight, Trash2 } from 'lucide-react-native';
import { lightColors as colors, spacing, radius } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAcademicData } from '@/lib/store/useAcademicData';
import { useAuthStore } from '@/lib/store/authStore';
import { db } from '@/lib/firebase/client';

/** Converted to light theme this round — structure/logic unchanged. */
export default function ResultsList() {
  const router = useRouter();
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const { semesters, loading } = useAcademicData();

  async function deleteSemester(semesterId: string) {
    if (!uid) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await db.collection('users').doc(uid).collection('semesters').doc(semesterId).delete();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>Results</Text>
        <Button
          label="New"
          icon={<Plus color="#fff" size={16} />}
          onPress={() => router.push('/(tabs)/results/new')}
        />
      </View>

      <FlatList
        data={semesters}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 120, gap: spacing.md }}
        ListEmptyComponent={
          !loading ? (
            <Card themeColors={colors} style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
              <Text style={{ fontSize: 40, marginBottom: spacing.md }}>📚</Text>
              <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
                No semesters yet. Add your first one to start tracking your GPA.
              </Text>
            </Card>
          ) : null
        }
        renderItem={({ item }) => (
          <Swipeable
            renderRightActions={() => (
              <View
                onTouchEnd={() => deleteSemester(item.id)}
                style={{
                  backgroundColor: colors.danger,
                  justifyContent: 'center',
                  alignItems: 'center',
                  width: 72,
                  borderRadius: radius.lg,
                  marginLeft: spacing.sm,
                }}
              >
                <Trash2 color="#fff" size={20} />
              </View>
            )}
          >
            <Card
              themeColors={colors}
              onTouchEnd={() => router.push(`/(tabs)/results/${item.id}`)}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <View>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{item.label}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  {item.session} · {item.creditLoaded} units
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 18 }}>{item.gpa.toFixed(2)}</Text>
                <ChevronRight color={colors.textFaint} size={18} />
              </View>
            </Card>
          </Swipeable>
        )}
      />
    </SafeAreaView>
  );
}
