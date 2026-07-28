import 'react-native-gesture-handler';
import { useEffect, useState, useCallback } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { colors } from '@/constants/theme';
import { onAuthStateChange } from '@/lib/firebase/auth';
import { db } from '@/lib/firebase/client';
import { registerFcmToken } from '@/lib/firebase/fcm';
import { useAuthStore } from '@/lib/store/authStore';
import type { UserWithId } from '@/types/user';

import '../global.css';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/**
 * Splash → authed-state resolution with NO FLASH of the wrong screen
 * (03_BUILD_PROMPT.md stage 2 requirement): we don't render any route group
 * until both Firebase auth state AND the Firestore profile doc have
 * resolved at least once.
 */
export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  const { firebaseUser, profile, setFirebaseUser, setProfile, setResolving } = useAuthStore();

  useEffect(() => {
    let unsubDoc: (() => void) | undefined;

    const unsubAuth = onAuthStateChange(async (user) => {
      setFirebaseUser(user);

      if (user) {
        unsubDoc = db.collection('users').doc(user.uid).onSnapshot((snap) => {
          if (snap.exists) {
            setProfile({ uid: user.uid, ...(snap.data() as any) } as UserWithId);
          }
          setResolving(false);
          setReady(true);
        });
        registerFcmToken(user.uid).catch(() => {});
      } else {
        if (unsubDoc) unsubDoc(); 
        setProfile(null);
        setResolving(false);
        setReady(true);
      }
    });

    return () => {
      unsubAuth();
      if (unsubDoc) unsubDoc(); 
    };
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (ready) await SplashScreen.hideAsync();
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!firebaseUser && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (firebaseUser && profile && !profile.mobileOnboardingCompleted && !inAuthGroup) {
      router.replace('/(auth)/onboarding-tour');
    } else if (firebaseUser && inAuthGroup && profile?.mobileOnboardingCompleted) {
      router.replace('/(tabs)/dashboard');
    }
  }, [ready, firebaseUser, profile, segments]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.void }} onLayout={onLayoutRootView}>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.void } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
