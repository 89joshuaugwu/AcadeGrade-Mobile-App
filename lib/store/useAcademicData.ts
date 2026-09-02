import { useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/firebase/client';
import { useAuthStore } from '@/lib/store/authStore';
import { computeCumulativeCGPA } from '@/lib/cgpa/calculator';
import type { SemesterWithId } from '@/types/semester';
import type { CourseWithId } from '@/types/course';

export interface AcademicSnapshot {
  loading: boolean;
  semesters: SemesterWithId[];
  allCourses: CourseWithId[];
  cgpa: number;
  pi: number;
  totalCredits: number;
  totalCourses: number;
  currentSemesterGPA: number;
  atRiskCount: number; // totalScore < 50, matching web's actual definition
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
  const [coursesBySemester, setCoursesBySemester] = useState<Record<string, CourseWithId[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setSemesters([]);
      setCoursesBySemester({});
      setLoading(false);
      return;
    }

    setLoading(true);
    const courseUnsubs: Record<string, () => void> = {};

    const unsub = db
      .collection('users')
      .doc(uid)
      .collection('semesters')
      // FIXED — was `.orderBy('createdAt', 'asc')`. Firestore's orderBy
      // silently EXCLUDES documents that don't have the ordered field at
      // all. Web's semester-creation code (`setDocument` helper) only ever
      // writes `updatedAt`, never `createdAt` — so every semester created
      // via the web app was invisible to this query. This is almost
      // certainly why real academic data entered on web wasn't showing up
      // on mobile at all. Removed the Firestore-level ordering entirely and
      // sort client-side by level/semester instead, matching web's actual
      // `useSemesters.ts` (`orderBy('level', 'asc')`) — and unlike a
      // Firestore orderBy, a client-side sort never excludes a document.
      .onSnapshot((snap) => {
        const sems = (snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as SemesterWithId[])
          .sort((a, b) => (a.level !== b.level ? a.level - b.level : a.semester - b.semester));
        setSemesters(sems);

        const activeSemesterIds = new Set(sems.map((s) => s.id));
        Object.keys(courseUnsubs).forEach((semesterId) => {
          if (!activeSemesterIds.has(semesterId)) {
            courseUnsubs[semesterId]();
            delete courseUnsubs[semesterId];
          }
        });

        sems.forEach((semester) => {
          if (courseUnsubs[semester.id]) return;
          courseUnsubs[semester.id] = db
            .collection('users').doc(uid).collection('semesters').doc(semester.id).collection('courses')
            .onSnapshot((courseSnap) => {
              setCoursesBySemester((current) => ({
                ...current,
                [semester.id]: courseSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as CourseWithId[],
              }));
            });
        });
        setLoading(false);
      });

    return () => {
      unsub();
      Object.values(courseUnsubs).forEach((unsubscribe) => unsubscribe());
    };
  }, [uid]);

  const allCourses = useMemo(() => Object.values(coursesBySemester).flat(), [coursesBySemester]);

  const cumulative = computeCumulativeCGPA(semesters);
  const currentSemester = semesters[semesters.length - 1];
  // FIXED — was `c.grade === 'E' || c.grade === 'F'` (effectively totalScore
  // < 45). Web's actual definition (`dashboard/page.tsx`, `insights/page.tsx`)
  // is `totalScore < 50`, which also flags D grades in the 45–49 range.
  const atRiskCount = allCourses.filter((c) => (c.totalScore ?? 0) < 50).length;

  return {
    loading,
    semesters,
    allCourses,
    cgpa: cumulative.cgpa,
    pi: cumulative.pi,
    totalCredits: cumulative.totalCredits,
    totalCourses: allCourses.length,
    currentSemesterGPA: currentSemester?.gpa ?? 0,
    atRiskCount,
  };
}
