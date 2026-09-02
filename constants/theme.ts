/**
 * AcadeGrade Mobile — Design tokens
 * Ported VERBATIM from the web app's `app/globals.css` (@theme block).
 * Do not invent new colors here — if a token is missing, pull it from
 * globals.css, don't guess.
 */

// ── Liquid Glass surfaces (2026 mobile UI standard: translucency + depth,
//    not flat cards) — built FROM the existing brand colors above via alpha,
//    never new hues. Used by GlassCard instead of the old flat Card.
export const glass = {
  // BlurView tint — dark, matches --acade-void/deep family
  tint: 'dark' as const,
  intensity: 40,
  // Hairline light border catching a simulated top-left light source
  borderTop: 'rgba(232, 237, 255, 0.14)',
  borderBottom: 'rgba(232, 237, 255, 0.04)',
  // Surface wash over the blur — keeps brand surface color legible through glass
  wash: 'rgba(20, 27, 46, 0.55)', // colors.surface at 55%
  washElevated: 'rgba(26, 36, 61, 0.6)', // colors.overlay at 60%
  primaryGlowWash: 'rgba(99, 102, 241, 0.12)', // colors.primary at 12%, for "AI active" surfaces
} as const;

export const colors = {
  // Background layers
  void: '#07090F',
  deep: '#0E1322',
  surface: '#141B2E',
  overlay: '#1A243D',
  border: '#1F2B47',
  borderSubtle: '#162038',

  // Primary — Electric Indigo
  primary: '#6366F1',
  primaryHover: '#4F46E5',
  primaryGlow: '#818CF8',
  primaryDim: '#1e1b4b',

  // Accent — Nigerian Gold
  gold: '#F59E0B',
  goldHover: '#D97706',
  goldDim: '#1C1005',

  // Semantic
  success: '#22C55E',
  successDim: '#052E16',
  danger: '#EF4444',
  dangerDim: '#450A0A',
  warning: '#F59E0B',
  info: '#38BDF8',

  // Text
  text: '#E8EDFF',
  textMuted: '#8892B0',
  textFaint: '#4A5580',
  textInverse: '#07090F',
} as const;

/** Grade colors — matches web `GRADE_COLORS` in lib/utils/constants.ts */
export const gradeColors = {
  A: '#22C55E',
  B: '#818CF8', // note: web CSS var --grade-b is #818CF8, not the primary #6366F1 used in 02_DESIGN.md — CSS is source of truth
  C: '#F59E0B',
  D: '#F97316',
  E: '#EF4444',
  F: '#6B7280',
} as const;

/** Degree class colors — matches web `DEGREE_CLASSES` in lib/utils/constants.ts */
export const degreeClassColors = {
  first: '#22C55E',
  secondUpper: '#818CF8',
  secondLower: '#F59E0B',
  third: '#F97316',
  pass: '#EF4444',
  fail: '#6B7280',
} as const;

/** Degree class thresholds — ported verbatim from lib/utils/constants.ts DEGREE_CLASSES */
export const DEGREE_CLASSES = [
  { label: 'First Class', shortLabel: '1st', color: degreeClassColors.first, icon: '🏆', minCGPA: 4.5, maxCGPA: 5.0 },
  { label: 'Second Class Upper (2:1)', shortLabel: '2:1', color: degreeClassColors.secondUpper, icon: '🎖', minCGPA: 3.5, maxCGPA: 4.49 },
  { label: 'Second Class Lower (2:2)', shortLabel: '2:2', color: degreeClassColors.secondLower, icon: '✅', minCGPA: 2.4, maxCGPA: 3.49 },
  { label: 'Third Class', shortLabel: '3rd', color: degreeClassColors.third, icon: '⚠️', minCGPA: 1.5, maxCGPA: 2.39 },
  { label: 'Pass', shortLabel: 'Pass', color: degreeClassColors.pass, icon: '🔴', minCGPA: 1.0, maxCGPA: 1.49 },
  { label: 'Fail', shortLabel: 'Fail', color: degreeClassColors.fail, icon: '❌', minCGPA: 0, maxCGPA: 0.99 },
] as const;

/** Nigerian 5-point grade scale — ported verbatim from lib/utils/constants.ts GRADE_SCALE */
export const GRADE_SCALE = [
  { minScore: 70, maxScore: 100, grade: 'A' as const, gradePoint: 5 },
  { minScore: 60, maxScore: 69, grade: 'B' as const, gradePoint: 4 },
  { minScore: 50, maxScore: 59, grade: 'C' as const, gradePoint: 3 },
  { minScore: 45, maxScore: 49, grade: 'D' as const, gradePoint: 2 },
  { minScore: 40, maxScore: 44, grade: 'E' as const, gradePoint: 1 },
  { minScore: 0, maxScore: 39, grade: 'F' as const, gradePoint: 0 },
];

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48,
} as const;

export const radius = {
  sm: 8, md: 12, lg: 16, xl: 24, pill: 999,
} as const;

export const typography = {
  xs: 12, sm: 14, base: 16, lg: 18, xl: 20, xxl: 24, xxxl: 30,
} as const;

export const APP_NAME = 'AcadeGrade';
export const APP_TAGLINE = "Know where you stand. Know where you're going.";

/**
 * Light theme — added per direct request to match the inspiration
 * references (which are predominantly light-mode) and, in the user's own
 * words, "our logo has this nice mix of colors... it will match our logo."
 * Same primary/gold/semantic hues as the dark palette above (brand colors
 * never change between modes) — only surfaces/borders/text invert.
 *
 * SCOPE NOTE: existing screens (Dashboard, Results, Transcript, Insights,
 * Profile) still import `colors` directly and are NOT theme-aware yet —
 * retrofitting ~15 already-built screens to a dynamic theme is a larger
 * follow-up. This round wires theme-awareness into the screens being
 * rebuilt right now (Welcome, Onboarding, Login, Register, Forgot
 * Password) via `useThemeColors()` below.
 */
export const lightColors = {
  void: '#F7F7FB',
  deep: '#FFFFFF',
  surface: '#FFFFFF',
  overlay: '#F1F1F8',
  border: '#E4E4EF',
  borderSubtle: '#EDEDF5',

  primary: '#6366F1',
  primaryHover: '#4F46E5',
  primaryGlow: '#6366F1',
  primaryDim: '#EEEEFD',

  gold: '#F59E0B',
  goldHover: '#D97706',
  goldDim: '#FEF3E2',

  success: '#16A34A',
  successDim: '#EAFBF1',
  danger: '#DC2626',
  dangerDim: '#FDECEC',
  warning: '#D97706',
  info: '#0284C7',

  text: '#14162B',
  textMuted: '#6B7085',
  textFaint: '#A1A5B8',
  textInverse: '#FFFFFF',
} as const;

export type ThemeColors = typeof colors;

