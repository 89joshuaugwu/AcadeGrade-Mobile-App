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
