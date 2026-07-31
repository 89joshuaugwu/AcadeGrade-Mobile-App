import { Redirect } from 'expo-router';
import { useAuthStore } from '@/lib/store/authStore';

/**
 * Root index route — matches the bare "/" URL (`acadegrade:///`).
 *
 * Without this file, Expo Router has nothing to render for "/" and shows
 * "Unmatched Route". This component reads auth state and immediately
 * redirects to the correct route group:
 *
 *  • Not signed in           → /(auth)/welcome
 *  • Signed in, no onboarding → /(auth)/onboarding-tour
 *  • Signed in + onboarded   → /(tabs)/dashboard
 *
 * The root _layout.tsx useEffect also handles redirects on auth changes,
 * but this file ensures the FIRST render already has a valid route instead
 * of flashing "Unmatched Route" during the useEffect gap.
 */
export default function Index() {
  const { firebaseUser, profile } = useAuthStore();

  if (!firebaseUser) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (profile && !profile.mobileOnboardingCompleted) {
    return <Redirect href="/(auth)/onboarding-tour" />;
  }

  if (profile) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  // Auth is still resolving (firebaseUser exists but profile hasn't loaded yet).
  // The root _layout.tsx holds the splash screen until ready, so this case
  // is rarely hit — but default to welcome as a safe fallback.
  return <Redirect href="/(auth)/welcome" />;
}
