import { Stack } from 'expo-router';

/**
 * FIX: this file was missing entirely. Without it, `results/new.tsx` and
 * `results/[semesterId].tsx` aren't registered as a nested stack under the
 * Results tab — Expo Router was treating them as loose routes, which is
 * why they appeared as extra destinations in the tab bar instead of being
 * pushed on top of the Results list (same bug class as the earlier missing
 * `app/(auth)/_layout.tsx`). This ensures `index` is the only screen the
 * tab bar itself shows for Results, with `new` and `[semesterId]` pushed
 * on top as a native stack.
 */
export default function ResultsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="new" />
      <Stack.Screen name="[semesterId]" />
    </Stack>
  );
}
