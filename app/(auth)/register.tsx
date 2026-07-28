import { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import firestore from '@react-native-firebase/firestore';
import { colors, spacing } from '@/constants/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { signUpWithEmail } from '@/lib/firebase/auth';
import { db } from '@/lib/firebase/client';
import { authApi } from '@/lib/api/client';
import type { RegisterFormData } from '@/types/user';

type Step = 'details' | 'otp';

const DEFAULT_UNIVERSITY = 'ESUT Agbani';

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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: spacing.xl }}>
            {step === 'details' ? 'Create your account' : 'Verify your email'}
          </Text>

          {step === 'details' ? (
            <>
              <Input label="Full name" value={form.fullName ?? ''} onChangeText={(v) => update('fullName', v)} />
              <Input label="Matric number" value={form.matric ?? ''} onChangeText={(v) => update('matric', v)} autoCapitalize="characters" />
              <Input label="Email" autoCapitalize="none" keyboardType="email-address" value={form.email ?? ''} onChangeText={(v) => update('email', v)} />
              <Input label="Department" value={form.department ?? ''} onChangeText={(v) => update('department', v)} />
              <Input label="Programme" value={form.programme ?? ''} onChangeText={(v) => update('programme', v)} />
              <Input label="Current session (e.g. 2025/2026)" value={form.currentSession ?? ''} onChangeText={(v) => update('currentSession', v)} />
              <Input label="Password" secureTextEntry value={form.password ?? ''} onChangeText={(v) => update('password', v)} />
              <Input label="Confirm password" secureTextEntry value={form.confirmPassword ?? ''} onChangeText={(v) => update('confirmPassword', v)} />

              {error && <Text style={{ color: colors.danger, marginBottom: spacing.md }}>{error}</Text>}
              <Button label="Continue" onPress={handleSendOtp} loading={loading} fullWidth />
            </>
          ) : (
            <>
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
              <Button
                label="Resend code"
                variant="ghost"
                onPress={handleSendOtp}
                loading={loading}
                fullWidth
              />
            </>
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl }}>
            <Text style={{ color: colors.textMuted }}>Already have an account? </Text>
            <Link href="/(auth)/login">
              <Text style={{ color: colors.primaryGlow, fontWeight: '600' }}>Sign in</Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
