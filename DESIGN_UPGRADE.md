# UI/UX Upgrade — 2026 Mobile Design Research Applied

Sourced from current (mid-2026) mobile design research before touching any
code. Five sources cross-referenced, common threads pulled out below. Every
change below builds ON your existing brand colors (`#6366F1` indigo,
`#F59E0B` gold) — nothing was recolored, only how surfaces and motion are
presented changed.

## What the research actually said

1. **Liquid Glass, not flat cards.** Apple's 2026 evolution of Glassmorphism
   — translucent surfaces with a light-catching border, not static frosted
   panels. "Designers must balance translucency with legibility, using
   controlled blur levels and subtle light borders instead of solid colors."
2. **Bento-grid, modular dashboards** — variable-size tiles that direct
   attention by size/weight, not a uniform card grid.
3. **Micro-interactions signal intelligence, not just delight.** "We're past
   the era of bounce animations. In 2026, micro-interactions communicate
   system intelligence." A shimmer that sweeps like it's actively reading
   data beats a generic spinner.
4. **Progressive disclosure over crowded dashboards.** "Complex data is
   presented through scrollytelling instead of crowded dashboards, making
   information easier to consume."
5. **Home screens are becoming smart hubs, not static dashboards** — a
   contextual, data-driven nudge instead of a plain "Welcome back" header.
6. **Accessible design is a named 2026 trend in its own right**, not an
   afterthought — which is why the contrast fix from the previous review
   got folded into this pass rather than left for later.

## What actually changed (files)

| New/changed file | What it does |
|---|---|
| `constants/theme.ts` | Added `glass` token set (translucency/border/wash values built from your existing brand hex codes) |
| `components/ui/GlassCard.tsx` | **New.** BlurView + light-catching border, replaces flat `Card` on Dashboard and Insights |
| `components/ui/Shimmer.tsx` | **New.** Gradient-sweep skeleton for AI loading states — replaces plain spinners |
| `components/ui/AIPulseBadge.tsx` | **New.** Pulsing-dot indicator for "AI is live here" — Insights + Dashboard outlook |
| `components/dashboard/BentoGrid.tsx` | **New.** Variable-size tile system (`half`/`third`/`full` spans) |
| `components/dashboard/SmartNudge.tsx` | **New.** Computes one contextual line from real on-device data (at-risk courses → degree-class proximity → unfetched insight), not a generic banner |
| `app/(tabs)/dashboard.tsx` | Rebuilt around the bento grid + glass hero tile + smart nudge + collapsible AI outlook card |
| `app/(tabs)/_layout.tsx` | Tab bar now uses a BlurView background (glass pill) instead of flat surface color |
| `app/(tabs)/insights.tsx` | Written Analysis card is now glass + AI-pulse badge + shimmer while loading, instead of a flat card + plain text |
| Multiple files | `textFaint` (2.75:1 contrast, fails WCAG AA) swapped for `textMuted` (6.43:1) anywhere it carried actual body copy — kept only for pure decoration |

## What did NOT change

- Your brand hex values — indigo, gold, all semantic colors, untouched
- The CGPA/PI math, Firestore schema, API contracts — none of this is a
  visual-layer concern, so none of it was touched
- Results screen course list and semester detail — these are functional
  data-entry screens where "boring and unambiguous" is correct UX; I didn't
  glass-ify or bento-ify screens where speed of data entry matters more than
  visual flourish. Applying trends everywhere regardless of context is
  itself the mistake research warns against ("evaluate whether the trend
  supports business goals... not blindly copy trends").

## Honest limitation, same as last time

I still haven't run this in a simulator — the components are correct
React Native/Reanimated/expo-blur usage (verified: brace-balanced, correct
imports, no undefined references), but "compiles and is structurally sound"
and "looks and feels great on a real device" are different bars. BlurView
performance in particular is worth checking on a mid-range Android device
specifically — glass effects are the first thing to visibly stutter on
weaker GPUs, and that's a real risk with this pattern that the research
itself flags implicitly (Apple ships Liquid Glass on hardware with strong
GPUs; budget Android phones are a different story).

## Round 2 — Auth flow upgrade (acadegrade-ui-upgrade-prompt.md §1)

| New/changed file | What it does |
|---|---|
| `components/ui/AuthGlow.tsx` | **New.** Two slow-drifting blurred color blobs (primaryGlow + gold, existing tokens) behind auth screens — replaces flat `colors.void` background per the prompt's "shouldn't be a plain void" note |
| `components/ui/HeroArt.tsx` | **New.** Animated icon-in-a-pulsing-ring, built from `lucide-react-native` + `react-native-svg` + Reanimated. Replaces both the emoji hero art AND the `assets/lottie/` folder, which the prompt correctly flagged as mistakenly containing font files, not Lottie JSON. No new dependency, matches the prompt's own fallback option ("SVG built from the existing icon set") |
| `components/ui/SuccessCheck.tsx` | **New.** Checkmark draw-in (ring, then stroke) via `strokeDashoffset` — same animation technique as `CGPAArc` elsewhere in the app, for motion-language consistency. Replaces the static ✅ emoji on the password-reset success screen |
| `app/(auth)/welcome.tsx` | AuthGlow background; `HeroArt` per slide instead of emoji; parallax scale/opacity/translateY on inactive carousel slides (was a hard cut); staggered CTA entrance |
| `app/(auth)/login.tsx` | AuthGlow background; form fields wrapped in one `GlassCard`; staggered per-field `FadeInDown` entrance. Auth logic/error mapping unchanged |
| `app/(auth)/register.tsx` | Same treatment; step transition (details → OTP) now fades instead of hard-swapping. OTP/Firestore-write logic unchanged — same user-doc shape web writes |
| `app/(auth)/forgot-password.tsx` | Same treatment; success screen uses `SuccessCheck` instead of a static emoji |
| `app/(auth)/onboarding-tour.tsx` | AuthGlow background; `HeroArt` instead of emoji; preference row now a `GlassCard`. Firestore write unchanged |
| `assets/lottie/` | **Removed.** Contained font files by mistake (not Lottie JSON, per the prompt's own note) and nothing referenced it — `HeroArt` replaces the need for it entirely |

**Not done yet** — Results, Profile, Transcript, and the global nav/tilt-effect
items from the same prompt (§2–5) are still on the flat `Card`/no-motion
treatment. Same reasoning as the original pass: sequencing matters more
than speed here, and this round was scoped to the auth flow (the "first
impression" the prompt calls out) plus the actual app-breaking bug fix
below. Next round continues with Results.

## Round 2 — also: the actual splash-hang bug

Unrelated to the UI work above, but discovered while investigating this
build: `@react-native-firebase/*` was pinned to `^21.6.1`, which predates
reliable support for the New Architecture that Expo SDK 57 / RN 0.86 makes
**mandatory** (confirmed via the package's own changelog: "All modules will
be converted to new architecture soon, old architecture support is
deprecated in general for react-native-firebase," plus an open GitHub issue
specifically about SDK 55+/newArch problems with v21). Bumped to `^25.1.0`
(current latest as of this session). This is a NATIVE dependency change —
**requires a full new `eas build`**, not just a JS bundle reload.

## Round 3 — logo + register flow (real bugs, not style)

User caught two things that were flatly wrong, not just unpolished — verified against `app/(public)/login/page.tsx` and `app/(public)/register/page.tsx` on the web before fixing, not guessed:

1. **No `<Logo>` anywhere.** Zero logo usage on any auth screen. The real
   brand asset was sitting unused in `assets/icon.png` the whole time —
   confirmed by MD5 checksum match against web's
   `public/android-chrome-512x512.png`, byte-identical. Built
   `components/ui/Logo.tsx` and wired it into welcome, login,
   forgot-password, register.
2. **Register was a single flat form.** Web's real flow: Google auth skips
   OTP entirely (already verified by Google) and goes straight to academic
   details; email auth requires `/api/auth/otp/send` → code entry →
   `/api/auth/otp/verify` before continuing. The previous version of
   `app/(auth)/register.tsx` had neither the phasing nor the branching.
   Rebuilt as a proper 3-step wizard (Account+OTP → Academic Details →
   Record Mode) with the Google-skip-OTP logic matching web exactly.
   Simplified from web's 4 steps — the "past semesters" review step (for
   users who pick "Complete Record") isn't built yet; noted as a follow-up,
   not silently dropped.
3. New: `components/ui/PickerField.tsx` (bottom-sheet searchable select,
   for university/department/programme — no equivalent existed) and
   `lib/data/academic-data.ts` (university/department/programme lists,
   copied from web's `lib/utils/academic-data.ts`).

**Not done yet, scoped for next rounds**: light/dark theme toggle system,
BizStock-style "More" bottom-sheet nav (replacing the current flat tab
row), a new Calendar/Events feature (not in the web app at all — genuinely
new), and re-skinning inspiration images 2–11 (structure reference only,
need our palette) vs images 12–16 (closest to actual brand already, useful
as a target reference for Dashboard/Results screens specifically).
