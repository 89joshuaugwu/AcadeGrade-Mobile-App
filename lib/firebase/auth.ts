/**
 * Auth functions — same surface area as web lib/firebase/auth.ts, but backed
 * by @react-native-firebase/auth. Google sign-in CANNOT use signInWithPopup
 * on native (01_CONTEXT.md §7) — uses @react-native-google-signin instead,
 * then exchanges the native credential with Firebase.
 */
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { firebaseAuth } from './client';

/**
 * FIXED — was previously `GoogleSignin.configure({...})` called at raw
 * module-import time, before any component renders and before any error
 * boundary exists anywhere in the app. If `EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID`
 * is undefined (which it will be in an EAS cloud build unless that var was
 * explicitly registered with EAS — a LOCAL `.env.local` file is invisible to
 * `eas build`), this call could throw synchronously and kill the JS thread
 * before `app/_layout.tsx` ever mounts. In a non-dev-client build profile
 * (no red-screen overlay), that failure is completely silent — the native
 * splash screen, which is a separate native-level surface, simply never
 * receives the `SplashScreen.hideAsync()` call buried inside React logic
 * that never got to run. This is the most likely explanation for the
 * permanent splash hang.
 *
 * Now: deferred into a function, called once from `app/_layout.tsx` inside
 * a `useEffect` + try/catch, and guarded so a missing/blank client ID logs
 * a warning instead of throwing.
 */
export function configureGoogleSignIn() {
  const webClientId = process.env.EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID;
  if (!webClientId) {
    console.warn(
      '[AcadeGrade] EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID is not set — Google sign-in will not work. ' +
        'If this is an EAS build, a local .env.local file is NOT enough: register the var with ' +
        '`eas env:create` or the "env" block in eas.json, then rebuild.'
    );
    return;
  }
  try {
    GoogleSignin.configure({ webClientId });
  } catch (err) {
    console.error('[AcadeGrade] GoogleSignin.configure() failed:', err);
  }
}

export async function signInWithEmail(email: string, password: string) {
  return firebaseAuth.signInWithEmailAndPassword(email, password);
}

export async function signUpWithEmail(email: string, password: string) {
  return firebaseAuth.createUserWithEmailAndPassword(email, password);
}

export async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (response.type !== 'success' || !response.data.idToken) {
    throw new Error('Google sign-in was cancelled or did not return an ID token.');
  }
  const { idToken } = response.data;
  const googleCredential = auth.GoogleAuthProvider.credential(idToken);
  return firebaseAuth.signInWithCredential(googleCredential);
}

export async function reauthenticateWithGoogle() {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('No authenticated user');
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (response.type !== 'success' || !response.data.idToken) {
    throw new Error('Google re-authentication was cancelled.');
  }
  return user.reauthenticateWithCredential(auth.GoogleAuthProvider.credential(response.data.idToken));
}

export async function reauthenticateWithPassword(password: string) {
  const user = firebaseAuth.currentUser;
  if (!user?.email) throw new Error('No email sign-in is linked to this account');
  return user.reauthenticateWithCredential(auth.EmailAuthProvider.credential(user.email, password));
}

export async function signOut() {
  try {
    await GoogleSignin.signOut();
  } catch {
    // no-op — user may not have signed in via Google
  }
  return firebaseAuth.signOut();
}

export async function resetPassword(email: string) {
  return firebaseAuth.sendPasswordResetEmail(email);
}

export async function changePassword(newPassword: string) {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('No authenticated user');
  return user.updatePassword(newPassword);
}

export function onAuthStateChange(callback: (user: FirebaseAuthTypes.User | null) => void) {
  return firebaseAuth.onAuthStateChanged(callback);
}

/** Get the current user's ID token for Authorization header on API calls */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}
