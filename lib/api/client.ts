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
 *   /api/notifications/send            POST (server-triggered, not called from client)
 *   /api/results/extract               POST  (AI OCR)
 *   /api/transcript/generate           POST
 *   /api/transcript/share              POST
 *   /api/user/delete-account           DELETE
 *
 * Base URL is configured via EXPO_PUBLIC_API_BASE_URL — set to
 * https://acadegrade.vercel.app in production.
 */
import { getIdToken } from '@/lib/firebase/auth';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://acadegrade.vercel.app';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const { method = 'GET', body, auth = true } = options;
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

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status);
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
  grade?: string;
  caScore?: number;
  examScore?: number;
}

export const resultsApi = {
  /** Uploads a base64-encoded photo/PDF of a result slip; Gemini multimodal parses it. */
  extract: (base64File: string, mimeType: string) =>
    request<{ courses: ExtractedCourse[] }>('/api/results/extract', {
      method: 'POST',
      body: { file: base64File, mimeType },
    }),
};

// ── Transcript ──────────────────────────────────────────────────────────
export const transcriptApi = {
  generate: (includePhoto: boolean) =>
    request<{ pdfBase64: string }>('/api/transcript/generate', {
      method: 'POST',
      body: { includePhoto },
    }),
  share: () =>
    request<{ shareId: string; url: string }>('/api/transcript/share', { method: 'POST' }),
};

// ── AI Insights ─────────────────────────────────────────────────────────
export interface InsightsResponse {
  summary: string;
  riskCourses: { code: string; grade: string }[];
  generatedAt: string;
  cooldownEndsAt: string;
}

export const aiApi = {
  insights: (force = false) =>
    request<InsightsResponse>('/api/ai/insights', { method: 'POST', body: { force } }),
  forecast: (piHistory: number[]) =>
    request<{ projectedCGPA: number; projectionPoints: { label: string; value: number }[] }>(
      '/api/ai/forecast',
      { method: 'POST', body: { piHistory } }
    ),
  whatIf: (targetCGPA: number, remainingSemesters: number, creditLoad: number) =>
    request<{ requiredGPA: number; achievable: boolean }>('/api/ai/whatif', {
      method: 'POST',
      body: { targetCGPA, remainingSemesters, creditLoad },
    }),
};

// ── Account ─────────────────────────────────────────────────────────────
// NOTE: FCM token removal is NOT an API route (see lib/firebase/fcm.ts for
// why) — it's a direct Firestore write, so there's no userApi entry for it.
export const userApi = {
  deleteAccount: () => request<{ success: boolean }>('/api/user/delete-account', { method: 'DELETE' }),
};

export { ApiError };
