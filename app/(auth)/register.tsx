import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import firestore from '@react-native-firebase/firestore';
import { User, Mail, Lock, Eye, EyeOff, KeyRound, Check } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInLeft, FadeInRight, FadeOutLeft, FadeOutRight } from 'react-native-reanimated';
import { spacing, radius } from '@/constants/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { PickerField } from '@/components/ui/PickerField';
import { GoogleIcon } from '@/components/ui/GoogleIcon';
import { SegmentedPill } from './login';
import { getGoogleSignInErrorMessage, signOut, signUpWithEmail, signInWithGoogle } from '@/lib/firebase/auth';
import { db, firebaseAuth } from '@/lib/firebase/client';
import { useAuthStore } from '@/lib/store/authStore';
import { authApi } from '@/lib/api/client';
import { NIGERIAN_UNIVERSITIES, ACADEMIC_DEPARTMENTS, ACADEMIC_PROGRAMMES } from '@/lib/data/academic-data';
import type { RegisterFormData, StudentLevel } from '@/types/user';
import { useThemeColors } from '@/lib/store/themeStore';
import { COURSE_DURATION_OPTIONS, formatSessionInput, graduationSession, inferCurrentLevel, parseAcademicSession } from '@/lib/academic/timeline';
import { USAGE_TOUR_VERSION } from '@/lib/tour/chapters';
import { useToastStore } from '@/lib/store/toastStore';
import { isStudentProfileComplete } from '@/lib/auth/profileCompletion';

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
  const showToast = useToastStore((state) => state.show);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [stepDirection, setStepDirection] = useState<'forward' | 'backward'>('forward');
  const registrationScrollRef = useRef<ScrollView>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');
  const [pendingAccountUid, setPendingAccountUid] = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [googleAccountEmail, setGoogleAccountEmail] = useState<string | null>(null);

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

  /**
   * Keep the wizard feeling like one continuous journey: forward steps enter
   * from the right, Back brings the prior step back from the left, and every
   * phase starts at its heading instead of preserving a lower scroll offset.
   */
  function moveToStep(nextStep: 1 | 2 | 3) {
    if (nextStep === step) return;
    setStepDirection(nextStep > step ? 'forward' : 'backward');
    registrationScrollRef.current?.scrollTo({ y: 0, animated: false });
    setStep(nextStep);
  }

  function handleEmailChange(value: string) {
    const changed = value.trim().toLowerCase() !== email.trim().toLowerCase();
    setEmail(value);
    if (changed) {
      setOtp('');
      setCodeSent(false);
      setVerifiedEmail(null);
      setCooldown(0);
    }
  }

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

  // Recover an interrupted Google registration without treating the verified
  // identity as an email/password account.
  useEffect(() => {
    if (!firebaseUser || pendingAccountUid || step !== 1) return;
    const signedInWithGoogle = firebaseUser.providerData.some((provider) => provider.providerId === 'google.com');
    if (!signedInWithGoogle) return;
    const accountEmail = firebaseUser.email?.trim().toLowerCase() ?? null;
    setAuthMethod('google');
    setPendingAccountUid(firebaseUser.uid);
    setGoogleAccountEmail(accountEmail);
    if (accountEmail) setEmail(accountEmail);
    if (firebaseUser.displayName) setFullName(firebaseUser.displayName);
  }, [firebaseUser, pendingAccountUid, step]);

  async function handleGetCode() {
    setError(null);
    if (!email || !email.includes('@')) return setError('Enter a valid email first');
    setSendingCode(true);
    try {
      await authApi.sendOtp(email.trim().toLowerCase(), 'registration');
      setCodeSent(true);
      setVerifiedEmail(null);
      setCooldown(60);
      showToast({ type: 'success', title: 'Verification code sent', message: 'Check your inbox, then enter the code below.' });
    } catch (e: any) {
      const message = e.message ?? 'Could not send verification code';
      setError(message);
      showToast({ type: 'error', title: 'Could not send code', message });
    } finally {
      setSendingCode(false);
    }
  }

  async function handleGoogleSignup() {
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithGoogle();
      const existingProfile = await db.collection('users').doc(cred.user.uid).get();
      const existingProfileData = existingProfile.data();
      if (existingProfile.exists() && isStudentProfileComplete(existingProfileData)) {
        const completedOnMobile = existingProfileData.mobileOnboardingCompleted;
        showToast({
          type: 'info',
          title: 'Account already exists',
          message: completedOnMobile ? 'Signing you in to your dashboard.' : 'Let’s complete a quick app introduction.',
        });
        router.replace(completedOnMobile ? '/(tabs)/dashboard' : '/(auth)/onboarding-tour');
        return;
      }

      const accountEmail = cred.user.email?.trim().toLowerCase() ?? null;
      setAuthMethod('google');
      setPendingAccountUid(cred.user.uid);
      setGoogleAccountEmail(accountEmail);
      if (accountEmail) setEmail(accountEmail);
      if (cred.user.displayName) setFullName(cred.user.displayName);
      setOtp('');
      setCodeSent(false);
      setVerifiedEmail(null);
      showToast({ type: 'success', title: 'Google account verified', message: 'Confirm your name and add your matric number to continue.' });
    } catch (e: any) {
      const message = getGoogleSignInErrorMessage(e);
      if (message) {
        setError(message);
        showToast({ type: 'error', title: 'Google sign-up failed', message });
      }
    } finally {
      setLoading(false);
    }
  }

  async function useDifferentGoogleAccount() {
    setLoading(true);
    setError(null);
    try {
      await signOut();
      setAuthMethod('email');
      setPendingAccountUid(null);
      setGoogleAccountEmail(null);
      setFullName('');
      setMatric('');
      handleEmailChange('');
      showToast({ type: 'info', title: 'Choose another account', message: 'Continue with Google again to select a different account.' });
    } catch (error: any) {
      showToast({ type: 'error', title: 'Could not switch Google account', message: error?.message ?? 'Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitStep1() {
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!fullName.trim() || !matric.trim() || !normalizedEmail.includes('@')) return setError('Fill in all required fields');

    if (authMethod === 'google') {
      if (!pendingAccountUid && !firebaseAuth.currentUser?.uid) return setError('Your Google session expired. Please choose your Google account again.');
      moveToStep(2);
      return;
    }

    if (!password || password.length < 6) return setError('Password must be at least 6 characters');
    if (password !== confirmPassword) return setError('Passwords do not match');
    if (verifiedEmail === normalizedEmail) {
      moveToStep(2);
      return;
    }
    if (!codeSent) return setError('Tap "Get Code" to receive your verification code first');
    if (otp.length < 4) return setError('Enter the verification code sent to your email');

    setLoading(true);
    try {
      await authApi.verifyOtp(normalizedEmail, otp, 'registration');
      setVerifiedEmail(normalizedEmail);
      moveToStep(2);
      showToast({ type: 'success', title: 'Email verified', message: 'Now add your academic details.' });
    } catch (e: any) {
      const message = e.message ?? 'Invalid or expired code';
      setError(message);
      showToast({ type: 'error', title: 'Could not verify code', message });
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
    moveToStep(3);
  }

  async function handleFinish() {
    setError(null);
    setLoading(true);
    try {
      let uid: string;
      const normalizedEmail = email.trim().toLowerCase();
      if (authMethod === 'google') {
        const recoveredUid = pendingAccountUid ?? firebaseAuth.currentUser?.uid;
        if (recoveredUid) {
          uid = recoveredUid;
        } else {
        if (!firebaseUser) throw new Error('Google session expired — please sign in again');
        uid = firebaseUser.uid;
        }
      } else {
        const currentUser = firebaseAuth.currentUser;
        if (currentUser?.email?.trim().toLowerCase() === normalizedEmail) {
          uid = currentUser.uid;
        } else {
          const cred = await signUpWithEmail(normalizedEmail, password);
          uid = cred.user.uid;
        }
        setPendingAccountUid(uid);
      }

      await db.collection('users').doc(uid).set({
        fullName: fullName.trim(), email: normalizedEmail, matric: matric.trim(),
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
        mobileUsageTourVersion: USAGE_TOUR_VERSION, mobileUsageTourCompletedChapters: [],
        mobileUsageTourSkipped: false, mobileUsageTourCompleted: false,
        createdAt: firestore.FieldValue.serverTimestamp(), updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      setPendingAccountUid(null);
      showToast({ type: 'success', title: 'Account created', message: 'Welcome to AcadeGrade.' });
    } catch (e: any) {
      const message = e.message ?? 'Failed to create your account';
      setError(message);
      showToast({ type: 'error', title: 'Could not create account', message });
    } finally {
      setLoading(false);
    }
  }

  const levels = Array.from({ length: form.courseDuration ?? 4 }, (_, i) => (i + 1) * 100);

  return (
    <View style={{ flex: 1, backgroundColor: c.void }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView
            ref={registrationScrollRef}
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View entering={FadeInDown.duration(300)} style={{ alignItems: 'center', marginBottom: spacing.lg }}>
              <Logo size={52} tagline="Master Your Academic Journey" themeColors={c} />
            </Animated.View>

            {step === 1 && authMethod === 'email' && <SegmentedPill active="register" onSelect={(k) => k === 'login' && router.replace('/(auth)/login')} />}

            <View style={{ flexDirection: 'row', gap: 6, marginVertical: spacing.lg }}>
              {[1, 2, 3].map((s) => (
                <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: s <= step ? c.primary : c.border }} />
              ))}
            </View>

            {step === 1 && (
              <Animated.View
                key="registration-step-1"
                entering={stepDirection === 'forward' ? FadeInRight.duration(240) : FadeInLeft.duration(240)}
                exiting={stepDirection === 'forward' ? FadeOutLeft.duration(150) : FadeOutRight.duration(150)}
              >
                {authMethod === 'email' && <Pressable
                  onPress={handleGoogleSignup}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, marginBottom: spacing.md }}
                >
                  <GoogleIcon size={18} />
                  <Text style={{ color: c.text, fontWeight: '600', fontSize: 15 }}>Continue with Google</Text>
                </Pressable>}
                {authMethod === 'email' && <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
                  <Text style={{ color: c.textFaint, fontSize: 12, marginHorizontal: spacing.sm }}>OR REGISTER WITH EMAIL</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
                </View>}

                {authMethod === 'google' && (
                  <Animated.View entering={FadeIn.duration(180)} style={{ backgroundColor: c.successDim, borderWidth: 1, borderColor: `${c.success}55`, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Check size={16} color={c.success} />
                      <Text style={{ color: c.text, fontWeight: '800', fontSize: 13 }}>Google account verified</Text>
                    </View>
                    <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 17, marginTop: 5 }}>Confirm these details and add your matric number. Your verified Google email will be saved to your profile.</Text>
                    <Pressable onPress={useDifferentGoogleAccount} disabled={loading} style={{ alignSelf: 'flex-start', marginTop: 10 }}>
                      <Text style={{ color: c.primary, fontWeight: '800', fontSize: 12 }}>Use a different Google account</Text>
                    </Pressable>
                  </Animated.View>
                )}

                <Input label="Full Name" value={fullName} onChangeText={setFullName} themeColors={c} leftIcon={<User size={16} color={c.textFaint} />} />
                <Input label="Matric Number" autoCapitalize="characters" value={matric} onChangeText={setMatric} themeColors={c} />

                <View style={{ marginBottom: spacing.md }}>
                  <Text style={{ color: c.textMuted, fontSize: 13, marginBottom: 6, fontWeight: '500' }}>
                    {authMethod === 'google' && googleAccountEmail ? 'Google Account Email' : 'University Email'}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        placeholder="name@university.edu.ng"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={handleEmailChange}
                        editable={authMethod !== 'google' || !googleAccountEmail}
                        themeColors={c}
                        leftIcon={<Mail size={16} color={c.textFaint} />}
                        style={{ marginBottom: 0, opacity: authMethod === 'google' && googleAccountEmail ? 0.7 : 1 }}
                      />
                    </View>
                    {authMethod === 'email' && <Pressable
                      onPress={handleGetCode}
                      disabled={sendingCode || cooldown > 0}
                      style={{
                        height: 48, // Matches standard input heights
                        minWidth: 85, // Keeps the button width consistent
                        alignSelf: 'flex-start', // Pins to the top so it aligns with the input, not the label/errors
                        paddingHorizontal: 12,
                        borderRadius: radius.md,
                        backgroundColor: cooldown > 0 ? c.overlay : c.primaryDim,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: c.primary,
                        opacity: sendingCode || cooldown > 0 ? 0.6 : 1,
                      }}
                    >
                      <Text 
                        numberOfLines={1} 
                        adjustsFontSizeToFit={true} 
                        minimumFontScale={0.7} // Allows the font to shrink up to 70% of its original size
                        style={{ 
                          color: c.primary, 
                          fontWeight: '700', 
                          fontSize: 13, 
                          textAlign: 'center' 
                        }}
                      >
                        {cooldown > 0 ? `Wait ${cooldown}s` : codeSent ? 'Resend' : 'Get Code'}
                      </Text>
                    </Pressable>}
                  </View>
                  {authMethod === 'email' && codeSent && (
                    <Animated.View entering={FadeIn.duration(200)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                      <Check size={12} color={c.success} />
                      <Text style={{ color: c.success, fontSize: 11 }}>Code sent — check your inbox</Text>
                    </Animated.View>
                  )}
                </View>

                {authMethod === 'email' && <>
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
                </>}

                {error && <Text style={{ color: c.danger, marginBottom: spacing.md, fontSize: 13 }}>{error}</Text>}
                <Button label={authMethod === 'google' ? 'Continue' : 'Create Account'} onPress={handleSubmitStep1} loading={loading} fullWidth />
              </Animated.View>
            )}

            {step === 2 && (
              <Animated.View
                key="registration-step-2"
                entering={stepDirection === 'forward' ? FadeInRight.duration(240) : FadeInLeft.duration(240)}
                exiting={stepDirection === 'forward' ? FadeOutLeft.duration(150) : FadeOutRight.duration(150)}
              >
                <Text style={{ color: c.text, fontSize: 20, fontWeight: '700', marginBottom: spacing.md }}>Academic details</Text>
                <PickerField label="University" value={form.university ?? ''} onChange={(v) => update('university', v)} options={NIGERIAN_UNIVERSITIES} />
                <PickerField label="Department" value={form.department ?? ''} onChange={(v) => update('department', v)} options={ACADEMIC_DEPARTMENTS} placeholder="e.g. Computer Science" />
                <PickerField label="Programme" value={form.programme ?? ''} onChange={(v) => update('programme', v)} options={ACADEMIC_PROGRAMMES} placeholder="e.g. B.Sc Computer Science" />

                <View style={{ marginBottom: spacing.md }}>
                  <Text style={{ color: c.textMuted, fontSize: 13, marginBottom: 8 }}>Course duration (years)</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {COURSE_DURATION_OPTIONS.map((d) => (
                      <Pressable key={d} onPress={() => update('courseDuration', d)} style={{ flexBasis: '30%', flexGrow: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: form.courseDuration === d ? c.primary : c.border, backgroundColor: form.courseDuration === d ? c.primaryDim : c.surface }}>
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
                  <Button label="Back" variant="secondary" onPress={() => moveToStep(1)} />
                  <View style={{ flex: 1 }}><Button label="Continue" onPress={handleContinueStep2} fullWidth /></View>
                </View>
              </Animated.View>
            )}

            {step === 3 && (
              <Animated.View
                key="registration-step-3"
                entering={stepDirection === 'forward' ? FadeInRight.duration(240) : FadeInLeft.duration(240)}
                exiting={stepDirection === 'forward' ? FadeOutLeft.duration(150) : FadeOutRight.duration(150)}
              >
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
                  <Button label="Back" variant="secondary" onPress={() => moveToStep(2)} />
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
