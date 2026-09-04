import { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { spacing, radius } from '@/constants/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { GoogleIcon } from '@/components/ui/GoogleIcon';
import { getGoogleSignInErrorMessage, signInWithEmail, signInWithGoogle } from '@/lib/firebase/auth';
import { useThemeColors } from '@/lib/store/themeStore';
import { useToastStore } from '@/lib/store/toastStore';

/**
 * REBUILT to match the AuthPortal reference exactly: light theme, logo
 * badge + tagline, Login/Sign Up segmented pill (Sign Up navigates straight
 * to the register route rather than being a real second panel here),
 * icon-prefixed fields, password eye-toggle, single "Continue with Google"
 * — Apple sign-in from the reference is intentionally dropped per explicit
 * instruction (email/password + Google only). Auth handlers unchanged.
 */
export default function Login() {
  const c = useThemeColors();
  const router = useRouter();
  const showToast = useToastStore((state) => state.show);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    if (!email || !password) return setError('Enter your email and password');
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
      showToast({ type: 'success', title: 'Welcome back', message: 'Opening your academic dashboard.' });
    } catch (e: any) {
      const message = mapAuthError(e.code);
      setError(message);
      showToast({ type: 'error', title: 'Could not sign in', message });
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      showToast({ type: 'success', title: 'Welcome back', message: 'Opening your academic dashboard.' });
    } catch (e: any) {
      const message = getGoogleSignInErrorMessage(e);
      if (message) {
        setError(message);
        showToast({ type: 'error', title: 'Google sign-in failed', message });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.void }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl, flexGrow: 1, justifyContent: 'center' }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View entering={FadeInDown.duration(350)} style={{ alignItems: 'center', marginBottom: spacing.xl }}>
              <Logo size={56} tagline="Master Your Academic Journey" themeColors={c} />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(80).duration(350)}>
              <SegmentedPill active="login" onSelect={(k) => k === 'register' && router.push('/(auth)/register')} />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(140).duration(350)} style={{ marginTop: spacing.xl }}>
              <Input
                label="Email Address"
                placeholder="name@university.edu"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                themeColors={c}
                leftIcon={<Mail size={17} color={c.textFaint} />}
              />
              <Input
                label="Password"
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                themeColors={c}
                leftIcon={<Lock size={17} color={c.textFaint} />}
                rightElement={
                  <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                    {showPassword ? <EyeOff size={18} color={c.textFaint} /> : <Eye size={18} color={c.textFaint} />}
                  </Pressable>
                }
              />

              <Pressable onPress={() => router.push('/(auth)/forgot-password')} style={{ alignSelf: 'flex-end', marginBottom: spacing.lg }}>
                <Text style={{ color: c.primary, fontSize: 13, fontWeight: '600' }}>Forgot Password?</Text>
              </Pressable>

              {error && <Text style={{ color: c.danger, marginBottom: spacing.md, fontSize: 13 }}>{error}</Text>}

              <Button label="Sign In to Dashboard" onPress={handleLogin} loading={loading} fullWidth />

              <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg }}>
                <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
                <Text style={{ color: c.textFaint, fontSize: 12, marginHorizontal: spacing.sm }}>OR</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
              </View>

              <Pressable
                onPress={handleGoogle}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}
              >
                <GoogleIcon size={18} />
                <Text style={{ color: c.text, fontWeight: '600', fontSize: 15 }}>Continue with Google</Text>
              </Pressable>

              <Pressable onPress={() => router.push('/(auth)/register')} style={{ alignItems: 'center', marginTop: spacing.xl }}>
                <Text style={{ color: c.textMuted, fontSize: 13 }}>
                  New to AcadeGrade? <Text style={{ color: c.primary, fontWeight: '700' }}>Create Account</Text>
                </Text>
              </Pressable>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

export function SegmentedPill({ active, onSelect }: { active: 'login' | 'register'; onSelect: (k: 'login' | 'register') => void }) {
  const c = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.overlay, borderRadius: radius.pill, padding: 4 }}>
      {(['login', 'register'] as const).map((key) => {
        const isActive = key === active;
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(key)}
            style={{ flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center', backgroundColor: isActive ? c.primaryHover : 'transparent' }}
          >
            <Text style={{ color: isActive ? '#FFFFFF' : c.textMuted, fontWeight: '700', fontSize: 14 }}>
              {key === 'login' ? 'Login' : 'Sign Up'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function mapAuthError(code?: string): string {
  switch (code) {
    case 'auth/invalid-email': return 'That email address looks invalid.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Incorrect email or password.';
    case 'auth/too-many-requests': return 'Too many attempts. Try again later.';
    default: return 'Sign-in failed. Please try again.';
  }
}
