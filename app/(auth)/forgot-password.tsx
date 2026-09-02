import { useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Mail, KeyRound, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { spacing, lightColors as c } from '@/constants/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { SuccessCheck } from '@/components/ui/SuccessCheck';
import { authApi } from '@/lib/api/client';

type Step = 'email' | 'reset';

/**
 * REBUILT to match the login screen's new light-theme card style exactly
 * (same logo header, same icon-prefixed inputs, same button styling) — per
 * explicit instruction: "register page and forgot password page should use
 * the same design as the sign in page ... modified to match this page's
 * features." OTP/reset API calls unchanged.
 */
export default function ForgotPassword() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      <View style={{ flex: 1, backgroundColor: c.void }}>
        <SafeAreaView style={{ flex: 1, padding: spacing.xl, justifyContent: 'center', alignItems: 'center' }}>
          <Animated.View entering={FadeIn.duration(300)} style={{ marginBottom: spacing.lg }}>
            <SuccessCheck />
          </Animated.View>
          <Animated.Text entering={FadeInDown.delay(150).duration(300)} style={{ color: c.text, fontSize: 19, fontWeight: '700', textAlign: 'center', marginBottom: spacing.xl }}>
            Password reset. Sign in with your new password.
          </Animated.Text>
          <Animated.View entering={FadeInDown.delay(250).duration(300)} style={{ width: '100%' }}>
            <Button label="Back to Sign In" onPress={() => router.replace('/(auth)/login')} fullWidth />
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.void }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: spacing.xl, flexGrow: 1, justifyContent: 'center' }}>
            <Pressable onPress={() => router.back()} style={{ marginBottom: spacing.lg }} hitSlop={8}>
              <ArrowLeft size={22} color={c.text} />
            </Pressable>

            <Animated.View entering={FadeInDown.duration(300)} style={{ alignItems: 'center', marginBottom: spacing.xl }}>
              <Logo size={52} tagline="Reset your password" themeColors={c} />
            </Animated.View>

            {step === 'email' ? (
              <Animated.View entering={FadeIn.duration(250)}>
                <Input label="Email Address" placeholder="name@university.edu.ng" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} themeColors={c} leftIcon={<Mail size={17} color={c.textFaint} />} />
                {error && <Text style={{ color: c.danger, marginBottom: spacing.md, fontSize: 13 }}>{error}</Text>}
                <Button label="Send Reset Code" onPress={sendCode} loading={loading} fullWidth />
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn.duration(250)}>
                <Input label="Verification Code" keyboardType="number-pad" maxLength={6} value={otp} onChangeText={setOtp} themeColors={c} leftIcon={<KeyRound size={17} color={c.textFaint} />} />
                <Input
                  label="New Password" secureTextEntry={!showPassword} value={newPassword} onChangeText={setNewPassword}
                  themeColors={c} leftIcon={<Lock size={17} color={c.textFaint} />}
                  rightElement={<Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>{showPassword ? <EyeOff size={17} color={c.textFaint} /> : <Eye size={17} color={c.textFaint} />}</Pressable>}
                />
                {error && <Text style={{ color: c.danger, marginBottom: spacing.md, fontSize: 13 }}>{error}</Text>}
                <Button label="Reset Password" onPress={resetPassword} loading={loading} fullWidth />
              </Animated.View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
