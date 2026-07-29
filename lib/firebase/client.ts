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

/**
 * These three run at module-import time, same as the GoogleSignin.configure()
 * call that was moved out of `auth.ts` for the same reason (see that file's
 * comment). Native module init here is generally more robust than a JS-side
 * config call, but wrapping it means a failure here logs clearly instead of
 * silently killing the JS thread before anything can render.
 */
function initFirebase() {
  try {
    return { firebaseAuth: auth(), db: firestore(), fcm: messaging() };
  } catch (err) {
    console.error(
      '[AcadeGrade] Native Firebase module initialization failed. Check that ' +
        'google-services.json / GoogleService-Info.plist package names match ' +
        'app.json exactly, and that this build actually includes the native ' +
        '@react-native-firebase modules (Expo Go will NOT work — a dev build ' +
        'or EAS build is required).',
      err
    );
    throw err;
  }
}

const { firebaseAuth: _firebaseAuth, db: _db, fcm: _fcm } = initFirebase();
export const firebaseAuth = _firebaseAuth;
export const db = _db;
export const fcm = _fcm;

// Local emulator support for dev — mirrors the intent of web's emulator config
// without duplicating the exact env var names (native SDK uses useEmulator()).
if (__DEV__ && process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
  auth().useEmulator('http://localhost:9099');
  firestore().useEmulator('localhost', 8080);
}
