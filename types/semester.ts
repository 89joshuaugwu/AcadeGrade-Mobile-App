import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import type { CourseWithId } from './course';

type Timestamp = FirebaseFirestoreTypes.Timestamp;

export type SemesterNumber = 1 | 2;

/** Firestore users/{uid}/semesters/{semesterId} document — ported from web types/semester.ts */
export interface Semester {
  label: string;
  session: string;
  level: number;
  semester: SemesterNumber;
  gpa: number;
  pi: number;
  creditLoaded: number;
  isComplete: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SemesterWithId extends Semester {
  id: string;
}

export interface SemesterWithCourses extends SemesterWithId {
  courses: CourseWithId[];
}

export interface SemesterSummary {
  semesterId: string;
  label: string;
  gpa: number;
  pi: number;
  creditLoaded: number;
  session: string;
}
