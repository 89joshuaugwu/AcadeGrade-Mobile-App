# Master Prompt â€” Paste this into your AI coding agent (Antigravity / Cursor / Claude Code)

You are building **AcadeGrade Mobile**, a native student-facing companion app
to an existing production Next.js web app called AcadeGrade.

Two supporting documents are provided alongside this prompt:
- `01_CONTEXT.md` â€” the existing web app's architecture, data model, API
  routes, and what must NOT be rebuilt
- `02_DESIGN.md` â€” the full UI/UX, navigation, animation, and design token spec

**Before writing a single line of code**, open and read the reference folder
(the extracted existing web app repo, provided alongside this prompt) â€”
specifically `types/`, `lib/cgpa/`, `lib/utils/constants.ts`,
`lib/firebase/`, `app/api/`, `app/(student)/`, `app/globals.css`, and
`docs/project_handover/2_student_features.md`. Confirm you understand the
existing grading logic, data shapes, and API contracts before scaffolding
anything. Do not invent a data model or endpoint that isn't already there â€”
this is a client for an existing backend, not a new product.

## Non-negotiables

1. **Student-only.** No admin features. No public marketing pages. This app
   has exactly one audience: authenticated students.
2. **Reuse the existing backend as-is.** All 18 API routes under `app/api/`
   already work in production. Call them. Do not create new ones unless a
   student feature genuinely has no existing route (flag it to me if so,
   don't silently invent one).
3. **Port `types/*.ts` and `lib/cgpa/*.ts` verbatim** â€” these are the grading
   math and data shapes. Zero changes to the logic, only changes to satisfy
   RN's module system if needed.
4. **Match the existing design tokens exactly** (colors, in `02_DESIGN.md`
   Â§1) â€” don't design a new palette.
5. **Match or exceed every feature** listed in
   `docs/project_handover/2_student_features.md` â€” Dashboard, Results
   (manual + AI OCR + share codes), Transcript (PDF + share), AI Insights
   (forecast + what-if + risk analysis), Notifications, Settings. Nothing
   gets dropped in the port.
6. **Use `@react-native-firebase/*` (native modules), not the `firebase/*` web
   SDK** â€” for Auth, Firestore, and Messaging. Reference `01_CONTEXT.md` Â§7 for
   why.

## Tech stack to scaffold

Expo + Expo Router Â· TypeScript Â· NativeWind v4 Â· React Native Reanimated +
Gesture Handler Â· react-native-svg Â· @react-native-firebase (app, auth,
firestore, messaging) Â· Zustand Â· TanStack Query Â· @gorhom/bottom-sheet Â·
lottie-react-native Â· expo-sharing, expo-file-system, expo-image-picker,
expo-haptics.

## Build order (build and verify each stage before moving to the next â€” don't scaffold all screens empty and fill in later)

1. **Project scaffold + design tokens** â€” Expo Router file structure, NativeWind
   config with the exact color tokens from `02_DESIGN.md` Â§1, base `Button`,
   `Card`, `Input`, `Badge` components matching the visual language of the
   existing `components/ui/*` (read those files for reference, rebuild in RN).
2. **Auth flow** â€” login, register, OTP verify, Google sign-in via
   `@react-native-firebase/auth`, splash-to-authed-state resolution with no
   flash of the wrong screen.
3. **Dashboard** â€” CGPAArc (react-native-svg + spring animation), KPI cards
   (staggered entrance), trend chart, metric toggle, degree-class milestone
   celebration (Lottie), share button.
4. **Results & semester management** â€” list with swipe actions, add/edit
   course forms with real-time recalculation, AI OCR camera flow hitting
   `/api/results/extract`, course share codes.
5. **Transcript** â€” generate via `/api/transcript/generate`, photo-embed
   toggle, share sheet, public share link creation.
6. **AI Insights** â€” forecast tab, what-if slider with haptics, risk analysis,
   written analysis with typing reveal, 12-hour cooldown UI.
7. **Notifications** â€” real-time Firestore/RTDB listener, FCM registration via
   `@react-native-firebase/messaging`, foreground toast.
8. **Settings** â€” avatar upload (Cloudinary, `expo-image-picker`), preference
   toggles, password change, delete-account flow with re-auth.

## After each stage

Show me the working screen/flow and confirm against the corresponding section
of `docs/project_handover/2_student_features.md` before proceeding â€” I don't
want to discover a dropped feature at the end.

## Explicitly out of scope â€” do not build these

Admin console, public marketing site, calculator page (that stays web-only),
client-side PDF generation (call the existing API instead), Three.js
decorative backgrounds, light mode.

# AcadeGrade Mobile â€” Project Context

## 0. Instructions for the AI agent (read first)

Before writing any code, **inspect the provided reference folder** (the extracted
`acadegrade-fy-project-updated.zip`, the existing production Next.js web app) at
these paths and actually read the files â€” do not guess their contents:

- `types/*.ts` â€” canonical data shapes. Port these 1:1, do not redesign them.
- `lib/cgpa/*.ts` â€” grading/CGPA/PI math. Port this logic verbatim (it's pure
  TypeScript, framework-agnostic).
- `lib/utils/constants.ts` â€” grade scale, degree class thresholds, app name/tagline.
- `lib/firebase/*.ts` â€” see how auth, Firestore, RTDB, and FCM are currently wired.
  You will NOT reuse this file directly (web SDK â‰  RN), but the *shape* of every
  call (what collections, what fields, what functions exist) must match exactly.
- `app/api/**/route.ts` â€” this is the backend. All 18 routes already exist and are
  live in production. The mobile app is a client of these routes â€” do not
  reinvent them, do not create parallel endpoints.
- `app/(student)/**` â€” the actual current UI/UX and feature behavior to match
  (and exceed) on mobile.
- `app/globals.css` â€” the full design token system (colors, type scale). Reuse
  these exact values, don't invent a new palette.
- `docs/project_handover/2_student_features.md` â€” full feature audit of
  everything a student user can do. This is the mobile app's feature scope.

If anything is ambiguous, prefer matching the existing web behavior over
inventing new behavior â€” this is a port + upgrade, not a redesign of what the
app *does*.

---

## 1. What this product is

**AcadeGrade** â€” AI-powered CGPA and academic performance tracker for Nigerian
university students (Nigerian 5-point grading scale). Currently a Next.js 16
web app (App Router) with three route groups:

- `(public)` â€” marketing, calculator, login/register â€” **stays web-only**
- `(admin)` â€” platform admin console â€” **stays web-only**
- `(student)` â€” the authenticated student experience â€” **this is what we're
  building as a native mobile app**

The mobile app is **student-only**. No admin functionality. Admin and public
marketing remain the web app's job forever.

## 2. Existing tech stack (web)

Next.js 16.2.9 Â· React 19.2.7 Â· Tailwind CSS v4 Â· Firebase (Auth, Firestore,
Realtime Database, Cloud Messaging, Admin SDK) Â· Groq/Gemini/DeepSeek for AI
features Â· `simple-statistics` for forecasting Â· `jspdf` for transcript PDFs
(web-only, mobile will call the existing PDF API instead) Â· Cloudinary for
avatar uploads Â· Nodemailer for email.

## 3. Target mobile stack

- **Expo (React Native) + Expo Router** â€” file-based routing, matches the
  mental model of the existing Next.js App Router
- **NativeWind v4** â€” Tailwind syntax on RN, lets us port `globals.css` design
  tokens directly instead of re-deriving a new theme
- **React Native Reanimated + Gesture Handler** â€” all animations and gestures
- **react-native-svg** â€” for CGPAArc, charts, radial progress (replaces web SVG)
- **@react-native-firebase/app, /auth, /firestore, /messaging** â€” native
  Firebase modules (NOT the `firebase/*` web SDK â€” it does not persist auth
  sessions or handle push reliably on RN)
- **Zustand** â€” lightweight client state (mirrors what Context/hooks do on web)
- **TanStack Query** â€” server state/caching for API route calls
- **Lottie (`lottie-react-native`)** â€” celebratory/success micro-animations
  (e.g. degree class upgrade, CGPA milestone)
- **expo-sharing / expo-file-system** â€” replaces Web Share API + client PDF gen

## 4. Backend â€” do not rebuild this

The mobile app talks to the **same production API routes** the web app already
uses. Authentication is via Firebase ID token in the `Authorization` header â€”
same pattern the API routes already expect. Relevant routes:

| Route | Purpose |
|---|---|
| `POST /api/auth/otp/send`, `/verify` | OTP flow |
| `POST /api/auth/password/reset` | Password reset |
| `POST /api/results/extract` | AI OCR of result slip photo â†’ parsed courses (Gemini multimodal) |
| `POST /api/ai/insights`, `/forecast`, `/whatif` | AI academic insights (12h cooldown enforced server-side) |
| `POST /api/transcript/generate` | Returns generated PDF â€” mobile just downloads/shares it, does NOT generate PDF client-side |
| `POST /api/transcript/share` | Public share link creation |
| `POST /api/notifications/send` | Push (server calls this; mobile just registers its token) |
| `DELETE /api/user/fcm-token`, `/api/user/delete-account` | Account/session management |

## 5. Data model (Firestore/RTDB) â€” unchanged

- `users/{uid}` â€” profile, settings, `fcmTokens: string[]` (array â€” supports
  multiple simultaneous devices; append on login, remove specific token on
  logout, prune dead tokens on send failure)
- Semesters/courses subcollections per the shapes in `types/course.ts`,
  `types/semester.ts`
- RTDB used specifically for low-latency notification unread counts

## 6. Grading rules (must match exactly)

Nigerian 5-point scale: A(70â€“100)=5, B(60â€“69)=4, C(50â€“59)=3, D(45â€“49)=2,
E(40â€“44)=1, F(0â€“39)=0.

Degree classes: First (4.5â€“5.0) Â· 2:1 (3.5â€“4.49) Â· 2:2 (2.4â€“3.49) Â·
Third (1.5â€“2.39) Â· Pass (below 1.5, exact lower bound per `lib/utils/constants.ts`).

Both **CGPA** (official) and **PI / Performance Index** ("True Mastery") are
tracked in parallel â€” the user can toggle which is primary. Don't drop PI.

## 7. Auth realities on mobile (differs from web)

- Web uses `signInWithPopup` for Google â€” **does not work on RN**. Use
  `@react-native-google-signin/google-signin` + Firebase native credential
  exchange, or Expo `AuthSession`.
- Session persistence must use `@react-native-firebase/auth`'s native
  persistence â€” do not attempt to port the web SDK's `onAuthStateChanged`
  pattern verbatim; the concept is the same, the implementation differs.
- FCM device tokens come from `@react-native-firebase/messaging` â€” different
  token format from web push, but slot into the exact same `fcmTokens` array
  and the exact same append/remove/prune backend logic already in production.

## 8. Environment variables (existing web project â€” Vercel)

These already exist on the web project. Reference for the agent so it knows
what's available and doesn't invent placeholder keys â€” **never print or
request actual values**, only use the names below to know what integrations
exist:

| Variable | Used for | Mobile relevance |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase client config | Yes â€” same Firebase project, but on Expo use `EXPO_PUBLIC_` prefix instead of `NEXT_PUBLIC_` for client-exposed values |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase client config | Yes, same as above |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase client config | Yes |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase client config | Yes |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase client config | Yes |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase client config | Web app ID â€” mobile needs its **own** Firebase App ID per platform (a separate iOS App ID and Android App ID registered in the same Firebase project), not this one |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Web push (VAPID) | **Not used on mobile** â€” native FCM via `@react-native-firebase/messaging` doesn't need a VAPID key, that's web-push-specific |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | RTDB client config | Yes |
| `FIREBASE_PROJECT_ID` | Server-side (Admin SDK) | Backend-only â€” mobile never touches this, it lives in the existing API routes |
| `FIREBASE_CLIENT_EMAIL` | Server-side (Admin SDK) | Backend-only |
| `FIREBASE_PRIVATE_KEY` | Server-side (Admin SDK) | Backend-only â€” remember the `\n` â†’ real newline conversion quirk if this ever needs touching |
| `GMAIL_USER` / `GMAIL_PASS` | Nodemailer email | Backend-only |
| `OTP_GMAIL_USER` / `OTP_GMAIL_PASS` | OTP email delivery | Backend-only â€” mobile just calls `/api/auth/otp/send` |
| `INSIGHT_GEMINI_KEY` | AI insights generation | Backend-only |
| `GEMINI_API_KEY` / `GEMINI_API_KEY_2` | Gemini AI features (incl. OCR extraction) | Backend-only |
| `OPENROUTER_API_KEY` | Current AI routing layer | Backend-only |
| `GROQ_API_KEY_1` / `GROQ_API_KEY_2` | Groq AI inference | Backend-only |
| `DEEPSEEK_API_KEY_1` | Legacy â€” likely unused now that OpenRouter is the routing layer; confirm before assuming it's live | Backend-only, and possibly dead |
| `CLOUDINARY_CLOUD_NAME` | Avatar/media uploads | Yes â€” mobile's `expo-image-picker` upload flow needs the cloud name + the existing unsigned upload preset (preset name itself isn't in this list â€” pull it from `lib/` or ask Joshua) |

**Key takeaway for the agent**: every server-side-only key above (Firebase
Admin, email, all AI provider keys) stays exactly where it is â€” inside the
existing Next.js API routes. The mobile app never sees these. It only ever
needs the `NEXT_PUBLIC_FIREBASE_*` equivalents (renamed to `EXPO_PUBLIC_*`)
for direct Firebase client/native-SDK access, plus `CLOUDINARY_CLOUD_NAME` if
doing direct unsigned uploads the same way web does.

## 9. What does NOT get rebuilt on mobile

- Anything under `(admin)` â€” never
- Anything under `(public)` â€” marketing/calculator/login-register pages stay
  web (mobile has its own native login screen instead, hitting the same auth backend)
- Client-side PDF generation â€” call `/api/transcript/generate` instead
- Three.js decorative backgrounds (`KnowledgeCoreBackground`, `OrbitingTechStack`)
  â€” skip entirely on mobile, they're desktop decoration, not functional UI, and
  are battery-expensive on native

# AcadeGrade Mobile â€” Design & UX Spec

**Goal: the mobile app should feel more premium and more fluid than the web
version, not just a port of it.** Web has flashy decorative backgrounds; mobile
should win instead on *motion quality*, *gesture responsiveness*, and *native
feel* â€” the things a web app structurally can't do as well.

## 1. Design tokens â€” pull these exactly from `app/globals.css`, do not invent new ones

```
Background layers: void #07090F, deep #0E1322, surface #141B2E, overlay #1A243D
Borders:           #1F2B47 (default), #162038 (subtle)
Primary (Electric Indigo): #6366F1, hover #4F46E5, glow #818CF8, dim #1e1b4b
Accent (Nigerian Gold):    #F59E0B, hover #D97706, dim #1C1005
Semantic: success #22C55E, danger #EF4444, warning #F59E0B, info #38BDF8
Text: primary #E8EDFF, muted #8892B0, faint #4A5580

Grade colors:  A #22C55E Â· B #6366F1 Â· C #F59E0B Â· D #F97316 Â· E #EF4444 Â· F #6B7280
Degree class:  First #22C55E Â· 2:1 #6366F1 Â· 2:2 #F59E0B Â· Third #F97316 Â· Pass #EF4444
```

Dark-first design (the whole existing app is dark-mode by default). Keep it
dark-first on mobile too â€” this is a deliberate brand choice, not a gap to fill
with a light mode.

## 2. Navigation structure

Bottom tab bar (native feel, not a ported sidebar):

```
[Dashboard] [Results] [Insights] [Transcript] [Notifications/Profile]
```

- Use **Expo Router** with a `(tabs)` group â€” mirrors the existing `(student)`
  route group mental model from the web app almost exactly.
- Tab bar: floating/pill-style with a soft glow on the active icon (indigo
  glow, matches `--acade-primary-glow`), not a flat Material default.
- Nested stacks per tab (e.g. Results â†’ Semester Detail â†’ Add Course) use
  **native slide/push transitions** â€” iOS gets swipe-back gesture, Android
  gets Material shared-axis transition. Don't hardcode one platform's pattern
  for both (this is the #1 thing that makes a cross-platform app feel wrong).
- Modals (Add Course, Settings sub-screens) use bottom-sheet presentation
  (`@gorhom/bottom-sheet`) with rubber-band drag-to-dismiss â€” not full-screen
  page pushes.

## 3. Screen-by-screen spec

### Onboarding / Auth
- Animated splash â†’ logo scale+fade in (Reanimated), then straight to
  login/register if no session, or Dashboard if session exists (no flash of
  wrong screen â€” resolve auth state before first paint).
- Login: email/password + Google. OTP flow for verification matches existing
  web behavior (`/api/auth/otp/*`).
- Micro-interaction: input focus triggers a soft border glow transition
  (150â€“200ms), not an abrupt color snap.

### Dashboard
- **CGPAArc**: rebuild as an animated radial progress ring using
  `react-native-svg` + Reanimated â€” arc fills with a spring animation on load
  (not a linear tween â€” should feel alive, slight overshoot then settle).
- Degree class badge: subtle pulse/glow if the user just crossed into a new
  class (ties to the "automatic degree-class-change alert" feature already in
  the backend) â€” celebrate this moment, a full-screen Lottie confetti burst is
  appropriate here specifically since it's a genuine milestone.
- KPI cards (Total Credits, Semester GPA, Courses Completed, At-Risk count):
  staggered fade+slide-up entrance (each card offset ~40ms from the previous)
  rather than all appearing simultaneously.
- Trend chart: animate the line draw-on on first view.
- Metric toggle (CGPA/PI): animated segmented control, not a plain switch.
- "Share Progress": native share sheet via `expo-sharing`.

### Results & Semester Management
- Semester list: swipe-to-delete / swipe-to-edit list items (native gesture,
  matches iOS Mail / Android Gmail conventions).
- Add Course form: real-time GPA/PI recalculation as the user types â€” this
  already happens on web, must feel instant on mobile too (optimistic local
  calc, not waiting on a round trip).
- **AI OCR result import**: camera/photo picker â†’ upload to `/api/results/extract`
  â†’ show a skeleton/shimmer loading state â†’ populate parsed courses into an
  editable review list before saving (never auto-save unreviewed AI extraction).
- Course share codes: native share sheet + a dedicated "Enter Code" input with
  a satisfying confirm animation on valid code.

### Transcript
- "Generate" triggers `/api/transcript/generate`, shows a progress state, then
  either opens the native PDF viewer or triggers `expo-sharing` share sheet.
- Photo-embed toggle: same as web, but preview the avatar inline before generating.

### Insights (AI)
- 12-hour cooldown countdown: live-updating, matches web's rate-limit UX
  exactly (server enforces it â€” this is UI treatment only, not lying to the user).
- Forecast tab: animate the dashed projection line drawing in after the actual
  data line settles.
- What-If calculator: a draggable slider (Reanimated gesture) with haptic
  feedback (`expo-haptics`) on each whole-CGPA-point crossed â€” this is a place
  where mobile can genuinely feel *better* than a web slider.
- Written AI analysis: keep the typing/character-reveal animation from web,
  it works well and is cheap to port conceptually.

### Notifications
- In-app bell â†’ list with unread state synced via Firestore/RTDB listener
  (real-time, not poll-based).
- New notification arrival: subtle slide-in-from-top toast if app is foregrounded.

### Settings
- Avatar upload via Cloudinary unsigned preset (same as web) using
  `expo-image-picker`.
- Destructive actions (Delete Account) require a native confirmation sheet
  with re-authentication, matching the existing security flow â€” never make
  destructive actions easier on mobile than they are on web.

## 4. Motion principles (apply everywhere, not just the screens above)

1. **Spring over linear** â€” default to spring physics (Reanimated's
   `withSpring`) for anything that represents a value change (progress rings,
   counters, list reordering). Use `withTiming` only for simple fades/opacity.
2. **Stagger, don't simultaneity** â€” when multiple elements enter together,
   offset them slightly. It reads as more intentional and less like a layout
   dump.
3. **Haptics on meaningful moments only** â€” grade saved, milestone crossed,
   swipe-action confirmed. Not on every tap â€” that gets annoying fast.
4. **Skeleton screens, not spinners**, for anything hitting the network
   (AI insights, OCR extraction, transcript generation) â€” matches the
   existing `SkeletonCard` pattern from the web app, just rebuilt in RN.
5. **Respect reduced motion** â€” the web app already has a
   `useReducedMotion` hook; port the same accessibility intent on mobile via
   `AccessibilityInfo.isReduceMotionEnabled()`.

## 5. What makes this "superior to web," concretely

- Native gestures (swipe actions, pull-to-refresh on Dashboard/Results,
  drag-to-dismiss sheets) â€” the web app can't do these at all.
- Haptic feedback â€” web has zero equivalent.
- Real push notifications with native OS integration (grouping, actions) vs.
  browser push.
- Camera-first OCR flow (direct camera capture, not "upload a file") for
  result-slip scanning.
- Instant app open (no cold Next.js hydration) â€” splash-to-interactive should
  be near-instant.

# UI/UX Upgrade â€” 2026 Mobile Design Research Applied

Sourced from current (mid-2026) mobile design research before touching any
code. Five sources cross-referenced, common threads pulled out below. Every
change below builds ON your existing brand colors (`#6366F1` indigo,
`#F59E0B` gold) â€” nothing was recolored, only how surfaces and motion are
presented changed.

## What the research actually said

1. **Liquid Glass, not flat cards.** Apple's 2026 evolution of Glassmorphism
   â€” translucent surfaces with a light-catching border, not static frosted
   panels. "Designers must balance translucency with legibility, using
   controlled blur levels and subtle light borders instead of solid colors."
2. **Bento-grid, modular dashboards** â€” variable-size tiles that direct
   attention by size/weight, not a uniform card grid.
3. **Micro-interactions signal intelligence, not just delight.** "We're past
   the era of bounce animations. In 2026, micro-interactions communicate
   system intelligence." A shimmer that sweeps like it's actively reading
   data beats a generic spinner.
4. **Progressive disclosure over crowded dashboards.** "Complex data is
   presented through scrollytelling instead of crowded dashboards, making
   information easier to consume."
5. **Home screens are becoming smart hubs, not static dashboards** â€” a
   contextual, data-driven nudge instead of a plain "Welcome back" header.
6. **Accessible design is a named 2026 trend in its own right**, not an
   afterthought â€” which is why the contrast fix from the previous review
   got folded into this pass rather than left for later.

## What actually changed (files)

| New/changed file | What it does |
|---|---|
| `constants/theme.ts` | Added `glass` token set (translucency/border/wash values built from your existing brand hex codes) |
| `components/ui/GlassCard.tsx` | **New.** BlurView + light-catching border, replaces flat `Card` on Dashboard and Insights |
| `components/ui/Shimmer.tsx` | **New.** Gradient-sweep skeleton for AI loading states â€” replaces plain spinners |
| `components/ui/AIPulseBadge.tsx` | **New.** Pulsing-dot indicator for "AI is live here" â€” Insights + Dashboard outlook |
| `components/dashboard/BentoGrid.tsx` | **New.** Variable-size tile system (`half`/`third`/`full` spans) |
| `components/dashboard/SmartNudge.tsx` | **New.** Computes one contextual line from real on-device data (at-risk courses â†’ degree-class proximity â†’ unfetched insight), not a generic banner |
| `app/(tabs)/dashboard.tsx` | Rebuilt around the bento grid + glass hero tile + smart nudge + collapsible AI outlook card |
| `app/(tabs)/_layout.tsx` | Tab bar now uses a BlurView background (glass pill) instead of flat surface color |
| `app/(tabs)/insights.tsx` | Written Analysis card is now glass + AI-pulse badge + shimmer while loading, instead of a flat card + plain text |
| Multiple files | `textFaint` (2.75:1 contrast, fails WCAG AA) swapped for `textMuted` (6.43:1) anywhere it carried actual body copy â€” kept only for pure decoration |

## What did NOT change

- Your brand hex values â€” indigo, gold, all semantic colors, untouched
- The CGPA/PI math, Firestore schema, API contracts â€” none of this is a
  visual-layer concern, so none of it was touched
- Results screen course list and semester detail â€” these are functional
  data-entry screens where "boring and unambiguous" is correct UX; I didn't
  glass-ify or bento-ify screens where speed of data entry matters more than
  visual flourish. Applying trends everywhere regardless of context is
  itself the mistake research warns against ("evaluate whether the trend
  supports business goals... not blindly copy trends").

## Honest limitation, same as last time

I still haven't run this in a simulator â€” the components are correct
React Native/Reanimated/expo-blur usage (verified: brace-balanced, correct
imports, no undefined references), but "compiles and is structurally sound"
and "looks and feels great on a real device" are different bars. BlurView
performance in particular is worth checking on a mid-range Android device
specifically â€” glass effects are the first thing to visibly stutter on
weaker GPUs, and that's a real risk with this pattern that the research
itself flags implicitly (Apple ships Liquid Glass on hardware with strong
GPUs; budget Android phones are a different story).

## Round 2 â€” Auth flow upgrade (acadegrade-ui-upgrade-prompt.md Â§1)

| New/changed file | What it does |
|---|---|
| `components/ui/AuthGlow.tsx` | **New.** Two slow-drifting blurred color blobs (primaryGlow + gold, existing tokens) behind auth screens â€” replaces flat `colors.void` background per the prompt's "shouldn't be a plain void" note |
| `components/ui/HeroArt.tsx` | **New.** Animated icon-in-a-pulsing-ring, built from `lucide-react-native` + `react-native-svg` + Reanimated. Replaces both the emoji hero art AND the `assets/lottie/` folder, which the prompt correctly flagged as mistakenly containing font files, not Lottie JSON. No new dependency, matches the prompt's own fallback option ("SVG built from the existing icon set") |
| `components/ui/SuccessCheck.tsx` | **New.** Checkmark draw-in (ring, then stroke) via `strokeDashoffset` â€” same animation technique as `CGPAArc` elsewhere in the app, for motion-language consistency. Replaces the static âœ… emoji on the password-reset success screen |
| `app/(auth)/welcome.tsx` | AuthGlow background; `HeroArt` per slide instead of emoji; parallax scale/opacity/translateY on inactive carousel slides (was a hard cut); staggered CTA entrance |
| `app/(auth)/login.tsx` | AuthGlow background; form fields wrapped in one `GlassCard`; staggered per-field `FadeInDown` entrance. Auth logic/error mapping unchanged |
| `app/(auth)/register.tsx` | Same treatment; step transition (details â†’ OTP) now fades instead of hard-swapping. OTP/Firestore-write logic unchanged â€” same user-doc shape web writes |
| `app/(auth)/forgot-password.tsx` | Same treatment; success screen uses `SuccessCheck` instead of a static emoji |
| `app/(auth)/onboarding-tour.tsx` | AuthGlow background; `HeroArt` instead of emoji; preference row now a `GlassCard`. Firestore write unchanged |
| `assets/lottie/` | **Removed.** Contained font files by mistake (not Lottie JSON, per the prompt's own note) and nothing referenced it â€” `HeroArt` replaces the need for it entirely |

**Not done yet** â€” Results, Profile, Transcript, and the global nav/tilt-effect
items from the same prompt (Â§2â€“5) are still on the flat `Card`/no-motion
treatment. Same reasoning as the original pass: sequencing matters more
than speed here, and this round was scoped to the auth flow (the "first
impression" the prompt calls out) plus the actual app-breaking bug fix
below. Next round continues with Results.

## Round 2 â€” also: the actual splash-hang bug

Unrelated to the UI work above, but discovered while investigating this
build: `@react-native-firebase/*` was pinned to `^21.6.1`, which predates
reliable support for the New Architecture that Expo SDK 57 / RN 0.86 makes
**mandatory** (confirmed via the package's own changelog: "All modules will
be converted to new architecture soon, old architecture support is
deprecated in general for react-native-firebase," plus an open GitHub issue
specifically about SDK 55+/newArch problems with v21). Bumped to `^25.1.0`
(current latest as of this session). This is a NATIVE dependency change â€”
**requires a full new `eas build`**, not just a JS bundle reload.

## Round 3 â€” logo + register flow (real bugs, not style)

User caught two things that were flatly wrong, not just unpolished â€” verified against `app/(public)/login/page.tsx` and `app/(public)/register/page.tsx` on the web before fixing, not guessed:

1. **No `<Logo>` anywhere.** Zero logo usage on any auth screen. The real
   brand asset was sitting unused in `assets/icon.png` the whole time â€”
   confirmed by MD5 checksum match against web's
   `public/android-chrome-512x512.png`, byte-identical. Built
   `components/ui/Logo.tsx` and wired it into welcome, login,
   forgot-password, register.
2. **Register was a single flat form.** Web's real flow: Google auth skips
   OTP entirely (already verified by Google) and goes straight to academic
   details; email auth requires `/api/auth/otp/send` â†’ code entry â†’
   `/api/auth/otp/verify` before continuing. The previous version of
   `app/(auth)/register.tsx` had neither the phasing nor the branching.
   Rebuilt as a proper 3-step wizard (Account+OTP â†’ Academic Details â†’
   Record Mode) with the Google-skip-OTP logic matching web exactly.
   Simplified from web's 4 steps â€” the "past semesters" review step (for
   users who pick "Complete Record") isn't built yet; noted as a follow-up,
   not silently dropped.
3. New: `components/ui/PickerField.tsx` (bottom-sheet searchable select,
   for university/department/programme â€” no equivalent existed) and
   `lib/data/academic-data.ts` (university/department/programme lists,
   copied from web's `lib/utils/academic-data.ts`).

**Not done yet, scoped for next rounds**: light/dark theme toggle system,
BizStock-style "More" bottom-sheet nav (replacing the current flat tab
row), a new Calendar/Events feature (not in the web app at all â€” genuinely
new), and re-skinning inspiration images 2â€“11 (structure reference only,
need our palette) vs images 12â€“16 (closest to actual brand already, useful
as a target reference for Dashboard/Results screens specifically).

## Round 4 â€” critical nav fix, dependency sync, and light-theme rebuild

### The actual crash (fixed before anything else)
`app/_layout.tsx`'s redirect effect only sent an already-authenticated,
already-onboarded user to the dashboard if they happened to already be
inside the `(auth)` group â€” never true on a cold app open, where
`segments` is empty at the bare root. Landed on Expo Router's "Unmatched
Route" screen forever, silently. Rewritten to redirect based on target
state instead of current segment.

### Dependency sync
- `package.json` replaced with the exact confirmed-working version set
  (Expo 57.0.9, RN 0.86.2, React 19.2.3, Reanimated 4.5.1).
- `babel.config.js`: Reanimated 4 moved its Babel transform out of
  `react-native-reanimated/plugin` into its own `react-native-worklets/plugin`
  package â€” confirmed against Reanimated's official v3â†’v4 migration docs
  before changing this, not guessed.

### Flow restructure + light theme
Per direct instruction, the auth flow is now Welcome (dark, matches the
inspiration's one dark panel + gives seamless native-splash continuity) â†’
Onboarding (new â€” didn't meaningfully exist before) â†’ Login/Register/Forgot
Password (all light, matching the inspiration's AuthPortal panel):

- **Welcome**: "Get Started" â†’ Onboarding. "Sign In" â†’ Login directly,
  skipping onboarding â€” per explicit instruction.
- **Onboarding**: new 3-slide flow (Skip, dot pagination, Continue â†’ last
  slide leads to Register, "Already have an account? Sign In" escape
  hatch throughout). Reference uses real photography; substituted with
  the existing `HeroArt` animated icon since no photo assets exist in
  this project â€” flagged, not silently swapped.
- **Login**: rebuilt to match the AuthPortal reference â€” segmented
  Login/Sign Up pill, icon-prefixed fields, password eye-toggle, single
  "Continue with Google." Apple sign-in from the reference intentionally
  dropped per instruction (native Apple auth was never wired up, and
  wasn't asked for).
- **Register**: simplified per direct request â€” was a 2-step OTP flow
  (send â†’ separate verify screen), now ONE form: name, email with an
  inline "Get Code" button, password, confirm password, and the OTP
  field, all submitted together. Google signup still bypasses
  password/OTP entirely (already verified by Google) and jumps to step 2.
  Same Firestore write shape as every previous version.
- **Forgot Password**: same card style as Login now, for consistency.

### New/changed components
- `constants/theme.ts` â€” added `lightColors`. Existing dark `colors` is
  untouched and still the default for every screen not rebuilt this round.
- `lib/store/themeStore.ts` â€” new. In-memory only (no
  `@react-native-async-storage` in the current dependency set, so it
  doesn't persist across cold launches yet â€” worth adding if that matters).
- `Input.tsx`, `Logo.tsx` â€” extended with an optional `themeColors`
  override, backward-compatible with every existing call site.
- `PickerField.tsx` â€” switched to light theme directly (its only consumer,
  Register step 2, is light now).
- `GoogleIcon.tsx` â€” new, was missing.
- Fixed a real bug found in passing: the Profile tab icon was a Bell
  (notification icon), not a Settings/gear icon.

### Explicitly NOT done this round â€” scope was too large for one pass
Dashboard, Results, Transcript, Insights, and Profile are **still on the
dark theme** and have not been touched. The BizStock-style "More"
bottom-sheet nav pattern is not built. These are the next round, in that
order â€” Dashboard first, since Round 3 already made progress there
(CGPAArc rebuilt as a gradient arc) before this round's redirect/flow work
took priority.

## Round 5 â€” the real routing fix, Dashboard/Profile rebuilds, Results/Transcript light conversion

### The actual "Unmatched Route" root cause (user-diagnosed, verified working)
My Round 4 fix improved the redirect logic but didn't address the deeper
issue: Expo Router had **no file matching the bare `/` route at all**, so
on cold open there was nothing to render before the `_layout.tsx` `useEffect`
redirect could fire â€” a race condition, not just bad branching logic. Fix:
added `app/index.tsx` using `<Redirect>` to resolve instantly on first
render, and registered it in the root `<Stack>`. The two mechanisms are
complementary: `index.tsx` handles cold-open, `_layout.tsx`'s `useEffect`
still handles auth state changes while the app is already running.

**Note**: the empty `insights/`/`profile/`/`transcript/` directory
collisions flagged in the same analysis don't exist in this codebase â€” likely
local-machine leftovers from earlier experiments. Worth deleting on the
dev machine directly if still present there.

### Welcome screen logo fix
Removed the generic graduation-cap icon inside a colored gradient badge â€”
redundant since our actual logo already has its own built-in color
gradient. Now shows the real logo directly with a soft shadow instead of
nesting it inside a mismatched second gradient.

### Dashboard â€” rebuilt again
Previous round's radial-gauge version replaced with the actual inspiration
layout (image 4, "UserDashboard"): greeting header, gradient hero card
(orangeâ†’purple, Current GPA + trend pills), Completed/Credits stat pair,
dismissible tour nudge, Recent Grades list, GPA Trend chart. Light theme.

### Profile â€” rebuilt to match the UserProfile reference
Avatar with edit badge, stats row, Institution card, Academic Preferences
(metric toggle, session, grade-alert switches), Account & Security,
Export Transcript, Log Out. Every piece of existing logic â€” Cloudinary
avatar upload, Firestore notification preferences, RTDB notification feed,
delete-account confirmation, sign-out + FCM token cleanup â€” preserved
exactly; only the layout and light theme are new. Also properly wired the
transcript export button (write PDF + native share sheet) instead of
leaving it as a stub â€” `expo-sharing` turned out to already be available.

### Results & Transcript â€” converted to light theme
Structure and logic unchanged, just the color tokens.

### Explicitly deferred, not forgotten
**Insights** stays on the dark "Liquid Glass" AI aesthetic (`GlassCard`) â€”
that's a deliberate distinct treatment for AI-specific surfaces, common
even in otherwise-light apps, and converting it properly needs more care
than this round had room for. **BizStock "More" nav** still not built â€”
next round.



## Part 4: Latest Technical Upgrades (August 2026)
### 1. AI Insights Fallback Cascade
The AI provider cascade in "lib/ai/manager.ts" has been fortified against provider outages (like OpenRouter's removal of free Llama 70b models):
- **Try 1:** "openrouter/free" (Smart Auto-Router) — Throws explicit errors on empty string responses to ensure fallbacks trigger correctly instead of silently crashing the JSON parser.
- **Try 2:** "google/gemma-4-31b-it:free" via OpenRouter (Direct fallback model optimized for structured JSON outputs).
- **Try 3:** Google Gemini SDK directly (using "INSIGHT_GEMINI_KEY").
The depth-aware JSON extractor ("lib/utils/safeParseJSON.ts") remains isolated and is not mixed into the manager, preserving architectural cleanliness.

### 2. Firestore Writes vs API Side-Effects
When making data changes that trigger emails or push notifications (e.g. saving a semester), the mobile app must call the Next.js API routes (e.g. "/api/notifications/send") rather than writing directly to Firestore, to ensure all server-side side-effects fire.
