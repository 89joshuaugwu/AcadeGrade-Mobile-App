import { Redirect } from 'expo-router';

/**
 * Dummy screen — the "More" tab's `tabPress` is always intercepted in
 * `_layout.tsx` to open the bottom sheet instead of navigating here.
 * This only renders as a defensive fallback if that interception is ever
 * bypassed (e.g. programmatic navigation), so it isn't a dead end.
 */
export default function More() {
  return <Redirect href="/(tabs)/dashboard" />;
}
