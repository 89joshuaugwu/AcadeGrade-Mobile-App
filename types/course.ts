import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

type Timestamp = FirebaseFirestoreTypes.Timestamp;

/** Letter grade in Nigerian 5-point scale — ported from web types/course.ts */
export type Grade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/** Firestore users/{uid}/semesters/{semesterId}/courses/{courseId} document */
export interface Course {
  code: string;
  title: string;
  units: number;
  caScore: number | null;
  examScore: number | null;
  totalScore: number | null;
  grade: Grade | null;
  gradePoint: number;
  piPoint: number;
  estimated: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CourseWithId extends Course {
  id: string;
}

/** Input data for creating/editing a course (before computation) */
export interface CourseInput {
  id?: string;
  localId?: string;
  code: string;
  title: string;
  units: number;
  caScore: number | null;
  examScore: number | null;
  grade?: Grade;
  estimated?: boolean;
  isAR?: boolean;
}

/** Computed metrics for a single course */
export interface CourseMetrics {
  code: string;
  title: string;
  units: number;
  caScore: number | null;
  examScore: number | null;
  totalScore: number | null;
  grade: Grade;
  gradePoint: number;
  piPoint: number;
  estimated: boolean;
}

export interface CatalogCourse {
  code: string;
  title: string;
  units: number;
  dept: string;
  level: number;
  semester: 1 | 2;
  createdAt: Timestamp;
}

export interface CatalogCourseWithId extends CatalogCourse {
  id: string;
}

export interface GradeScaleEntry {
  minScore: number;
  maxScore: number;
  grade: Grade;
  gradePoint: number;
}

export interface SemesterResult {
  gpa: number;
  pi: number;
  creditLoaded: number;
  courseCount: number;
  gradeDistribution: Record<Grade, number>;
}

export interface CumulativeResult {
  cgpa: number;
  pi: number;
  totalCredits: number;
  totalCourses: number;
}
