import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import firestore from '@react-native-firebase/firestore';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react-native';
import { colors, spacing } from '@/constants/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { AuthGlow } from '@/components/ui/AuthGlow';
import { Logo } from '@/components/ui/Logo';
import { PickerField } from '@/components/ui/PickerField';
import { signUpWithEmail, signInWithGoogle } from '@/lib/firebase/auth';
import { db } from '@/lib/firebase/client';
import { useAuthStore } from '@/lib/store/authStore';
import { authApi } from '@/lib/api/client';
import { NIGERIAN_UNIVERSITIES, ACADEMIC_DEPARTMENTS, ACADEMIC_PROGRAMMES } from '@/lib/data/academic-data';
import type { RegisterFormData, StudentLevel } from '@/types/user';

type Step = 1 | 2 | 3;
type AuthMethod = 'email' | 'google';

const DEFAULT_UNIVERSITY = 'ESUT Agbani';
const TOTAL_STEPS = 3;

/**
 * REBUILT to match web's actual `app/(public)/register/page.tsx` flow —
 * the previous version of this file was a single flat form with no OTP
 * step and no Google-skip-OTP branching, which was wrong on both counts.
 * Web's real behavior, confirmed by re-reading the source just before this
 * rewrite:
 *   - Google signup: `signInWithGoogle()` runs immediately, prefills
 *     name/email, and SKIPS the OTP step entirely (already verified by
 *     Google) — goes straight to step 2.
 *   - Email signup: requires `/api/auth/otp/send` → user enters the code →
 *     `/api/auth/otp/verify` → THEN proceeds — matches `authApi` calls
 *     already wired up elsewhere in this codebase.
 * Simplified from web's 4-step wizard to 3: the "past semesters" review
 * step (step 4 on web, for users who pick "complete" record mode) isn't
 * built yet — noted as a follow-up, not silently dropped.
 */
export default function Register() {
  const router = useRouter();
  const { firebaseUser } = useAuthStore();
  const [step, setStep] = useState<Step>(1);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<Partial<RegisterFormData> & { courseDuration?: number }>({
    university: DEFAULT_UNIVERSITY,
    currentLevel: 100,
    courseDuration: 4,
    recordMode: 'fromScratch',
  });

  function update<K extends string>(key: K, value: any) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // Auto-calculate level from entry session, same formula as web
  useEffect(() => {
    const session = form.currentSession;
    if (session && /^\d{4}\/\d{4}$/.test(session)) {
      const startYear = parseInt(session.split('/')[0], 10);
      const currentYear = new Date().getFullYear();
      let calculated = (currentYear - startYear) * 100 + 100;
      const maxLevel = (form.courseDuration ?? 4) * 100;
      calculated = Math.max(100, Math.min(maxLevel, calculated));
      update('currentLevel', calculated as StudentLevel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.currentSession, form.courseDuration]);

  async function handleGoogleSignup() {
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithGoogle();
      const gUser = cred.user;
      setAuthMethod('google');
      if (gUser.email) update('email', gUser.email);
      if (gUser.displayName) update('fullName', gUser.displayName);
    } catch (e: any) {
      if (e.code !== 'auth/popup-closed-by-user') setError('Failed to authenticate with Google');
    } finally {
      setLoading(false);
    }
  }

  async function handleContinueStep1() {
    setError(null);
    if (!form.fullName || !form.matric || !form.email) return setError('Fill in all required fields');
    if (authMethod === 'email') {
      if (!form.password || form.password.length < 6) return setError('Password must be at least 6 characters');
      if (form.password !== form.confirmPassword) return setError('Passwords do not match');
    }

    if (authMethod === 'google') {
      setStep(2);
      return;
    }

    setLoading(true);
    try {
      await authApi.sendOtp(form.email.trim().toLowerCase(), 'registration');
      setShowOtp(true);
      setCooldown(60);
    } catch (e: any) {
      setError(e.message ?? 'Could not send verification code');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setError(null);
    if (otp.length < 4) return setError('Enter the 6-digit code');
    setLoading(true);
    try {
      await authApi.verifyOtp(form.email!.trim().toLowerCase(), otp, 'registration');
      setStep(2);
    } catch (e: any) {
      setError(e.message ?? 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  function handleContinueStep2() {
    setError(null);
    if (!form.university || !form.department || !form.programme || !form.currentSession) {
      return setError('Fill in all academic details');
    }
    setStep(3);
  }

  async function handleFinish() {
    setError(null);
    setLoading(true);
    try {
      let uid: string;
      if (authMethod === 'google') {
        if (!firebaseUser) throw new Error('Google session expired — please sign in again');
        uid = firebaseUser.uid;
      } else {
        const cred = await signUpWithEmail(form.email!.trim(), form.password!);
        uid = cred.user.uid;
      }

      // Same Firestore user-doc shape web writes on registration —
      // do not invent new fields.
      await db.collection('users').doc(uid).set({
        fullName: form.fullName,
        email: form.email!.trim().toLowerCase(),
        matric: form.matric,
        department: form.department,
        currentLevel: form.currentLevel ?? 100,
        programme: form.programme,
        university: form.university ?? DEFAULT_UNIVERSITY,
        avatarUrl: null,
        recordMode: form.recordMode ?? 'fromScratch',
        gradeMode: 'cgpa',
        currentSession: form.currentSession,
        isAdmin: false,
        disabled: false,
        fcmToken: null,
        fcmTokens: [],
        mobileOnboardingCompleted: false,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      // Root layout's auth listener takes it from here → onboarding tour
    } catch (e: any) {
      setError(e.message ?? 'Failed to create your account');
    } finally {
      setLoading(false);
    }
  }

  const levels = Array.from({ length: form.courseDuration ?? 4 }, (_, i) => (i + 1) * 100);

  return (
    <View style={{ flex: 1 }}>
      <AuthGlow />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
          <Animated.View entering={FadeInDown.duration(300)} style={{ alignItems: 'center', marginBottom: spacing.lg }}>
            <Logo size={52} tagline="Master Your Academic Journey" />
          </Animated.View>

          {/* Step progress */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: spacing.lg }}>
            {[1, 2, 3].map((s) => (
              <View
                key={s}
                style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: s <= step ? colors.primary : colors.border }}
              />
            ))}
          </View>

          <GlassCard elevated>
            {step === 1 && (
              <Animated.View key="step1" entering={FadeIn.duration(250)}>
                {!showOtp ? (
                  <>
                    <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: spacing.md }}>
                      Create your account
                    </Text>

                    {authMethod === 'email' && (
                      <Button
                        label="Continue with Google"
                        variant="secondary"
                        onPress={handleGoogleSignup}
                        loading={loading}
                        fullWidth
                      />
                    )}
                    {authMethod === 'google' && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.successDim, borderRadius: 10, padding: spacing.sm, marginBottom: spacing.md }}>
                        <Check size={16} color={colors.success} />
                        <Text style={{ color: colors.success, fontSize: 13, flex: 1 }}>
                          Google authenticated — verify your details below
                        </Text>
                      </View>
                    )}

                    {authMethod === 'email' && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md }}>
                        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                        <Text style={{ color: colors.textFaint, fontSize: 12, marginHorizontal: spacing.sm }}>OR</Text>
                        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                      </View>
                    )}

                    <Input label="Full name" value={form.fullName ?? ''} onChangeText={(v) => update('fullName', v)} />
                    <Input label="Matric number" autoCapitalize="characters" value={form.matric ?? ''} onChangeText={(v) => update('matric', v)} />
                    <Input
                      label="Email"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      editable={authMethod === 'email'}
                      value={form.email ?? ''}
                      onChangeText={(v) => update('email', v)}
                    />
                    {authMethod === 'email' && (
                      <>
                        <Input label="Password" secureTextEntry value={form.password ?? ''} onChangeText={(v) => update('password', v)} />
                        <Input label="Confirm password" secureTextEntry value={form.confirmPassword ?? ''} onChangeText={(v) => update('confirmPassword', v)} />
                      </>
                    )}

                    {error && <Text style={{ color: colors.danger, marginBottom: spacing.md }}>{error}</Text>}
                    <Button label="Continue" onPress={handleContinueStep1} loading={loading} fullWidth />
                  </>
                ) : (
                  <>
                    <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: spacing.sm }}>
                      Verify your email
                    </Text>
                    <Text style={{ color: colors.textMuted, marginBottom: spacing.lg, fontSize: 13 }}>
                      We sent a 6-digit code to {form.email}. It expires in 5 minutes.
                    </Text>
                    <Input label="Verification code" keyboardType="number-pad" maxLength={6} value={otp} onChangeText={setOtp} />
                    {error && <Text style={{ color: colors.danger, marginBottom: spacing.md }}>{error}</Text>}
                    <Button label="Verify & Continue" onPress={handleVerifyOtp} loading={loading} fullWidth />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md }}>
                      <Pressable onPress={() => setShowOtp(false)}>
                        <Text style={{ color: colors.textMuted, fontSize: 13 }}>Back</Text>
                      </Pressable>
                      <Pressable disabled={cooldown > 0} onPress={handleContinueStep1}>
                        <Text style={{ color: cooldown > 0 ? colors.textFaint : colors.primaryGlow, fontSize: 13 }}>
                          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                        </Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </Animated.View>
            )}

            {step === 2 && (
              <Animated.View key="step2" entering={FadeIn.duration(250)}>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: spacing.md }}>
                  Academic details
                </Text>

                <PickerField label="University" value={form.university ?? ''} onChange={(v) => update('university', v)} options={NIGERIAN_UNIVERSITIES} />
                <PickerField label="Department" value={form.department ?? ''} onChange={(v) => update('department', v)} options={ACADEMIC_DEPARTMENTS} placeholder="e.g. Computer Science" />
                <PickerField label="Programme" value={form.programme ?? ''} onChange={(v) => update('programme', v)} options={ACADEMIC_PROGRAMMES} placeholder="e.g. B.Sc Computer Science" />

                <View style={{ marginBottom: spacing.md }}>
                  <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>Course duration (years)</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {[3, 4, 5, 6].map((d) => (
                      <Pressable
                        key={d}
                        onPress={() => update('courseDuration', d)}
                        style={{
                          flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: form.courseDuration === d ? colors.primary : colors.border,
                          backgroundColor: form.courseDuration === d ? colors.primaryDim : colors.surface,
                        }}
                      >
                        <Text style={{ color: form.courseDuration === d ? colors.primaryGlow : colors.textMuted, fontWeight: '600', fontSize: 13 }}>{d} yrs</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <Input label="Entry year/session" placeholder="e.g. 2022/2023" value={form.currentSession ?? ''} onChangeText={(v) => update('currentSession', v)} />

                <View style={{ marginBottom: spacing.md }}>
                  <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>Current level (auto-calculated, adjustable)</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {levels.map((l) => (
                      <Pressable
                        key={l}
                        onPress={() => update('currentLevel', l)}
                        style={{
                          height: 36, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: form.currentLevel === l ? colors.primary : colors.border,
                          backgroundColor: form.currentLevel === l ? colors.primaryDim : colors.surface,
                        }}
                      >
                        <Text style={{ color: form.currentLevel === l ? colors.primaryGlow : colors.textMuted, fontWeight: '600', fontSize: 12 }}>{l}L</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {error && <Text style={{ color: colors.danger, marginBottom: spacing.md }}>{error}</Text>}
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <Button label="Back" variant="ghost" onPress={() => setStep(1)} />
                  <View style={{ flex: 1 }}>
                    <Button label="Continue" onPress={handleContinueStep2} fullWidth />
                  </View>
                </View>
              </Animated.View>
            )}

            {step === 3 && (
              <Animated.View key="step3" entering={FadeIn.duration(250)}>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: spacing.md }}>
                  How do you want to track?
                </Text>

                <Pressable
                  onPress={() => update('recordMode', 'fromScratch')}
                  style={{
                    borderRadius: 16, padding: spacing.lg, borderWidth: 2, marginBottom: spacing.md,
                    borderColor: form.recordMode === 'fromScratch' ? colors.primary : colors.border,
                    backgroundColor: form.recordMode === 'fromScratch' ? colors.primaryDim : colors.surface,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 4 }}>From Scratch</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>Start fresh — enter results as you go. Perfect for freshers.</Text>
                </Pressable>

                <Pressable
                  onPress={() => update('recordMode', 'complete')}
                  style={{
                    borderRadius: 16, padding: spacing.lg, borderWidth: 2, marginBottom: spacing.lg,
                    borderColor: form.recordMode === 'complete' ? colors.gold : colors.border,
                    backgroundColor: form.recordMode === 'complete' ? colors.goldDim : colors.surface,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 4 }}>Complete Record</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>I have past results to enter now to build my CGPA.</Text>
                </Pressable>

                {form.recordMode === 'complete' && (
                  <Text style={{ color: colors.textFaint, fontSize: 12, marginBottom: spacing.md, fontStyle: 'italic' }}>
                    You'll be able to add your past semesters from the Results tab right after setup.
                  </Text>
                )}

                {error && <Text style={{ color: colors.danger, marginBottom: spacing.md }}>{error}</Text>}
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <Button label="Back" variant="ghost" onPress={() => setStep(2)} />
                  <View style={{ flex: 1 }}>
                    <Button label="Create Account" onPress={handleFinish} loading={loading} fullWidth />
                  </View>
                </View>
              </Animated.View>
            )}
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
