import { useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/firebase/client';
import { useAuthStore } from '@/lib/store/authStore';
import { computeCumulativeCGPA } from '@/lib/cgpa/calculator';
import type { SemesterWithId } from '@/types/semester';
import type { CourseWithId } from '@/types/course';

const INITIAL_SYNC_TIMEOUT_MS = 12000;

export interface AcademicSnapshot {
  loading: boolean;
  semesters: SemesterWithId[];
  coursesBySemester: Record<string, CourseWithId[]>;
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

    setSemesters([]);
    setCoursesBySemester({});
    setLoading(true);
    let active = true;
    let semesterSnapshotReady = false;
    let initialHydrationComplete = false;
    let activeSemesterIds = new Set<string>();
    const hydratedCourseIds = new Set<string>();
    const courseUnsubs: Record<string, () => void> = {};
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

    const finishInitialHydration = () => {
      if (
        active
        && !initialHydrationComplete
        && semesterSnapshotReady
        && [...activeSemesterIds].every((semesterId) => hydratedCourseIds.has(semesterId))
      ) {
        initialHydrationComplete = true;
        if (fallbackTimer) clearTimeout(fallbackTimer);
        setLoading(false);
      }
    };

    // An offline client with no local cache may never receive a server-backed
    // snapshot. Keep the skeleton useful, but never trap the page forever.
    fallbackTimer = setTimeout(() => {
      if (!active || initialHydrationComplete) return;
      initialHydrationComplete = true;
      setLoading(false);
    }, INITIAL_SYNC_TIMEOUT_MS);

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
      .onSnapshot({ includeMetadataChanges: true }, (snap) => {
        const sems = (snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as SemesterWithId[])
          .sort((a, b) => (a.level !== b.level ? a.level - b.level : a.semester - b.semester));
        setSemesters(sems);

        activeSemesterIds = new Set(sems.map((s) => s.id));
        // Empty cache snapshots are provisional: wait for the server to
        // confirm emptiness so real cloud data never flashes in late.
        if (!snap.metadata.fromCache || snap.docs.length > 0) semesterSnapshotReady = true;
        setCoursesBySemester((current) => Object.fromEntries(
          sems
            .filter((semester) => current[semester.id])
            .map((semester) => [semester.id, current[semester.id]]),
        ));
        Object.keys(courseUnsubs).forEach((semesterId) => {
          if (!activeSemesterIds.has(semesterId)) {
            courseUnsubs[semesterId]();
            delete courseUnsubs[semesterId];
            hydratedCourseIds.delete(semesterId);
          }
        });

        sems.forEach((semester) => {
          if (courseUnsubs[semester.id]) return;
          courseUnsubs[semester.id] = db
            .collection('users').doc(uid).collection('semesters').doc(semester.id).collection('courses')
            .onSnapshot({ includeMetadataChanges: true }, (courseSnap) => {
              if (!courseSnap.metadata.fromCache || courseSnap.docs.length > 0) {
                hydratedCourseIds.add(semester.id);
              }
              setCoursesBySemester((current) => ({
                ...current,
                [semester.id]: courseSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as CourseWithId[],
              }));
              finishInitialHydration();
            }, () => {
              hydratedCourseIds.add(semester.id);
              setCoursesBySemester((current) => ({ ...current, [semester.id]: [] }));
              finishInitialHydration();
            });
        });
        finishInitialHydration();
      }, () => {
        if (!active) return;
        semesterSnapshotReady = true;
        initialHydrationComplete = true;
        if (fallbackTimer) clearTimeout(fallbackTimer);
        setLoading(false);
      });

    return () => {
      active = false;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      unsub();
      Object.values(courseUnsubs).forEach((unsubscribe) => unsubscribe());
    };
  }, [uid]);

  const allCourses = useMemo(() => Object.values(coursesBySemester).flat(), [coursesBySemester]);

  const completedSemesters = semesters.filter((semester) => semester.isComplete);
  const cumulative = computeCumulativeCGPA(completedSemesters);
  const currentSemester = semesters[semesters.length - 1];
  // FIXED — was `c.grade === 'E' || c.grade === 'F'` (effectively totalScore
  // < 45). Web's actual definition (`dashboard/page.tsx`, `insights/page.tsx`)
  // is `totalScore < 50`, which also flags D grades in the 45–49 range.
  const completedCourses = completedSemesters.flatMap((semester) => coursesBySemester[semester.id] ?? []);
  const atRiskCount = completedCourses.filter((course) => !course.isAR && course.totalScore != null && course.totalScore < 50).length;

  return {
    loading,
    semesters,
    coursesBySemester,
    allCourses,
    cgpa: cumulative.cgpa,
    pi: cumulative.pi,
    totalCredits: cumulative.totalCredits,
    totalCourses: allCourses.length,
    currentSemesterGPA: currentSemester?.gpa ?? 0,
    atRiskCount,
  };
}
