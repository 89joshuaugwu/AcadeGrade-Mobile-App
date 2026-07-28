/**
 * Native Firebase entry point.
 *
 * IMPORTANT — differs from web (01_CONTEXT.md §7):
 * We use @react-native-firebase (native modules), NOT the `firebase/*` web SDK.
 * Config is read automatically from GoogleService-Info.plist (iOS) and
 * google-services.json (Android) — there is no firebaseConfig object to
 * construct here like on web, the native SDK auto-initializes from those
 * files. Do not port `lib/firebase/client.ts` from web verbatim; the
 * initialization model is fundamentally different.
 */
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import messaging from '@react-native-firebase/messaging';

export const firebaseAuth = auth();
export const db = firestore();
export const fcm = messaging();

// Local emulator support for dev — mirrors the intent of web's emulator config
// without duplicating the exact env var names (native SDK uses useEmulator()).
if (__DEV__ && process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
  auth().useEmulator('http://localhost:9099');
  firestore().useEmulator('localhost', 8080);
}
