import { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing } from '@/constants/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { authApi } from '@/lib/api/client';

type Step = 'email' | 'reset';

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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.void, padding: spacing.xl, justifyContent: 'center' }}>
        <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: spacing.lg }}>✅</Text>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: spacing.xl }}>
          Password reset. Sign in with your new password.
        </Text>
        <Button label="Back to Sign In" onPress={() => router.replace('/(auth)/login')} fullWidth />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, flexGrow: 1, justifyContent: 'center' }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: spacing.xl }}>
          Reset your password
        </Text>

        {step === 'email' ? (
          <>
            <Input label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
            {error && <Text style={{ color: colors.danger, marginBottom: spacing.md }}>{error}</Text>}
            <Button label="Send reset code" onPress={sendCode} loading={loading} fullWidth />
          </>
        ) : (
          <>
            <Input label="Verification code" keyboardType="number-pad" value={otp} onChangeText={setOtp} maxLength={6} />
            <Input label="New password" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
            {error && <Text style={{ color: colors.danger, marginBottom: spacing.md }}>{error}</Text>}
            <Button label="Reset password" onPress={resetPassword} loading={loading} fullWidth />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
