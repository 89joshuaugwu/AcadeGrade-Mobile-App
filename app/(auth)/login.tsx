import { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { colors, spacing, APP_NAME } from '@/constants/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { signInWithEmail, signInWithGoogle } from '@/lib/firebase/auth';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    if (!email || !password) return setError('Enter your email and password');
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
      // _layout.tsx's auth listener handles navigation once profile resolves
    } catch (e: any) {
      setError(mapAuthError(e.code));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      setError('Google sign-in failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, flexGrow: 1, justifyContent: 'center' }}>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 4 }}>Welcome back</Text>
          <Text style={{ color: colors.textMuted, fontSize: 15, marginBottom: spacing.xl }}>
            Sign in to {APP_NAME}
          </Text>

          <Input
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
          />
          <Input
            label="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
          />

          {error && (
            <Text style={{ color: colors.danger, marginBottom: spacing.md, fontSize: 13 }}>{error}</Text>
          )}

          <Link href="/(auth)/forgot-password" asChild>
            <Text style={{ color: colors.primaryGlow, fontSize: 13, marginBottom: spacing.lg, alignSelf: 'flex-end' }}>
              Forgot password?
            </Text>
          </Link>

          <Button label="Sign In" onPress={handleLogin} loading={loading} fullWidth />
          <View style={{ height: spacing.md }} />
          <Button label="Continue with Google" variant="secondary" onPress={handleGoogle} fullWidth />

          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl }}>
            <Text style={{ color: colors.textMuted }}>Don't have an account? </Text>
            <Link href="/(auth)/register">
              <Text style={{ color: colors.primaryGlow, fontWeight: '600' }}>Sign up</Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
