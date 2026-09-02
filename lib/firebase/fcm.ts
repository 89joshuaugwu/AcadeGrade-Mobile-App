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
  await db
    .collection('users')
    .doc(uid)
    .update({ fcmTokens: firestore.FieldValue.arrayUnion(token) });
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
  await db
    .collection('users')
    .doc(uid)
    .update({ fcmTokens: firestore.FieldValue.arrayRemove(token) });
}

/** Foreground message listener — call once from root layout. */
export function onForegroundMessage(callback: (title: string, body: string) => void) {
  return fcm.onMessage(async (remoteMessage) => {
    callback(remoteMessage.notification?.title ?? 'AcadeGrade', remoteMessage.notification?.body ?? '');
  });
}
