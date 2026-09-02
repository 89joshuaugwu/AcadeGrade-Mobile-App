# Architecture

## Data flow

The mobile app never talks to its own backend — there isn't one. Every
screen either:

1. Reads/writes **Firestore directly** via `@react-native-firebase/firestore`
   (semesters, courses, user profile, preferences) — same collections,
   same document shapes as web, verified against `types/*.ts` in the web repo.
2. Calls the **existing Next.js API routes** at `acadegrade.vercel.app` via
   `lib/api/client.ts` for anything that needs a server (AI insights/forecast/
   what-if, OCR extraction, PDF generation, OTP, account deletion).
3. Reads **Realtime Database** for low-latency notification state.

```
┌─────────────────┐        Firebase ID token         ┌──────────────────────┐
│  Expo app        │ ───────────────────────────────▶ │  Next.js API routes   │
│  (this repo)     │ ◀─────────────────────────────── │  (existing, unchanged)│
└────────┬─────────┘         JSON responses            └──────────┬───────────┘
         │                                                          │
         │ @react-native-firebase (native SDK)         Firebase Admin SDK
         ▼                                                          ▼
┌────────────────────────────────────────────────────────────────────┐
│                    Firestore + Realtime Database                    │
│   users/{uid}, users/{uid}/semesters/{id}/courses/{id}, notifications│
└────────────────────────────────────────────────────────────────────┘
```

## Auth model

- Firebase ID token (from `@react-native-firebase/auth`) is attached as
  `Authorization: Bearer <token>` on every API call — same header pattern
  the API routes already expect from web.
- Google Sign-In uses `@react-native-google-signin/google-signin` +
  `auth.GoogleAuthProvider.credential()`, **not** `signInWithPopup` (doesn't
  exist on native).
- Root layout (`app/_layout.tsx`) resolves auth state AND the Firestore
  profile doc before hiding the splash screen — this is what prevents a
  flash of the wrong screen on cold start.

## Real-time recalculation

`app/(tabs)/results/[semesterId].tsx` subscribes to the courses subcollection
with `onSnapshot`. Every time courses change, it:
1. Recomputes course metrics client-side with the ported `computeCourseMetrics`
2. Recomputes semester GPA/PI with `computeSemesterGPA`
3. Writes the aggregate back to the semester document

This mirrors the "instant recalculation, not a round trip" requirement from
the design spec — the GPA preview in the Add Course modal is pure client-side
math with no network call at all.

## AI feature cooldown

The 12-hour cooldown on `/api/ai/insights` is **enforced server-side**. The
countdown timer in `insights.tsx` is a UI convenience only — it reads
`cooldownEndsAt` from the API response and counts down locally. If the app
is closed and reopened mid-cooldown, the next `loadInsights()` call will get
a fresh `cooldownEndsAt` (or a 429) from the server — the client never
invents or extends the cooldown itself.

## Needs your input before this ships

These aren't bugs — they're things only you can supply:

1. **Firebase native app registration.** The web project (`penwork-49470`-style
   Firebase project, but this one's own project) needs an iOS App ID and an
   Android App ID registered *inside the same Firebase project* the web app
   uses. Download `GoogleService-Info.plist` and `google-services.json` from
   the Firebase console and drop them at the repo root (referenced in
   `app.json`).
2. **Google Sign-In OAuth client IDs** — `EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID`
   in `lib/firebase/auth.ts`, and the reversed iOS client ID placeholder in
   `app.json`'s plugin config.
3. **RTDB notification path.** `lib/store` (profile.tsx's `useNotifications`)
   assumes a `notifications/{uid}` RTDB path. Confirm this against whatever
   the web app's actual RTDB writer uses — I inferred the *existence* of a
   notifications RTDB tree from `01_CONTEXT.md` §5 ("RTDB used specifically
   for low-latency notification unread counts") but the zip didn't include
   an `lib/firebase/rtdb.ts` file to verify the exact path/shape against.
   **Don't skip this check** — a wrong path means the bell silently never
   shows anything, no error thrown.
4. **Cloudinary unsigned upload preset name** for avatars — I used
   `acadegrade_avatars` as a placeholder in `profile.tsx`; confirm the real
   preset name from your Cloudinary dashboard or web env vars.
5. **App icon, splash image, adaptive icon** — `app.json` references
   `./assets/icon.png` etc. that don't exist yet.
6. **EAS project ID** for builds — not yet configured (see SETUP.md).

## Explicitly out of scope (per the build spec)

Admin console, public marketing site, calculator page, client-side PDF
generation, Three.js decorative backgrounds, light mode. None of this was
built, and none of it should be.
