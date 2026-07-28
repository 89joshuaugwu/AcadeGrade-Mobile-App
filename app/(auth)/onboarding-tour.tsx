import { useState } from 'react';
import { View, Text, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { db } from '@/lib/firebase/client';
import { useAuthStore } from '@/lib/store/authStore';

/**
 * Mobile-only post-auth tour, gated by `mobileOnboardingCompleted` on the
 * SAME Firestore user doc web already uses for `tourCompleted` /
 * `resultsTourCompleted` — same pattern, new field, so it doesn't collide
 * with web's own dashboard tour state.
 */
export default function OnboardingTour() {
  const router = useRouter();
  const { firebaseUser } = useAuthStore();
  const [showDashboardTour, setShowDashboardTour] = useState(true);
  const [saving, setSaving] = useState(false);

  async function finish() {
    if (!firebaseUser) return;
    setSaving(true);
    try {
      await db.collection('users').doc(firebaseUser.uid).update({
        mobileOnboardingCompleted: true,
        // Reuses web's existing tourCompleted flag so the in-dashboard
        // walkthrough (arrows/tooltips over CGPAArc, KPI cards, etc.) only
        // shows if the user opted in here.
        tourCompleted: !showDashboardTour,
      });
    } finally {
      setSaving(false);
      router.replace('/(tabs)/dashboard');
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void, padding: spacing.xl, justifyContent: 'center' }}>
      <Text style={{ fontSize: 56, textAlign: 'center', marginBottom: spacing.lg }}>🎓</Text>
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: spacing.sm }}>
        You're all set
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 15, textAlign: 'center', marginBottom: spacing.xxl, lineHeight: 22 }}>
        Want a quick guided tour of your dashboard the first time you open it?
      </Text>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 16,
          padding: spacing.lg,
          marginBottom: spacing.xxl,
        }}
      >
        <View style={{ flex: 1, marginRight: spacing.md }}>
          <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 2 }}>Show dashboard tour</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>You can always skip it once it starts</Text>
        </View>
        <Switch
          value={showDashboardTour}
          onValueChange={setShowDashboardTour}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor="#FFFFFF"
        />
      </View>

      <Button label="Go to Dashboard" onPress={finish} loading={saving} fullWidth />
    </SafeAreaView>
  );
}
