import { Stack } from 'expo-router';

/**
 * FIX: this file was entirely missing, which is why the app was landing on
 * "Unmatched Route" instead of the welcome screen. `app/_layout.tsx`
 * references `<Stack.Screen name="(auth)" />` and calls
 * `router.replace('/(auth)/welcome')`, but Expo Router only registers a
 * route-group folder as a real nested navigator if it has its own
 * `_layout.tsx` — without one, `(auth)` isn't a valid route at all, hence
 * "No route named '(auth)' exists in nested children" in the logs and the
 * screenshot landing on Unmatched Route. This mirrors the same pattern
 * `(tabs)/_layout.tsx` already uses.
 */
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      <Stack.Screen name="login" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="register" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="forgot-password" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="onboarding-tour" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
