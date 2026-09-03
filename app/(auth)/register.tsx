import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import firestore from '@react-native-firebase/firestore';
import { User, Mail, Lock, Eye, EyeOff, KeyRound, Check } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { spacing, radius } from '@/constants/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { PickerField } from '@/components/ui/PickerField';
import { SegmentedPill } from './login';
import { getGoogleSignInErrorMessage, signUpWithEmail, signInWithGoogle } from '@/lib/firebase/auth';
import { db } from '@/lib/firebase/client';
import { useAuthStore } from '@/lib/store/authStore';
import { authApi } from '@/lib/api/client';
import { NIGERIAN_UNIVERSITIES, ACADEMIC_DEPARTMENTS, ACADEMIC_PROGRAMMES } from '@/lib/data/academic-data';
import type { RegisterFormData, StudentLevel } from '@/types/user';
import { useThemeColors } from '@/lib/store/themeStore';
import { COURSE_DURATION_OPTIONS, formatSessionInput, graduationSession, inferCurrentLevel, parseAcademicSession } from '@/lib/academic/timeline';

type AuthMethod = 'email' | 'google';
const DEFAULT_UNIVERSITY = 'ESUT Agbani';

/**
 * REBUILT again per a direct simplification request: instead of a
 * send-code → separate verify-code screen, step 1 is now ONE form —
 * Full Name, Email (with an inline "Get Code" button), Password, Confirm
 * Password (eye toggles on both), and an OTP field at the bottom — all
 * submitted together in a single "Create Account" tap. Google signup still
 * bypasses password/OTP entirely (already verified by Google) and jumps
 * straight to step 2, exactly as before. Same Firestore write shape as
 * every previous version — that part was never wrong.
 */
export default function Register() {
  const c = useThemeColors();
  const router = useRouter();
  const { firebaseUser } = useAuthStore();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');

  const [fullName, setFullName] = useState('');
  const [matric, setMatric] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [otp, setOtp] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<Partial<RegisterFormData>>({
    university: DEFAULT_UNIVERSITY, currentLevel: 100, courseDuration: 4, recordMode: 'fromScratch',
  });
  function update<K extends string>(key: K, value: any) { setForm((f) => ({ ...f, [key]: value })); }

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((v) => v - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    const session = form.currentSession;
    if (parseAcademicSession(session) != null) {
      update('currentLevel', inferCurrentLevel(session!, form.courseDuration ?? 4) as StudentLevel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.currentSession, form.courseDuration]);

  async function handleGetCode() {
    setError(null);
    if (!email || !email.includes('@')) return setError('Enter a valid email first');
    setSendingCode(true);
    try {
      await authApi.sendOtp(email.trim().toLowerCase(), 'registration');
      setCodeSent(true);
      setCooldown(60);
    } catch (e: any) {
      setError(e.message ?? 'Could not send verification code');
    } finally {
      setSendingCode(false);
    }
  }

  async function handleGoogleSignup() {
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithGoogle();
      setAuthMethod('google');
      if (cred.user.email) setEmail(cred.user.email);
      if (cred.user.displayName) setFullName(cred.user.displayName);
      setStep(2);
    } catch (e: any) {
      const message = getGoogleSignInErrorMessage(e);
      if (message) setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitStep1() {
    setError(null);
    if (!fullName || !matric || !email) return setError('Fill in all required fields');
    if (!password || password.length < 6) return setError('Password must be at least 6 characters');
    if (password !== confirmPassword) return setError('Passwords do not match');
    if (!codeSent) return setError('Tap "Get Code" to receive your verification code first');
    if (otp.length < 4) return setError('Enter the verification code sent to your email');

    setLoading(true);
    try {
      await authApi.verifyOtp(email.trim().toLowerCase(), otp, 'registration');
      setStep(2);
    } catch (e: any) {
      setError(e.message ?? 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  }

  function handleContinueStep2() {
    setError(null);
    if (!form.university || !form.department || !form.programme || !form.currentSession) {
      return setError('Fill in all academic details');
    }
    if (parseAcademicSession(form.currentSession) == null) {
      return setError('Entry session must be consecutive years, for example 2022/2023');
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
        const cred = await signUpWithEmail(email.trim(), password);
        uid = cred.user.uid;
      }

      await db.collection('users').doc(uid).set({
        fullName, email: email.trim().toLowerCase(), matric,
        department: form.department, currentLevel: form.currentLevel ?? 100,
        programme: form.programme, university: form.university ?? DEFAULT_UNIVERSITY,
        avatarUrl: null, recordMode: form.recordMode ?? 'fromScratch', gradeMode: 'cgpa',
        currentSession: form.currentSession,
        entrySession: form.currentSession,
        courseDuration: form.courseDuration ?? 4,
        graduationSession: graduationSession(form.currentSession ?? '', form.courseDuration ?? 4),
        isAdmin: false, disabled: false,
        // The user reached registration through the pre-auth product intro.
        // The authenticated usage guide will keep its own versioned progress.
        fcmToken: null, fcmTokens: [], mobileOnboardingCompleted: true,
        mobileUsageTourVersion: 1, mobileUsageTourCompletedChapters: [],
        mobileUsageTourSkipped: false, mobileUsageTourCompleted: false,
        createdAt: firestore.FieldValue.serverTimestamp(), updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    } catch (e: any) {
      setError(e.message ?? 'Failed to create your account');
    } finally {
      setLoading(false);
    }
  }

  const levels = Array.from({ length: form.courseDuration ?? 4 }, (_, i) => (i + 1) * 100);

  return (
    <View style={{ flex: 1, backgroundColor: c.void }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
            <Animated.View entering={FadeInDown.duration(300)} style={{ alignItems: 'center', marginBottom: spacing.lg }}>
              <Logo size={52} tagline="Master Your Academic Journey" themeColors={c} />
            </Animated.View>

            {step === 1 && <SegmentedPill active="register" onSelect={(k) => k === 'login' && router.replace('/(auth)/login')} />}

            <View style={{ flexDirection: 'row', gap: 6, marginVertical: spacing.lg }}>
              {[1, 2, 3].map((s) => (
                <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: s <= step ? c.primary : c.border }} />
              ))}
            </View>

            {step === 1 && (
              <Animated.View entering={FadeIn.duration(250)}>
                <Pressable
                  onPress={handleGoogleSignup}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, marginBottom: spacing.md }}
                >
                  <Text style={{ color: c.text, fontWeight: '600', fontSize: 15 }}>Continue with Google</Text>
                </Pressable>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
                  <Text style={{ color: c.textFaint, fontSize: 12, marginHorizontal: spacing.sm }}>OR REGISTER WITH EMAIL</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
                </View>

                <Input label="Full Name" value={fullName} onChangeText={setFullName} themeColors={c} leftIcon={<User size={16} color={c.textFaint} />} />
                <Input label="Matric Number" autoCapitalize="characters" value={matric} onChangeText={setMatric} themeColors={c} />

                <View style={{ marginBottom: spacing.md }}>
                  <Text style={{ color: c.textMuted, fontSize: 13, marginBottom: 6, fontWeight: '500' }}>University Email</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Input placeholder="name@university.edu.ng" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={(v) => { setEmail(v); setCodeSent(false); }} themeColors={c} leftIcon={<Mail size={16} color={c.textFaint} />} style={{ marginBottom: 0 }} />
                    </View>
                    <Pressable
                      onPress={handleGetCode}
                      disabled={sendingCode || cooldown > 0}
                      style={{ paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: cooldown > 0 ? c.overlay : c.primaryDim, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.primary, opacity: sendingCode || cooldown > 0 ? 0.6 : 1 }}
                    >
                      <Text style={{ color: c.primary, fontWeight: '700', fontSize: 12 }}>
                        {cooldown > 0 ? `${cooldown}s` : codeSent ? 'Resend' : 'Get Code'}
                      </Text>
                    </Pressable>
                  </View>
                  {codeSent && (
                    <Animated.View entering={FadeIn.duration(200)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                      <Check size={12} color={c.success} />
                      <Text style={{ color: c.success, fontSize: 11 }}>Code sent — check your inbox</Text>
                    </Animated.View>
                  )}
                </View>

                <Input
                  label="Password" secureTextEntry={!showPassword} value={password} onChangeText={setPassword}
                  themeColors={c} leftIcon={<Lock size={16} color={c.textFaint} />}
                  rightElement={<Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>{showPassword ? <EyeOff size={17} color={c.textFaint} /> : <Eye size={17} color={c.textFaint} />}</Pressable>}
                />
                <Input
                  label="Confirm Password" secureTextEntry={!showConfirm} value={confirmPassword} onChangeText={setConfirmPassword}
                  themeColors={c} leftIcon={<Lock size={16} color={c.textFaint} />}
                  rightElement={<Pressable onPress={() => setShowConfirm((v) => !v)} hitSlop={8}>{showConfirm ? <EyeOff size={17} color={c.textFaint} /> : <Eye size={17} color={c.textFaint} />}</Pressable>}
                />
                <Input
                  label="Verification Code" placeholder="6-digit code" keyboardType="number-pad" maxLength={6}
                  value={otp} onChangeText={setOtp} themeColors={c} leftIcon={<KeyRound size={16} color={c.textFaint} />}
                  editable={codeSent}
                />

                {error && <Text style={{ color: c.danger, marginBottom: spacing.md, fontSize: 13 }}>{error}</Text>}
                <Button label="Create Account" onPress={handleSubmitStep1} loading={loading} fullWidth />
              </Animated.View>
            )}

            {step === 2 && (
              <Animated.View entering={FadeIn.duration(250)}>
                <Text style={{ color: c.text, fontSize: 20, fontWeight: '700', marginBottom: spacing.md }}>Academic details</Text>
                <PickerField label="University" value={form.university ?? ''} onChange={(v) => update('university', v)} options={NIGERIAN_UNIVERSITIES} />
                <PickerField label="Department" value={form.department ?? ''} onChange={(v) => update('department', v)} options={ACADEMIC_DEPARTMENTS} placeholder="e.g. Computer Science" />
                <PickerField label="Programme" value={form.programme ?? ''} onChange={(v) => update('programme', v)} options={ACADEMIC_PROGRAMMES} placeholder="e.g. B.Sc Computer Science" />

                <View style={{ marginBottom: spacing.md }}>
                  <Text style={{ color: c.textMuted, fontSize: 13, marginBottom: 8 }}>Course duration (years)</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {COURSE_DURATION_OPTIONS.map((d) => (
                      <Pressable key={d} onPress={() => update('courseDuration', d)} style={{ minWidth: '29%', flexGrow: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: form.courseDuration === d ? c.primary : c.border, backgroundColor: form.courseDuration === d ? c.primaryDim : c.surface }}>
                        <Text style={{ color: form.courseDuration === d ? c.primary : c.textMuted, fontWeight: '600', fontSize: 13 }}>{d} yrs</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <Input label="Entry year/session" placeholder="e.g. 2022/2023" value={form.currentSession ?? ''} onChangeText={(v) => update('currentSession', formatSessionInput(v))} keyboardType="number-pad" maxLength={9} themeColors={c} />

                {parseAcademicSession(form.currentSession) != null && (
                  <Animated.View entering={FadeIn.duration(180)} style={{ backgroundColor: c.primaryDim, borderWidth: 1, borderColor: `${c.primary}45`, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
                    <Text style={{ color: c.text, fontSize: 13, fontWeight: '800' }}>Academic timeline</Text>
                    <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
                      {form.courseDuration ?? 4} academic years · {form.currentSession} to {graduationSession(form.currentSession ?? '', form.courseDuration ?? 4)} · {(form.courseDuration ?? 4) * 2} semester slots
                    </Text>
                  </Animated.View>
                )}

                <View style={{ marginBottom: spacing.md }}>
                  <Text style={{ color: c.textMuted, fontSize: 13, marginBottom: 8 }}>Current level</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {levels.map((l) => (
                      <Pressable key={l} onPress={() => update('currentLevel', l)} style={{ height: 36, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: form.currentLevel === l ? c.primary : c.border, backgroundColor: form.currentLevel === l ? c.primaryDim : c.surface }}>
                        <Text style={{ color: form.currentLevel === l ? c.primary : c.textMuted, fontWeight: '600', fontSize: 12 }}>{l}L</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {error && <Text style={{ color: c.danger, marginBottom: spacing.md }}>{error}</Text>}
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  {authMethod === 'email' && <Button label="Back" variant="secondary" onPress={() => setStep(1)} />}
                  <View style={{ flex: 1 }}><Button label="Continue" onPress={handleContinueStep2} fullWidth /></View>
                </View>
              </Animated.View>
            )}

            {step === 3 && (
              <Animated.View entering={FadeIn.duration(250)}>
                <Text style={{ color: c.text, fontSize: 20, fontWeight: '700', marginBottom: spacing.md }}>How do you want to track?</Text>
                <Pressable onPress={() => update('recordMode', 'fromScratch')} style={{ borderRadius: 16, padding: spacing.lg, borderWidth: 2, marginBottom: spacing.md, borderColor: form.recordMode === 'fromScratch' ? c.primary : c.border, backgroundColor: form.recordMode === 'fromScratch' ? c.primaryDim : c.surface }}>
                  <Text style={{ color: c.text, fontWeight: '700', marginBottom: 4 }}>From Scratch</Text>
                  <Text style={{ color: c.textMuted, fontSize: 13 }}>Start fresh — enter results as you go.</Text>
                </Pressable>
                <Pressable onPress={() => update('recordMode', 'complete')} style={{ borderRadius: 16, padding: spacing.lg, borderWidth: 2, marginBottom: spacing.lg, borderColor: form.recordMode === 'complete' ? c.gold : c.border, backgroundColor: form.recordMode === 'complete' ? c.goldDim : c.surface }}>
                  <Text style={{ color: c.text, fontWeight: '700', marginBottom: 4 }}>Complete Record</Text>
                  <Text style={{ color: c.textMuted, fontSize: 13 }}>I have past results to enter to build my CGPA.</Text>
                </Pressable>

                {error && <Text style={{ color: c.danger, marginBottom: spacing.md }}>{error}</Text>}
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <Button label="Back" variant="secondary" onPress={() => setStep(2)} />
                  <View style={{ flex: 1 }}><Button label="Create Account" onPress={handleFinish} loading={loading} fullWidth /></View>
                </View>
              </Animated.View>
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}
