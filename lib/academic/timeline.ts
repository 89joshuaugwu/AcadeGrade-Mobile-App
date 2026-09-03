import type { SemesterNumber, SemesterWithId } from '@/types/semester';
import type { UserWithId } from '@/types/user';

export const COURSE_DURATION_OPTIONS = [3, 4, 5, 6, 8, 10] as const;
export const MIN_COURSE_DURATION = 1;
export const MAX_COURSE_DURATION = 10;

export interface AcademicSlot {
  key: string;
  yearNumber: number;
  level: number;
  semester: SemesterNumber;
  session: string;
  label: string;
}

export interface AcademicPlan {
  entrySession: string;
  graduationSession: string;
  duration: number;
  slots: AcademicSlot[];
  createdKeys: Set<string>;
  completedKeys: Set<string>;
  remainingSlots: AcademicSlot[];
  remainingAcademicSemesters: number;
  createdCount: number;
  completedCount: number;
  isFullyCreated: boolean;
  isGraduated: boolean;
}

export function parseAcademicSession(session?: string | null): number | null {
  if (!session || !/^\d{4}\/\d{4}$/.test(session.trim())) return null;
  const [first, second] = session.trim().split('/').map(Number);
  if (!Number.isFinite(first) || second !== first + 1) return null;
  return first;
}

export function formatAcademicSession(startYear: number): string {
  return `${startYear}/${startYear + 1}`;
}

export function formatSessionInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.length <= 4 ? digits : `${digits.slice(0, 4)}/${digits.slice(4)}`;
}

export function graduationSession(entrySession: string, duration: number): string {
  const start = parseAcademicSession(entrySession);
  if (start == null) return '';
  return formatAcademicSession(start + normalizeDuration(duration) - 1);
}

export function normalizeDuration(duration?: number | null): number {
  const parsed = Math.round(Number(duration) || 4);
  return Math.max(MIN_COURSE_DURATION, Math.min(MAX_COURSE_DURATION, parsed));
}

export function slotKey(level: number, semester: number): string {
  return `${level}:${semester}`;
}

export function buildAcademicSlots(entrySession: string, duration: number): AcademicSlot[] {
  const start = parseAcademicSession(entrySession);
  if (start == null) return [];
  const years = normalizeDuration(duration);
  return Array.from({ length: years }, (_, yearIndex) => {
    const level = (yearIndex + 1) * 100;
    const session = formatAcademicSession(start + yearIndex);
    return ([1, 2] as const).map((semester) => ({
      key: slotKey(level, semester),
      yearNumber: yearIndex + 1,
      level,
      semester,
      session,
      label: `${level}L — ${semester === 1 ? 'First' : 'Second'} Semester`,
    }));
  }).flat();
}

export function minimumDurationForSemesters(semesters: Pick<SemesterWithId, 'level'>[]): number {
  const highestLevel = semesters.reduce((highest, semester) => Math.max(highest, Number(semester.level) || 0), 0);
  return Math.max(MIN_COURSE_DURATION, Math.ceil(highestLevel / 100));
}

export function resolveCourseDuration(profile: Pick<UserWithId, 'courseDuration' | 'currentLevel'> | null | undefined, semesters: Pick<SemesterWithId, 'level'>[] = []): number {
  const minimumFromData = Math.max(
    minimumDurationForSemesters(semesters),
    Math.ceil((Number(profile?.currentLevel) || 100) / 100),
  );
  return Math.max(normalizeDuration(profile?.courseDuration), minimumFromData);
}

export function resolveEntrySession(profile: Pick<UserWithId, 'entrySession' | 'currentSession'> | null | undefined): string {
  return profile?.entrySession || profile?.currentSession || '';
}

export function getAcademicPlan(profile: UserWithId | null | undefined, semesters: SemesterWithId[]): AcademicPlan {
  const entrySession = resolveEntrySession(profile);
  const duration = resolveCourseDuration(profile, semesters);
  const slots = buildAcademicSlots(entrySession, duration);
  const validKeys = new Set(slots.map((slot) => slot.key));
  const createdKeys = new Set(
    semesters
      .map((semester) => slotKey(Number(semester.level), Number(semester.semester)))
      .filter((key) => validKeys.has(key)),
  );
  const completedKeys = new Set(
    semesters
      .filter((semester) => semester.isComplete)
      .map((semester) => slotKey(Number(semester.level), Number(semester.semester)))
      .filter((key) => validKeys.has(key)),
  );
  const remainingSlots = slots.filter((slot) => !createdKeys.has(slot.key));
  const remainingAcademicSemesters = Math.max(0, slots.length - completedKeys.size);

  return {
    entrySession,
    graduationSession: graduationSession(entrySession, duration),
    duration,
    slots,
    createdKeys,
    completedKeys,
    remainingSlots,
    remainingAcademicSemesters,
    createdCount: createdKeys.size,
    completedCount: completedKeys.size,
    isFullyCreated: slots.length > 0 && remainingSlots.length === 0,
    isGraduated: slots.length > 0 && completedKeys.size === slots.length,
  };
}

export function inferCurrentLevel(entrySession: string, duration: number, now = new Date()): number {
  const start = parseAcademicSession(entrySession);
  if (start == null) return 100;
  const academicStartYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const yearNumber = Math.max(1, Math.min(normalizeDuration(duration), academicStartYear - start + 1));
  return yearNumber * 100;
}
