import { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import firestore from '@react-native-firebase/firestore';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { colors, spacing } from '@/constants/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { AuthGlow } from '@/components/ui/AuthGlow';
import { signUpWithEmail } from '@/lib/firebase/auth';
import { db } from '@/lib/firebase/client';
import { authApi } from '@/lib/api/client';
import type { RegisterFormData } from '@/types/user';

type Step = 'details' | 'otp';

const DEFAULT_UNIVERSITY = 'ESUT Agbani';

/**
 * UPGRADED per acadegrade-ui-upgrade-prompt.md §1: AuthGlow background,
 * form wrapped in GlassCard, staggered field entrance, step transition
 * fade. All registration/OTP/Firestore-write logic unchanged — same user
 * doc shape web writes on registration.
 */
export default function Register() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('details');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otp, setOtp] = useState('');

  const [form, setForm] = useState<Partial<RegisterFormData>>({
    university: DEFAULT_UNIVERSITY,
    currentLevel: 100,
    recordMode: 'fromScratch',
  });

  function update<K extends keyof RegisterFormData>(key: K, value: RegisterFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSendOtp() {
    setError(null);
    if (!form.email || !form.password || !form.fullName || !form.matric) {
      return setError('Fill in all required fields');
    }
    if (form.password !== form.confirmPassword) {
      return setError('Passwords do not match');
    }
    setLoading(true);
    try {
      await authApi.sendOtp(form.email.trim().toLowerCase(), 'registration');
      setStep('otp');
    } catch (e: any) {
      setError(e.message ?? 'Could not send verification code');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyAndCreate() {
    setError(null);
    if (otp.length < 4) return setError('Enter the code sent to your email');
    setLoading(true);
    try {
      await authApi.verifyOtp(form.email!.trim().toLowerCase(), otp, 'registration');

      const cred = await signUpWithEmail(form.email!.trim(), form.password!);

      // Write the SAME Firestore user document shape the web app writes on
      // registration (app/(public)/register/page.tsx) — do not invent new fields.
      await db.collection('users').doc(cred.user.uid).set({
        fullName: form.fullName,
        email: form.email!.trim().toLowerCase(),
        matric: form.matric,
        department: form.department ?? '',
        currentLevel: form.currentLevel ?? 100,
        programme: form.programme ?? '',
        university: form.university ?? DEFAULT_UNIVERSITY,
        avatarUrl: null,
        recordMode: form.recordMode ?? 'fromScratch',
        gradeMode: 'cgpa',
        currentSession: form.currentSession ?? '',
        isAdmin: false,
        disabled: false,
        fcmToken: null,
        fcmTokens: [],
        mobileOnboardingCompleted: false,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      // Root layout auth listener takes it from here → onboarding tour
    } catch (e: any) {
      setError(e.message ?? 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <AuthGlow />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
            <Animated.Text
              entering={FadeInDown.duration(300)}
              style={{ color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: spacing.xl }}
            >
              {step === 'details' ? 'Create your account' : 'Verify your email'}
            </Animated.Text>

            <GlassCard elevated>
              {step === 'details' ? (
                <Animated.View key="details" entering={FadeIn.duration(250)}>
                  {[
                    { label: 'Full name', key: 'fullName' as const, props: {} },
                    { label: 'Matric number', key: 'matric' as const, props: { autoCapitalize: 'characters' as const } },
                    { label: 'Email', key: 'email' as const, props: { autoCapitalize: 'none' as const, keyboardType: 'email-address' as const } },
                    { label: 'Department', key: 'department' as const, props: {} },
                    { label: 'Programme', key: 'programme' as const, props: {} },
                    { label: 'Current session (e.g. 2025/2026)', key: 'currentSession' as const, props: {} },
                    { label: 'Password', key: 'password' as const, props: { secureTextEntry: true } },
                    { label: 'Confirm password', key: 'confirmPassword' as const, props: { secureTextEntry: true } },
                  ].map((field, i) => (
                    <Animated.View key={field.key} entering={FadeInDown.delay(40 * i).duration(250)}>
                      <Input
                        label={field.label}
                        value={(form[field.key] as string) ?? ''}
                        onChangeText={(v) => update(field.key, v as any)}
                        {...field.props}
                      />
                    </Animated.View>
                  ))}

                  {error && <Text style={{ color: colors.danger, marginBottom: spacing.md }}>{error}</Text>}
                  <Button label="Continue" onPress={handleSendOtp} loading={loading} fullWidth />
                </Animated.View>
              ) : (
                <Animated.View key="otp" entering={FadeIn.duration(250)}>
                  <Text style={{ color: colors.textMuted, marginBottom: spacing.lg }}>
                    We sent a 6-digit code to {form.email}. It expires in 5 minutes.
                  </Text>
                  <Input
                    label="Verification code"
                    keyboardType="number-pad"
                    value={otp}
                    onChangeText={setOtp}
                    maxLength={6}
                  />
                  {error && <Text style={{ color: colors.danger, marginBottom: spacing.md }}>{error}</Text>}
                  <Button label="Verify & Create Account" onPress={handleVerifyAndCreate} loading={loading} fullWidth />
                  <View style={{ height: spacing.sm }} />
                  <Button label="Resend code" variant="ghost" onPress={handleSendOtp} loading={loading} fullWidth />
                </Animated.View>
              )}
            </GlassCard>

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl }}>
              <Text style={{ color: colors.textMuted }}>Already have an account? </Text>
              <Link href="/(auth)/login">
                <Text style={{ color: colors.primaryGlow, fontWeight: '600' }}>Sign in</Text>
              </Link>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
