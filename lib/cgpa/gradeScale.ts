import type { Grade, GradeScaleEntry } from '@/types/course';
import { GRADE_SCALE, gradeColors } from '@/constants/theme';

/**
 * Look up grade and grade point from a total score.
 * Uses the Nigerian 5-point grade scale.
 * PORTED VERBATIM from web lib/cgpa/gradeScale.ts — logic untouched.
 */
export function lookupGrade(
  totalScore: number,
  scale: GradeScaleEntry[] = GRADE_SCALE as GradeScaleEntry[]
): { grade: Grade; gradePoint: number } {
  const entry = scale.find(
    (s) => totalScore >= s.minScore && totalScore <= s.maxScore
  );

  if (!entry) {
    return { grade: 'F', gradePoint: 0 };
  }

  return { grade: entry.grade, gradePoint: entry.gradePoint };
}

/** Get the hex color for a given grade — mobile uses hex directly (no CSS vars) */
export function getGradeColor(grade: Grade): string {
  return gradeColors[grade];
}

/** Accessible label color for a solid grade-color background. */
export function getGradeForeground(grade: Grade): string {
  return grade === 'F' ? '#FFFFFF' : '#07090F';
}
