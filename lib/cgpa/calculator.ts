import type { CourseInput, CourseMetrics, SemesterResult, CumulativeResult, Grade } from '@/types/course';
import { lookupGrade } from './gradeScale';

/**
 * Compute metrics for a single course.
 * Pure function — no side effects, no Math.random().
 * PORTED VERBATIM from web lib/cgpa/calculator.ts.
 */
export function computeCourseMetrics(course: CourseInput): CourseMetrics {
  const totalScore =
    course.caScore !== null && course.examScore !== null
      ? course.caScore + course.examScore
      : null;

  let grade: Grade;
  let gradePoint: number;
  let piPoint: number;
  let estimated = false;

  if (totalScore !== null) {
    const lookup = lookupGrade(totalScore);
    grade = lookup.grade;
    gradePoint = lookup.gradePoint;
    piPoint = (totalScore / 100) * 5;
  } else if (course.grade) {
    grade = course.grade;
    const gradePoints: Record<Grade, number> = {
      A: 5, B: 4, C: 3, D: 2, E: 1, F: 0,
    };
    gradePoint = gradePoints[grade];
    piPoint = gradePoint;
    estimated = true;
  } else {
    grade = 'F';
    gradePoint = 0;
    piPoint = 0;
  }

  return {
    code: course.code,
    title: course.title,
    units: course.units,
    caScore: course.caScore,
    examScore: course.examScore,
    totalScore,
    grade,
    gradePoint,
    piPoint,
    estimated,
  };
}

/**
 * Compute semester GPA and PI from an array of course metrics.
 * GPA = Σ(gradePoint × units) / Σ(units)
 * PI  = Σ(piPoint × units) / Σ(units)
 */
export function computeSemesterGPA(courses: CourseMetrics[]): SemesterResult {
  if (courses.length === 0) {
    return {
      gpa: 0,
      pi: 0,
      creditLoaded: 0,
      courseCount: 0,
      gradeDistribution: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 },
    };
  }

  let totalWeightedGP = 0;
  let totalWeightedPI = 0;
  let totalUnits = 0;
  const gradeDistribution: Record<Grade, number> = {
    A: 0, B: 0, C: 0, D: 0, E: 0, F: 0,
  };

  for (const course of courses) {
    totalWeightedGP += course.gradePoint * course.units;
    totalWeightedPI += course.piPoint * course.units;
    totalUnits += course.units;
    gradeDistribution[course.grade]++;
  }

  return {
    gpa: totalUnits > 0 ? totalWeightedGP / totalUnits : 0,
    pi: totalUnits > 0 ? totalWeightedPI / totalUnits : 0,
    creditLoaded: totalUnits,
    courseCount: courses.length,
    gradeDistribution,
  };
}

/**
 * Compute cumulative CGPA and PI across all semesters.
 * CGPA = Σ(gpa × creditLoaded) / Σ(creditLoaded)
 * CPI  = Σ(pi × creditLoaded) / Σ(creditLoaded)
 */
export function computeCumulativeCGPA(
  semesters: { gpa: number; pi: number; creditLoaded: number }[]
): CumulativeResult {
  if (semesters.length === 0) {
    return { cgpa: 0, pi: 0, totalCredits: 0, totalCourses: 0 };
  }

  let totalWeightedGPA = 0;
  let totalWeightedPI = 0;
  let totalCredits = 0;

  for (const sem of semesters) {
    if (sem.creditLoaded > 0) {
      totalWeightedGPA += sem.gpa * sem.creditLoaded;
      totalWeightedPI += sem.pi * sem.creditLoaded;
      totalCredits += sem.creditLoaded;
    }
  }

  return {
    cgpa: totalCredits > 0 ? totalWeightedGPA / totalCredits : 0,
    pi: totalCredits > 0 ? totalWeightedPI / totalCredits : 0,
    totalCredits,
    totalCourses: 0,
  };
}
