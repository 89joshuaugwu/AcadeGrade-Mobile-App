/**
 * Auth functions — same surface area as web lib/firebase/auth.ts, but backed
 * by @react-native-firebase/auth. Google sign-in CANNOT use signInWithPopup
 * on native (01_CONTEXT.md §7) — uses @react-native-google-signin instead,
 * then exchanges the native credential with Firebase.
 */
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import {
  EmailAuthProvider,
  FirebaseAuthTypes,
  getAuth,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  signInWithCredential,
} from '@react-native-firebase/auth';
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
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (response.type !== 'success' || !response.data.idToken) {
      const cancelled = new Error('Google sign-in was cancelled.') as Error & { code?: string };
      cancelled.code = statusCodes.SIGN_IN_CANCELLED;
      throw cancelled;
    }
    // RN Firebase v25's native bridge serializes an omitted access token as an
    // empty string, which Android rejects with "access token cannot be empty".
    // Fetch and pass both tokens explicitly so neither bridge slot is empty.
    const tokens = await GoogleSignin.getTokens();
    const googleCredential = GoogleAuthProvider.credential(response.data.idToken, tokens.accessToken);
    return signInWithCredential(getAuth(), googleCredential);
  } catch (error: any) {
    console.error('[AcadeGrade] Google sign-in failed:', { code: error?.code, message: error?.message });
    throw error;
  }
}

export async function reauthenticateWithGoogle() {
  const user = getAuth().currentUser;
  if (!user) throw new Error('No authenticated user');
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (response.type !== 'success' || !response.data.idToken) {
    throw new Error('Google re-authentication was cancelled.');
  }
  const tokens = await GoogleSignin.getTokens();
  return reauthenticateWithCredential(user, GoogleAuthProvider.credential(response.data.idToken, tokens.accessToken));
}

export async function reauthenticateWithPassword(password: string) {
  const user = getAuth().currentUser;
  if (!user?.email) throw new Error('No email sign-in is linked to this account');
  return reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
}

export function getGoogleSignInErrorMessage(error: any): string | null {
  const code = String(error?.code ?? '');
  if (code === statusCodes.SIGN_IN_CANCELLED || code === 'auth/popup-closed-by-user') return null;
  if (code === statusCodes.IN_PROGRESS) return 'Google sign-in is already open.';
  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return 'Google Play Services is unavailable or needs an update.';
  if (code === '10' || code === 'DEVELOPER_ERROR') {
    return 'Google setup is incomplete. Refresh google-services.json after adding this build’s SHA fingerprints, then rebuild the app.';
  }
  if (code === 'auth/account-exists-with-different-credential') return 'An account already exists with this email. Sign in using its original method first.';
  if (code === 'auth/invalid-credential') return 'Google returned an invalid credential. Refresh the Firebase Android configuration and rebuild.';
  return error?.message ? `Google sign-in failed: ${error.message}` : 'Google sign-in failed. Please try again.';
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
