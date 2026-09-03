import { Redirect } from 'expo-router';
import { useAuthStore } from '@/lib/store/authStore';

/**
 * Root index route — matches the bare "/" URL (`acadegrade:///`).
 *
 * Found via independent user analysis, confirmed working: without this
 * file, Expo Router has nothing to render for "/" on cold open and shows
 * "Unmatched Route" — the `_layout.tsx` useEffect redirect (see that file)
 * only fires *after* the first render, so the error screen flashed before
 * the redirect could execute. This file closes that gap by giving "/" a
 * valid match immediately:
 *
 *  • Not signed in            → /(auth)/welcome
 *  • Signed in, no onboarding → /(auth)/onboarding-tour
 *  • Signed in + onboarded    → /(tabs)/dashboard
 *
 * `_layout.tsx`'s useEffect still handles redirects when auth state
 * *changes* while the app is already open (sign in/out) — the two
 * mechanisms are complementary, not redundant.
 */
export default function Index() {
  const { firebaseUser, profile, isResolving } = useAuthStore();

  if (isResolving) return null;

  if (!firebaseUser) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (profile && !profile.mobileOnboardingCompleted) {
    return <Redirect href="/(auth)/onboarding-tour" />;
  }

  if (profile) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  // A Firebase account without its student profile means setup was interrupted
  // or profile storage failed. Resume the wizard rather than returning them to
  // the welcome screen with no route back to completion.
  return <Redirect href="/(auth)/register" />;
}
