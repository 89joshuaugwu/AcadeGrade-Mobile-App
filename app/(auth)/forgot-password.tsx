import { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { colors, spacing } from '@/constants/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { AuthGlow } from '@/components/ui/AuthGlow';
import { SuccessCheck } from '@/components/ui/SuccessCheck';
import { authApi } from '@/lib/api/client';

type Step = 'email' | 'reset';

/**
 * UPGRADED per acadegrade-ui-upgrade-prompt.md §1: AuthGlow background,
 * GlassCard form panel, staggered field entrance, and the success screen's
 * static ✅ emoji replaced with SuccessCheck (checkmark draw-in). OTP/reset
 * API calls unchanged.
 */
export default function ForgotPassword() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function sendCode() {
    setError(null);
    if (!email) return setError('Enter your email');
    setLoading(true);
    try {
      await authApi.sendOtp(email.trim().toLowerCase(), 'reset');
      setStep('reset');
    } catch (e: any) {
      setError(e.message ?? 'Could not send code');
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    setError(null);
    if (otp.length < 4 || newPassword.length < 6) return setError('Enter the code and a password (6+ characters)');
    setLoading(true);
    try {
      await authApi.resetPassword(email.trim().toLowerCase(), otp, newPassword);
      setDone(true);
    } catch (e: any) {
      setError(e.message ?? 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <View style={{ flex: 1 }}>
        <AuthGlow />
        <SafeAreaView style={{ flex: 1, padding: spacing.xl, justifyContent: 'center', alignItems: 'center' }}>
          <Animated.View entering={FadeIn.duration(300)} style={{ marginBottom: spacing.lg }}>
            <SuccessCheck />
          </Animated.View>
          <Animated.Text
            entering={FadeInDown.delay(200).duration(300)}
            style={{ color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: spacing.xl }}
          >
            Password reset. Sign in with your new password.
          </Animated.Text>
          <Animated.View entering={FadeInDown.delay(300).duration(300)} style={{ width: '100%' }}>
            <Button label="Back to Sign In" onPress={() => router.replace('/(auth)/login')} fullWidth />
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AuthGlow />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, flexGrow: 1, justifyContent: 'center' }}>
          <Animated.Text
            entering={FadeInDown.duration(300)}
            style={{ color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: spacing.xl }}
          >
            Reset your password
          </Animated.Text>

          <GlassCard elevated>
            {step === 'email' ? (
              <Animated.View entering={FadeIn.duration(250)}>
                <Input label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
                {error && <Text style={{ color: colors.danger, marginBottom: spacing.md }}>{error}</Text>}
                <Button label="Send reset code" onPress={sendCode} loading={loading} fullWidth />
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn.duration(250)}>
                <Input label="Verification code" keyboardType="number-pad" value={otp} onChangeText={setOtp} maxLength={6} />
                <Input label="New password" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
                {error && <Text style={{ color: colors.danger, marginBottom: spacing.md }}>{error}</Text>}
                <Button label="Reset password" onPress={resetPassword} loading={loading} fullWidth />
              </Animated.View>
            )}
          </GlassCard>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
