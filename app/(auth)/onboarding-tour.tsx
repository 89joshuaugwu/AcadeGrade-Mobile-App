import { useState } from 'react';
import { View, Text, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { AuthGlow } from '@/components/ui/AuthGlow';
import { HeroArt } from '@/components/ui/HeroArt';
import { db } from '@/lib/firebase/client';
import { useAuthStore } from '@/lib/store/authStore';

/**
 * UPGRADED per acadegrade-ui-upgrade-prompt.md §1: AuthGlow background,
 * emoji hero swapped for HeroArt, preference row wrapped in GlassCard,
 * staggered entrance. Firestore write (mobileOnboardingCompleted /
 * tourCompleted) unchanged.
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
        tourCompleted: !showDashboardTour,
      });
    } finally {
      setSaving(false);
      router.replace('/(tabs)/dashboard');
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <AuthGlow />
      <SafeAreaView style={{ flex: 1, padding: spacing.xl, justifyContent: 'center' }}>
        <Animated.View entering={FadeInDown.duration(300)} style={{ alignItems: 'center', marginBottom: spacing.lg }}>
          <HeroArt icon="GraduationCap" color={colors.gold} />
        </Animated.View>
        <Animated.Text
          entering={FadeInDown.delay(80).duration(300)}
          style={{ color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: spacing.sm }}
        >
          You're all set
        </Animated.Text>
        <Animated.Text
          entering={FadeInDown.delay(120).duration(300)}
          style={{ color: colors.textMuted, fontSize: 15, textAlign: 'center', marginBottom: spacing.xxl, lineHeight: 22 }}
        >
          Want a quick guided tour of your dashboard the first time you open it?
        </Animated.Text>

        <Animated.View entering={FadeInDown.delay(160).duration(300)} style={{ marginBottom: spacing.xxl }}>
          <GlassCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
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
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <Button label="Go to Dashboard" onPress={finish} loading={saving} fullWidth />
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}
