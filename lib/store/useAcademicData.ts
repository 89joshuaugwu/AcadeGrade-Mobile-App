import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/client';
import { useAuthStore } from '@/lib/store/authStore';
import { computeCumulativeCGPA } from '@/lib/cgpa/calculator';
import type { SemesterWithId } from '@/types/semester';
import type { CourseWithId } from '@/types/course';

export interface AcademicSnapshot {
  loading: boolean;
  semesters: SemesterWithId[];
  cgpa: number;
  pi: number;
  totalCredits: number;
  totalCourses: number;
  currentSemesterGPA: number;
  atRiskCount: number; // courses graded E or F, per 2_student_features.md §1
}

/**
 * Subscribes to users/{uid}/semesters (and their courses subcollections) in
 * real time — same data model as web (01_CONTEXT.md §5), no new collections.
 * Recalculates CGPA/PI on every change, matching web's "instant recalculation"
 * behavior described in 2_student_features.md §2.
 */
export function useAcademicData(): AcademicSnapshot {
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const [semesters, setSemesters] = useState<SemesterWithId[]>([]);
  const [allCourses, setAllCourses] = useState<CourseWithId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;

    const unsub = db
      .collection('users')
      .doc(uid)
      .collection('semesters')
      .orderBy('createdAt', 'asc')
      .onSnapshot(async (snap) => {
        const sems = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as SemesterWithId[];
        setSemesters(sems);

        const courseLists = await Promise.all(
          sems.map((s) =>
            db
              .collection('users')
              .doc(uid)
              .collection('semesters')
              .doc(s.id)
              .collection('courses')
              .get()
              .then((cs) => cs.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as CourseWithId[])
          )
        );
        setAllCourses(courseLists.flat());
        setLoading(false);
      });

    return unsub;
  }, [uid]);

  const cumulative = computeCumulativeCGPA(semesters);
  const currentSemester = semesters[semesters.length - 1];
  const atRiskCount = allCourses.filter((c) => c.grade === 'E' || c.grade === 'F').length;

  return {
    loading,
    semesters,
    cgpa: cumulative.cgpa,
    pi: cumulative.pi,
    totalCredits: cumulative.totalCredits,
    totalCourses: allCourses.length,
    currentSemesterGPA: currentSemester?.gpa ?? 0,
    atRiskCount,
  };
}
