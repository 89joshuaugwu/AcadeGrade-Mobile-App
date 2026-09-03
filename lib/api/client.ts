/**
 * API client — calls the EXISTING production Next.js API routes at
 * acadegrade.vercel.app. This file intentionally does not reimplement any
 * business logic (grading, AI, PDF, email) — it is a thin HTTP layer.
 *
 * All routes audited directly from app/api/**\/route.ts (17 route.ts files
 * exist on disk — the "18 routes" figure in 01_CONTEXT.md is slightly off,
 * and a "DELETE /api/user/fcm-token" route mentioned in the handover docs
 * does not exist at all; see lib/firebase/fcm.ts for the real mechanism):
 *   /api/about                         GET
 *   /api/admin/*                       — NOT called from mobile (student-only app)
 *   /api/ai/forecast                   POST
 *   /api/ai/insights                   POST
 *   /api/ai/whatif                     POST
 *   /api/auth/otp/send                 POST
 *   /api/auth/otp/verify                POST
 *   /api/auth/password/reset           POST
 *   /api/notifications/send            POST (authenticated owner/admin notification trigger)
 *   /api/results/extract               POST  (AI OCR)
 *   /api/transcript/generate           POST
 *   /api/transcript/share              POST
 *   /api/user/delete-account           POST
 *
 * Base URL is configured via EXPO_PUBLIC_API_BASE_URL — set to
 * https://acadegrade.vercel.app in production.
 */
import { getIdToken } from '@/lib/firebase/auth';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://acadegrade.vercel.app';

class ApiError extends Error {
  status: number;
  retryAfterSeconds?: number;
  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message);
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean; responseType?: 'json' | 'arrayBuffer' } = {}
): Promise<T> {
  const { method = 'GET', body, auth = true, responseType = 'json' } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = await getIdToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = responseType === 'arrayBuffer'
    ? await res.arrayBuffer()
    : await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = typeof data === 'object' && data !== null && 'error' in data
      ? String((data as { error?: unknown }).error)
      : `Request failed (${res.status})`;
    const retryAfterHeader = Number(res.headers.get('Retry-After'));
    const retryAfterBody = typeof data === 'object' && data !== null && 'retryAfterSeconds' in data
      ? Number((data as { retryAfterSeconds?: unknown }).retryAfterSeconds)
      : 0;
    const retryAfterSeconds = retryAfterHeader || retryAfterBody || undefined;
    throw new ApiError(message, res.status, retryAfterSeconds);
  }
  return data as T;
}

// ── Auth (OTP) ──────────────────────────────────────────────────────────
export const authApi = {
  sendOtp: (email: string, type: 'registration' | 'reset') =>
    request<{ success: boolean }>('/api/auth/otp/send', { method: 'POST', body: { email, type }, auth: false }),
  verifyOtp: (email: string, otp: string, type: 'registration' | 'reset') =>
    request<{ success: boolean }>('/api/auth/otp/verify', { method: 'POST', body: { email, otp, type }, auth: false }),
  resetPassword: (email: string, otp: string, newPassword: string) =>
    request<{ success: boolean }>('/api/auth/password/reset', { method: 'POST', body: { email, otp, newPassword }, auth: false }),
};

// ── Results / OCR ───────────────────────────────────────────────────────
export interface ExtractedCourse {
  code: string;
  title: string;
  units: number;
  grade?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  caScore?: number;
  examScore?: number;
  isAR?: boolean;
}

export const resultsApi = {
  /** Uploads a base64-encoded photo/PDF of a result slip; Gemini multimodal parses it.
   *  FIXED: web's real route (`app/api/results/extract/route.ts`) reads
   *  `base64Data` from the request body — this previously sent `file`,
   *  a field name the route never reads, so every extract call was
   *  silently returning "Missing file data" regardless of what was sent. */
  extract: (base64Data: string, mimeType: string) =>
    request<{ courses: ExtractedCourse[] }>('/api/results/extract', {
      method: 'POST',
      body: { base64Data, mimeType },
    }),
};

// ── Notifications ────────────────────────────────────────────────────────
export type NotificationEvent = 'semesterSaved' | 'degreeClass' | 'aiInsights';

export const notificationsApi = {
  /** Creates an inbox item and requests FCM delivery through the protected API. */
  send: (payload: {
    uid: string;
    title: string;
    message: string;
    type?: string;
    event?: NotificationEvent;
    data?: { url?: string };
  }) => request<{ success: boolean; message: string }>('/api/notifications/send', {
    method: 'POST',
    body: payload,
  }),
};

// ── Transcript ──────────────────────────────────────────────────────────
export const transcriptApi = {
  generate: (includePhoto: boolean) =>
    request<ArrayBuffer>('/api/transcript/generate', {
      method: 'POST',
      body: { showPhoto: includePhoto },
      responseType: 'arrayBuffer',
    }),
  share: (includePhoto = true) =>
    request<{ shareId: string; shareUrl: string }>('/api/transcript/share', {
      method: 'POST',
      body: { showPhoto: includePhoto },
    }),
};

// ── AI Insights ─────────────────────────────────────────────────────────
// FIXED: every method here previously sent the wrong request body and
// typed a response shape that doesn't exist on the real endpoint —
// confirmed by reading `app/api/ai/{insights,forecast,whatif}/route.ts`
// directly, not assumed. This is almost certainly why Written Analysis,
// Forecast, and What-If all appeared broken/empty in practice.
export interface InsightsResponse {
  strengths: string[];
  concerns: string[];
  recommendations: string[];
  degreeOutlook: string;
}

export interface AcademicInsightContext {
  remainingSemesters: number;
  isGraduated: boolean;
  graduationSession?: string;
}

export interface ForecastResponse {
  slope: number;
  projected: [number, number];
  projectedPi: [number, number];
  projectedCgpa: [number, number];
  riskScore: number;
  trendLabel: string;
  trendDirection?: 'improving' | 'declining' | 'stable';
  lastUpdated?: unknown;
}

export interface WhatIfResponse {
  requiredGPA: number;
  requiredAvgScore: number;
  feasibilityNote: string;
}

export const aiApi = {
  /** Academic context keeps written guidance inside the student's real programme timeline. */
  insights: (forceRegenerate: boolean, semesterData: unknown, academicContext?: AcademicInsightContext) =>
    request<InsightsResponse>('/api/ai/insights', {
      method: 'POST',
      body: { forceRegenerate, semesterData, academicContext },
    }),
  /** Web requires BOTH `piHistory` and `cgpaHistory` — sending only one silently produces a degraded/wrong forecast. */
  forecast: (piHistory: number[], cgpaHistory: number[], forceRegenerate = false) =>
    request<ForecastResponse>('/api/ai/forecast', { method: 'POST', body: { piHistory, cgpaHistory, forceRegenerate } }),
  /** Web requires `currentCGPA` and `totalCredits` too — omitting them returns a 400. */
  whatIf: (currentCGPA: number, totalCredits: number, targetCGPA: number, remainingSemesters: number, creditLoad: number) =>
    request<WhatIfResponse>('/api/ai/whatif', {
      method: 'POST',
      body: { currentCGPA, totalCredits, targetCGPA, remainingSemesters, creditLoad },
    }),
};

// ── Account ─────────────────────────────────────────────────────────────
// NOTE: FCM token removal is NOT an API route (see lib/firebase/fcm.ts for
// why) — it's a direct Firestore write, so there's no userApi entry for it.
export const userApi = {
  deleteAccount: () => request<{ success: boolean }>('/api/user/delete-account', { method: 'POST' }),
};

export { ApiError };
