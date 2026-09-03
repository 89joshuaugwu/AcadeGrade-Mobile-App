/**
 * Push notification registration.
 *
 * Slots into the EXISTING backend architecture documented in
 * docs/project_handover/2_student_features.md §5: the Firestore user doc
 * stores `fcmTokens: string[]`. We append this device's token on login and
 * remove it on logout — same contract the web client already uses, just a
 * different token source (native FCM via this module vs. web push VAPID).
 */
import { fcm, db } from './client';
import firestore from '@react-native-firebase/firestore';
import { PermissionsAndroid, Platform } from 'react-native';

export async function requestNotificationPermission(): Promise<boolean> {
  // Firebase's permission method is authoritative on iOS, but on Android 13+
  // the visible runtime prompt is the platform POST_NOTIFICATIONS permission.
  // Requesting it directly prevents a misleading “enabled” state with no
  // Android system permission ever shown to the student.
  if (Platform.OS === 'android') {
    if (Number(Platform.Version) < 33) return true;
    const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    const alreadyGranted = await PermissionsAndroid.check(permission);
    if (alreadyGranted) return true;
    const result = await PermissionsAndroid.request(permission, {
      title: 'Allow AcadeGrade notifications?',
      message: 'Get alerts when semesters are saved, insights are ready, or an academic update needs your attention.',
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    });
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  const authStatus = await fcm.requestPermission();
  return (
    authStatus === 1 /* AUTHORIZED */ ||
    authStatus === 2 /* PROVISIONAL */
  );
}

/** Register this device's FCM token into the user's fcmTokens array. */
export async function registerFcmToken(uid: string): Promise<string> {
  const granted = await requestNotificationPermission();
  if (!granted) throw new Error('Notification permission was not granted.');

  if (!fcm.isDeviceRegisteredForRemoteMessages) {
    await fcm.registerDeviceForRemoteMessages();
  }
  const token = await fcm.getToken();
  if (!token) throw new Error('Could not obtain a notification token for this device.');
  // `update` deliberately refuses to create a user profile. Calling this
  // during Google sign-in must never turn an unfinished account into a
  // partial `users/{uid}` document that the router mistakes for registration.
  await db.collection('users').doc(uid).update({
    fcmTokens: firestore.FieldValue.arrayUnion(token),
  });
  return token;
}

/**
 * Called on logout.
 *
 * NOTE: docs/project_handover/2_student_features.md §5 describes this as a
 * call to `DELETE /api/user/fcm-token` — that route does NOT exist in the
 * actual codebase (verified: app/api/user/ only contains delete-account/).
 * The real web implementation (lib/firebase/fcm.ts:189 on web) removes the
 * token with a DIRECT Firestore `arrayRemove` update, no API route involved.
 * This ports the real behavior, not the doc. Flag this doc/code mismatch to
 * Joshua rather than silently building against a route that isn't there.
 */
export async function unregisterFcmToken(uid: string): Promise<void> {
  const token = await fcm.getToken();
  await db.collection('users').doc(uid).update({
    fcmTokens: firestore.FieldValue.arrayRemove(token),
  });
  await fcm.deleteToken();
}

/** Foreground message listener — call once from root layout. */
export function onForegroundMessage(callback: (title: string, body: string) => void) {
  return fcm.onMessage(async (remoteMessage) => {
    callback(remoteMessage.notification?.title ?? 'AcadeGrade', remoteMessage.notification?.body ?? '');
  });
}

/** Maps web notification URLs from the API into their mobile destinations. */
export function getNotificationRoute(remoteMessage: { data?: Record<string, unknown> }): string {
  const rawUrl = typeof remoteMessage.data?.url === 'string' ? remoteMessage.data.url : undefined;
  let pathname = '/notifications';

  if (rawUrl) {
    try {
      pathname = new URL(rawUrl, 'https://acadegrade.vercel.app').pathname;
    } catch {
      pathname = rawUrl.split('?')[0] || '/notifications';
    }
  }

  const resultMatch = pathname.match(/^\/results\/([^/]+)$/);
  if (resultMatch) return `/(tabs)/results/${encodeURIComponent(resultMatch[1])}`;
  if (pathname === '/results') return '/(tabs)/results';
  if (pathname === '/insights') return '/(tabs)/insights';
  if (pathname === '/transcript') return '/(tabs)/transcript';
  if (pathname === '/settings' || pathname === '/profile') return '/(tabs)/profile';
  if (pathname === '/dashboard') return '/(tabs)/dashboard';
  return '/(tabs)/notifications';
}

/** Fires when a system notification resumes the app from the background. */
export function onNotificationOpened(callback: (route: string) => void) {
  return fcm.onNotificationOpenedApp((remoteMessage) => callback(getNotificationRoute(remoteMessage)));
}

/** Reads the notification that launched a fully closed app, if any. */
export async function getInitialNotificationRoute(): Promise<string | null> {
  const remoteMessage = await fcm.getInitialNotification();
  return remoteMessage ? getNotificationRoute(remoteMessage) : null;
}

/** Keeps a rotated FCM token registered while the session is active. */
export function onTokenRefresh(uid: string) {
  return fcm.onTokenRefresh(async (token) => {
    await db.collection('users').doc(uid).update({
      fcmTokens: firestore.FieldValue.arrayUnion(token),
    });
  });
}
