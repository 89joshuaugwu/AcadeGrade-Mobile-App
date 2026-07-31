# Fix: "Unmatched Route" on App Launch

**Date:** July 31, 2026  
**Issue:** App shows "Unmatched Route — Page could not be found" (`acadegrade:///`) on cold open instead of navigating to the Welcome or Dashboard screen.

---

## Root Cause

Expo Router is file-system-based. When the app launches, it opens the root URL `/` (`acadegrade:///`). There was **no `app/index.tsx`** file to match this route, so Expo Router had nothing to render and displayed its default "Unmatched Route" error screen.

The existing `app/_layout.tsx` had a `useEffect` that tried to redirect users via `router.replace(...)`, but the redirect fired **after** the first render — creating a race condition where the error screen appeared before the redirect could execute.

## Changes Made

### 1. Created `app/index.tsx` (NEW)

Entry-point file that matches the `/` route. Uses Expo Router's `<Redirect>` component to immediately navigate based on auth state:

- **Not signed in** → `/(auth)/welcome`
- **Signed in, onboarding incomplete** → `/(auth)/onboarding-tour`
- **Signed in + onboarded** → `/(tabs)/dashboard`

```diff
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
```

### 2. Updated `app/_layout.tsx`

Added `<Stack.Screen name="index" />` to the root Stack navigator so Expo Router registers the new `index` route.

```diff
  <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.void } }}>
+   <Stack.Screen name="index" />
    <Stack.Screen name="(auth)" />
    <Stack.Screen name="(tabs)" />
  </Stack>
```

## How It Works Now

| Scenario | Handler |
|----------|---------|
| Cold open (app launches at `/`) | `app/index.tsx` — `<Redirect>` fires instantly, no error flash |
| Auth state changes at runtime (sign in/out) | `_layout.tsx` useEffect — still watches auth and re-routes |

The two mechanisms complement each other without conflict.

## Testing

1. Run `npx expo start -c`
2. Open the app on device via the development build
3. App should navigate directly to Welcome (if signed out) or Dashboard (if signed in)
4. "Unmatched Route" screen should no longer appear
