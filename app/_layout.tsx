import 'react-native-gesture-handler';
import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { onAuthStateChange, configureGoogleSignIn } from '@/lib/firebase/auth';
import { db } from '@/lib/firebase/client';
import { getInitialNotificationRoute, onForegroundMessage, onNotificationOpened, onTokenRefresh, registerFcmToken } from '@/lib/firebase/fcm';
import { useAuthStore } from '@/lib/store/authStore';
import { useResolvedThemeMode, useThemeColors, useThemeStore } from '@/lib/store/themeStore';
import { RootErrorBoundary } from '@/components/RootErrorBoundary';
import { ToastHost } from '@/components/ui/ToastHost';
import { ConfirmDialogHost } from '@/components/ui/ConfirmDialogHost';
import { UsageTourHost } from '@/components/tour/UsageTourHost';
import { useToastStore } from '@/lib/store/toastStore';
import type { UserWithId } from '@/types/user';

import '../global.css';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/** If auth state genuinely never resolves (bad config, no network, native module issue), don't hang forever — surface it instead of a silent infinite splash. */
const READY_SAFETY_TIMEOUT_MS = 12000;

/**
 * Splash → authed-state resolution with NO FLASH of the wrong screen
 * (03_BUILD_PROMPT.md stage 2 requirement): we don't render any route group
 * until both Firebase auth state AND the Firestore profile doc have
 * resolved at least once.
 *
 * FIXED (was the reported "stuck on splash logo forever" bug): the actual
 * crash was `GoogleSignin.configure()` running at raw module-import time in
 * lib/firebase/auth.ts with an undefined webClientId (EAS cloud builds don't
 * see a local .env.local unless it's registered with EAS), which killed the
 * JS thread before this component ever mounted — invisible in a non-dev
 * build profile. That call is now deferred into `configureGoogleSignIn()`,
 * invoked here defensively. Also added: a root Error Boundary so any FUTURE
 * render-time error is visible instead of another silent hang, and a
 * `READY_SAFETY_TIMEOUT_MS` safety net so a stuck auth listener surfaces a
 * message instead of hanging forever.
 */
export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const router = useRouter();
  const segments = useSegments();
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const initialNotificationHandled = useRef(false);

  const { firebaseUser, profile, isResolving, setFirebaseUser, setProfile, setResolving } = useAuthStore();
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const themeHydrated = useThemeStore((s) => s.hydrated);
  const resolvedTheme = useResolvedThemeMode();
  const themeColors = useThemeColors();
  const showToast = useToastStore((s) => s.show);

  useEffect(() => {
    hydrateTheme();
  }, [hydrateTheme]);

  useEffect(() => onForegroundMessage((title, body) => {
    showToast({ type: 'info', title, message: body, duration: 5000 });
  }), [showToast]);

  // Background/quit notifications are presented by Android. Once the app is
  // authenticated and ready, use the server payload to open the relevant
  // screen instead of merely landing on the dashboard.
  useEffect(() => {
    if (!ready || !themeHydrated || !firebaseUser || !profile?.mobileOnboardingCompleted) return;

    const unsubscribe = onNotificationOpened((route) => router.push(route as any));
    if (!initialNotificationHandled.current) {
      initialNotificationHandled.current = true;
      getInitialNotificationRoute()
        .then((route) => { if (route) router.push(route as any); })
        .catch((error) => console.warn('[AcadeGrade] Initial notification lookup failed:', error));
    }
    return unsubscribe;
  }, [firebaseUser, profile?.mobileOnboardingCompleted, ready, router, themeHydrated]);

  useEffect(() => {
    console.log('[AcadeGrade] Root layout mounted (attempt', retryKey + 1, '), configuring Google Sign-In...');
    configureGoogleSignIn();

    safetyTimer.current = setTimeout(() => {
      console.warn('[AcadeGrade] Auth state never resolved within', READY_SAFETY_TIMEOUT_MS, 'ms — forcing splash to hide.');
      setTimedOut(true);
      setReady(true);
    }, READY_SAFETY_TIMEOUT_MS);

    let unsubDoc: (() => void) | undefined;
    let unsubToken: (() => void) | undefined;

    console.log('[AcadeGrade] Subscribing to onAuthStateChange...');
    const unsubAuth = onAuthStateChange(async (user) => {
      console.log('[AcadeGrade] onAuthStateChange fired. user:', user?.uid ?? null);
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
      // A returning user may still have a real profile snapshot in flight.
      // Keep navigation stable until Firestore confirms whether it exists.
      setResolving(true);
      setFirebaseUser(user);

      if (user) {
        unsubDoc = db.collection('users').doc(user.uid).onSnapshot(
          (snap) => {
            if (snap.exists()) {
              setProfile({ uid: user.uid, ...(snap.data() as any) } as UserWithId);
            } else {
              setProfile(null);
            }
            setResolving(false);
            setReady(true);
          },
          (err) => {
            console.error('[AcadeGrade] users/{uid} snapshot error:', err);
            setResolving(false);
            setReady(true);
          }
        );
        registerFcmToken(user.uid).catch((err) => console.warn('[AcadeGrade] registerFcmToken failed:', err));
        unsubToken?.();
        unsubToken = onTokenRefresh(user.uid);
      } else {
        if (unsubDoc) unsubDoc();
        if (unsubToken) unsubToken();
        setProfile(null);
        setResolving(false);
        setReady(true);
      }
    });

    return () => {
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
      unsubAuth();
      if (unsubDoc) unsubDoc();
      if (unsubToken) unsubToken();
    };
  }, [retryKey, setFirebaseUser, setProfile, setResolving]);

  const onLayoutRootView = useCallback(async () => {
    if (ready) await SplashScreen.hideAsync();
  }, [ready]);

  useEffect(() => {
    if (!ready || !themeHydrated || timedOut || isResolving) return;
    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';

    // FIX: the previous version only redirected an authenticated+onboarded
    // user to the dashboard if `inAuthGroup` was already true — never the
    // case on a cold app open, where `segments` is empty at the bare root
    // ("acadegrade:///"). That left the app on Expo Router's "Unmatched
    // Route" screen forever, with no error, matching the exact bug report:
    // "after the logo screen it just shows this [Unmatched Route] then I
    // have to click on one of pages." Now driven by target state instead
    // of current segment, so it redirects correctly however the app opens.
    if (!firebaseUser) {
      if (!inAuthGroup) router.replace('/(auth)/welcome');
    } else if (!profile) {
      // Firebase authentication succeeded but profile setup was interrupted or
      // Firestore was temporarily unavailable. Resume registration instead of
      // leaving a valid account on a blank or unrelated route.
      if (segments[1] !== 'register') router.replace('/(auth)/register');
    } else if (profile && !profile.mobileOnboardingCompleted) {
      if (segments[1] !== 'onboarding-tour') router.replace('/(auth)/onboarding-tour');
    } else if (profile) {
      if (!inTabsGroup) router.replace('/(tabs)/dashboard');
    }
  }, [ready, themeHydrated, timedOut, isResolving, firebaseUser, profile, router, segments]);

  if (!ready || !themeHydrated) return null;

  if (timedOut) {
    return (
      <View style={{ flex: 1, backgroundColor: themeColors.void, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text style={{ color: themeColors.text, fontSize: 18, fontWeight: '700', marginBottom: 10, textAlign: 'center' }}>
          Taking longer than expected
        </Text>
        <Text style={{ color: themeColors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 }}>
          Couldn't confirm your sign-in status. Check your connection, or this may be a Firebase
          configuration issue — see the console/logcat output for details.
        </Text>
        <Pressable
          onPress={() => {
            setTimedOut(false);
            setReady(false);
            setRetryKey((k) => k + 1);
          }}
          style={{ backgroundColor: themeColors.primaryHover, borderRadius: 12, height: 48, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <RootErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: themeColors.void }} onLayout={onLayoutRootView}>
        <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
        <BottomSheetModalProvider>
          <QueryClientProvider client={queryClient}>
            <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: themeColors.void } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
            </Stack>
            <UsageTourHost />
            <ConfirmDialogHost />
            <ToastHost />
          </QueryClientProvider>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </RootErrorBoundary>
  );
}
