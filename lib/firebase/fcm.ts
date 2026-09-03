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

export async function requestNotificationPermission(): Promise<boolean> {
  const authStatus = await fcm.requestPermission();
  return (
    authStatus === 1 /* AUTHORIZED */ ||
    authStatus === 2 /* PROVISIONAL */
  );
}

/** Register this device's FCM token into the user's fcmTokens array. */
export async function registerFcmToken(uid: string): Promise<void> {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const token = await fcm.getToken();
  await db.collection('users').doc(uid).set(
    { fcmTokens: firestore.FieldValue.arrayUnion(token) },
    { merge: true }
  );
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
  await db.collection('users').doc(uid).set(
    { fcmTokens: firestore.FieldValue.arrayRemove(token) },
    { merge: true }
  );
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
    await db.collection('users').doc(uid).set(
      { fcmTokens: firestore.FieldValue.arrayUnion(token) },
      { merge: true }
    );
  });
}
