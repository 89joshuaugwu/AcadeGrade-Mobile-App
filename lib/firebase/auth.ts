/**
 * Auth functions — same surface area as web lib/firebase/auth.ts, but backed
 * by @react-native-firebase/auth. Google sign-in CANNOT use signInWithPopup
 * on native (01_CONTEXT.md §7) — uses @react-native-google-signin instead,
 * then exchanges the native credential with Firebase.
 */
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { firebaseAuth } from './client';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID, // OAuth web client ID from the SAME Firebase project
});

export async function signInWithEmail(email: string, password: string) {
  return firebaseAuth.signInWithEmailAndPassword(email, password);
}

export async function signUpWithEmail(email: string, password: string) {
  return firebaseAuth.createUserWithEmailAndPassword(email, password);
}

export async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const { idToken } = await GoogleSignin.signIn();
  const googleCredential = auth.GoogleAuthProvider.credential(idToken);
  return firebaseAuth.signInWithCredential(googleCredential);
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
