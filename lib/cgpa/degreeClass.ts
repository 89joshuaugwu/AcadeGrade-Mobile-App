import { DEGREE_CLASSES } from '@/constants/theme';

export interface DegreeClass {
  label: string;
  shortLabel: string;
  color: string;
  icon: string;
  minCGPA: number;
  maxCGPA: number;
}

/**
 * Resolve degree class from CGPA value.
 * PORTED VERBATIM from web lib/cgpa/degreeClass.ts.
 */
export function resolveDegreeClass(cgpa: number): DegreeClass {
  const degreeClass = DEGREE_CLASSES.find(
    (dc) => cgpa >= dc.minCGPA && cgpa <= dc.maxCGPA
  );
  return (degreeClass ?? DEGREE_CLASSES[DEGREE_CLASSES.length - 1]) as DegreeClass;
}

/**
 * Check if CGPA has crossed a degree class threshold.
 * Used to trigger the milestone Lottie celebration on Dashboard.
 */
export function hasClassChanged(previousCGPA: number, currentCGPA: number): boolean {
  const prevClass = resolveDegreeClass(previousCGPA);
  const currClass = resolveDegreeClass(currentCGPA);
  return prevClass.label !== currClass.label;
}
