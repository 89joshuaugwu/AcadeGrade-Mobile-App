import { View, Text, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TrendingUp, CalendarClock } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { spacing, radius, APP_NAME, colors } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { AcadeMindMark } from '@/components/ui/AcadeMindMark';

/**
 * REBUILT to match the inspiration reference exactly (image 2,
 * "WelcomeSplash" panel): gradient icon badge, wordmark, gold status pill,
 * three feature pills, two CTAs. Per explicit instruction, the two CTAs now
 * route differently — "Get Started" leads into the new Onboarding flow,
 * "Sign In" skips it entirely and goes straight to Login.
 *
 * Deliberately DARK, not theme-toggled: in the reference, WelcomeSplash is
 * the one dark panel — everything after it (Onboarding, Auth, Dashboard)
 * is light. Keeping this screen dark also gives a seamless handoff from
 * the native splash screen (which is dark, #07090F) with no color flash.
 */
export default function Welcome() {
  const router = useRouter();
  const c = colors;

  return (
    <View style={{ flex: 1, backgroundColor: c.void }}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between', padding: spacing.xl }}>
        <View />

        <View style={{ alignItems: 'center' }}>
          <Animated.View
            entering={FadeInDown.duration(500).springify()}
            style={{ marginBottom: spacing.lg, shadowColor: '#6366F1', shadowOpacity: 0.5, shadowRadius: 28, shadowOffset: { width: 0, height: 8 }, elevation: 10 }}
          >
            <Image
              source={require('../../assets/logo.png')}
              style={{ width: 120, height: 120 }}
              resizeMode="contain"
            />
          </Animated.View>

          <Animated.Text entering={FadeInDown.delay(100).duration(500)} style={{ color: c.text, fontSize: 32, fontWeight: '800', marginBottom: spacing.sm }}>
            {APP_NAME}
          </Animated.Text>

          <Animated.View entering={FadeInDown.delay(180).duration(500)} style={{ backgroundColor: c.goldDim, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, marginBottom: spacing.xl }}>
            <Text style={{ color: c.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>EXCELLENCE TRACKED</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(240).duration(500)} style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
            <FeaturePill icon={<TrendingUp size={13} color={c.textMuted} />} label="GPA Tracking" c={c} />
            <FeaturePill icon={<AcadeMindMark size={13} />} label="Smart Insights" c={c} />
            <FeaturePill icon={<CalendarClock size={13} color={c.textMuted} />} label="Deadlines" c={c} />
          </Animated.View>
        </View>

        <Animated.View entering={FadeInUp.delay(300).duration(500)} style={{ gap: spacing.md }}>
          <Button label="Get Started" onPress={() => router.push('/(auth)/register')} fullWidth />
          <Button label="Sign In" variant="secondary" onPress={() => router.push('/(auth)/login')} fullWidth />
          <Text style={{ color: c.textFaint, fontSize: 11, textAlign: 'center', marginTop: spacing.xs }}>
            By continuing, you agree to our Terms
          </Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

function FeaturePill({ icon, label, c }: { icon: React.ReactNode; label: string; c: typeof colors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill }}>
      {icon}
      <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
