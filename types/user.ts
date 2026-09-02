import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

type Timestamp = FirebaseFirestoreTypes.Timestamp;

export const STUDENT_LEVELS = [100, 200, 300, 400, 500] as const;
export type StudentLevel = typeof STUDENT_LEVELS[number];

export type RecordMode = 'fromScratch' | 'complete';
export type GradeMode = 'cgpa' | 'pi';

/** Firestore users/{uid} document — ported from web types/user.ts.
 *  Same document, same fields. Mobile only ADDS its own FCM token into the
 *  existing `fcmTokens` array via the same backend logic — no new field
 *  needed for "mobile vs web" distinction. */
export interface User {
  fullName: string;
  email: string;
  matric: string;
  department: string;
  currentLevel: StudentLevel;
  programme: string;
  university: string;
  avatarUrl: string | null;
  recordMode: RecordMode;
  gradeMode: GradeMode;
  currentSession: string;
  isAdmin: boolean;
  disabled: boolean;
  fcmToken: string | null;
  fcmTokens?: string[];
  notificationPreferences?: {
    semesterSaved?: boolean;
    degreeClass?: boolean;
    aiInsights?: boolean;
    adminBroadcasts?: boolean;
  };
  tourCompleted?: boolean;
  resultsTourCompleted?: boolean;
  /** Mobile-only: has the user seen the mobile onboarding carousel? Stored
   *  under the same doc so state follows the user across devices. */
  mobileOnboardingCompleted?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserWithId extends User {
  uid: string;
}

export interface RegisterFormData {
  fullName: string;
  matric: string;
  email: string;
  password: string;
  confirmPassword: string;
  university: string;
  department: string;
  programme: string;
  currentLevel: StudentLevel;
  currentSession: string;
  recordMode: RecordMode;
  semestersCompleted?: number;
}

export interface PastSemesterEntry {
  level: StudentLevel;
  semester: 1 | 2;
  session: string;
  label: string;
}
