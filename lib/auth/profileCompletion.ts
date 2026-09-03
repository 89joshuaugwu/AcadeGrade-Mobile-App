import type { User } from '@/types/user';

/**
 * A Firebase account can exist before its student record does, especially
 * during Google registration. Treating any Firestore document as a finished
 * profile is unsafe because ancillary writes (for example an FCM token) can
 * otherwise create a document with no academic identity.
 */
export function isStudentProfileComplete(candidate: unknown): candidate is User {
  if (!candidate || typeof candidate !== 'object') return false;

  const profile = candidate as Partial<User>;
  const requiredText = [
    profile.fullName,
    profile.email,
    profile.matric,
    profile.university,
    profile.department,
    profile.programme,
    profile.currentSession,
  ];

  return requiredText.every((value) => typeof value === 'string' && value.trim().length > 0)
    && typeof profile.currentLevel === 'number'
    && profile.currentLevel > 0;
}
