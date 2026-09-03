import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import firestore from '@react-native-firebase/firestore';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowLeft, CalendarRange, Check, ChevronRight, GraduationCap, LockKeyhole } from 'lucide-react-native';
import { radius, spacing } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/store/authStore';
import { useAcademicData } from '@/lib/store/useAcademicData';
import { useThemeColors } from '@/lib/store/themeStore';
import { useToastStore } from '@/lib/store/toastStore';
import { db } from '@/lib/firebase/client';
import { getAcademicPlan, slotKey } from '@/lib/academic/timeline';

export default function NewSemester() {
  const colors = useThemeColors();
  const router = useRouter();
  const uid = useAuthStore((state) => state.firebaseUser?.uid);
  const profile = useAuthStore((state) => state.profile);
  const showToast = useToastStore((state) => state.show);
  const { semesters, loading: academicLoading } = useAcademicData();
  const [creating, setCreating] = useState(false);

  const plan = useMemo(() => getAcademicPlan(profile, semesters), [profile, semesters]);
  const nextSlot = plan.remainingSlots[0] ?? null;
  const progress = plan.slots.length ? plan.createdCount / plan.slots.length : 0;

  async function createNextSemester() {
    if (!uid || !nextSlot || creating) return;
    setCreating(true);
    try {
      // Re-read before writing so another device cannot create the same
      // academic slot while this screen is open.
      const collection = db.collection('users').doc(uid).collection('semesters');
      const latest = await collection.get();
      const duplicate = latest.docs.some((document) => {
        const data = document.data();
        return slotKey(Number(data.level), Number(data.semester)) === nextSlot.key;
      });
      if (duplicate) {
        showToast({ type: 'warning', title: 'Semester already exists', message: 'Your timeline has refreshed to the next available semester.' });
        return;
      }

      const reference = collection.doc(`slot_${nextSlot.level}_${nextSlot.semester}`);
      await reference.set({
        label: nextSlot.label,
        session: nextSlot.session,
        level: nextSlot.level,
        semester: nextSlot.semester,
        gpa: 0,
        pi: 0,
        creditLoaded: 0,
        isComplete: false,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      showToast({ type: 'success', title: 'Semester ready', message: `${nextSlot.label} was added to your results timeline.` });
      router.replace(`/(tabs)/results/${reference.id}`);
    } catch (error: any) {
      showToast({ type: 'error', title: 'Could not create semester', message: error?.message ?? 'Please try again.' });
    } finally {
      setCreating(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
          <Pressable accessibilityLabel="Back to results" onPress={() => router.back()} hitSlop={10} style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={20} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={{ color: colors.text, fontSize: 21, fontWeight: '900' }}>Build your timeline</Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>Only the next valid semester can be created.</Text>
          </View>
        </View>

        {academicLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: spacing.sm }}>Checking your academic plan…</Text>
          </View>
        ) : !plan.slots.length ? (
          <PlanProblem onOpenSettings={() => router.push('/(tabs)/profile')} />
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(280)} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center' }}>
                    <CalendarRange size={20} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '900' }}>{plan.duration}-year programme</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>{plan.entrySession} → {plan.graduationSession}</Text>
                  </View>
                </View>
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '900' }}>{plan.createdCount}/{plan.slots.length}</Text>
              </View>
              <View style={{ height: 7, borderRadius: radius.pill, backgroundColor: colors.overlay, overflow: 'hidden', marginTop: spacing.lg }}>
                <View style={{ width: `${Math.max(4, progress * 100)}%`, height: '100%', borderRadius: radius.pill, backgroundColor: plan.isFullyCreated ? colors.success : colors.primary }} />
              </View>
              <Text style={{ color: colors.textFaint, fontSize: 10, marginTop: 7 }}>{plan.remainingSlots.length} semester slot{plan.remainingSlots.length === 1 ? '' : 's'} remaining</Text>
            </Animated.View>

            {nextSlot ? (
              <Animated.View entering={FadeInDown.delay(70).duration(300)}>
                <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginVertical: spacing.md }}>NEXT AVAILABLE</Text>
                <View style={{ backgroundColor: colors.deep, borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.xl, padding: spacing.lg, shadowColor: colors.primary, shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '900' }}>Y{nextSlot.yearNumber}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>{nextSlot.level}L · {nextSlot.semester === 1 ? 'First' : 'Second'} Semester</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>{nextSlot.session} academic session</Text>
                    </View>
                    <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: colors.successDim, alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={15} color={colors.success} />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, marginTop: spacing.lg }}>
                    <LockKeyhole size={15} color={colors.textMuted} style={{ marginTop: 1 }} />
                    <Text style={{ color: colors.textMuted, fontSize: 11, lineHeight: 17, flex: 1 }}>Earlier slots already in Results are locked out, preventing duplicate levels and semesters.</Text>
                  </View>
                </View>

                <View style={{ marginTop: spacing.lg }}>
                  <Button label={`Create ${nextSlot.level}L ${nextSlot.semester === 1 ? 'First' : 'Second'} Semester`} onPress={createNextSemester} loading={creating} fullWidth themeColors={colors} icon={<ChevronRight size={17} color="#FFFFFF" />} />
                </View>
              </Animated.View>
            ) : (
              <Animated.View entering={FadeInDown.delay(70).duration(300)} style={{ alignItems: 'center', backgroundColor: colors.successDim, borderWidth: 1, borderColor: `${colors.success}55`, borderRadius: radius.xl, padding: spacing.xl }}>
                <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <GraduationCap size={30} color={colors.success} />
                </View>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', marginTop: spacing.md }}>Your full timeline is ready</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5 }}>All {plan.slots.length} semester slots through {plan.graduationSession} already exist. Increase your programme duration in Settings only if your study plan changed.</Text>
                <View style={{ width: '100%', marginTop: spacing.lg }}><Button label="Open academic settings" variant="secondary" onPress={() => router.push('/(tabs)/profile')} fullWidth themeColors={colors} /></View>
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PlanProblem({ onOpenSettings }: { onOpenSettings: () => void }) {
  const colors = useThemeColors();
  return (
    <View style={{ alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.xl }}>
      <CalendarRange size={30} color={colors.warning} />
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900', marginTop: spacing.md }}>Academic timeline needed</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5 }}>Add a valid entry session and programme duration before creating semesters.</Text>
      <View style={{ width: '100%', marginTop: spacing.lg }}><Button label="Set up timeline" onPress={onOpenSettings} fullWidth themeColors={colors} /></View>
    </View>
  );
}
