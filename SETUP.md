# Setup

## 1. Install dependencies

```bash
cd acadegrade-mobile
npm install
```

## 2. Firebase native config

Download from the Firebase console (same project as the web app, or a new
one — see ARCHITECTURE.md point 1):
- `GoogleService-Info.plist` → repo root
- `google-services.json` → repo root

Both are referenced in `app.json` and are `.gitignore`'d by default — don't
commit them.

## 3. Environment variables

Create `.env.local` for **local** development (`npx expo start`, `expo run:android`):

```bash
EXPO_PUBLIC_API_BASE_URL=https://acadegrade.vercel.app
EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID=<OAuth 2.0 Web client ID from Google Cloud Console, same Firebase project>
EXPO_PUBLIC_USE_FIREBASE_EMULATOR=false
```

The web client ID is **not** the same as any `NEXT_PUBLIC_FIREBASE_*` value —
it's a separate OAuth client Google Sign-In needs, found under
Google Cloud Console → APIs & Services → Credentials, in the same GCP
project your Firebase project lives in.

### ⚠️ Critical: `.env.local` is invisible to `eas build`

This bit an actual build: **local `.env`/`.env.local` files are never
uploaded to EAS's cloud build servers.** They only apply when running
`expo start` or `expo run:*` on your own machine. If you build with
`eas build --platform android --profile preview` (or any EAS profile)
without registering these vars with EAS separately, `EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID`
comes back `undefined` inside the compiled app — and because
`GoogleSignin.configure()` used to run at raw module-import time (now fixed,
see `lib/firebase/auth.ts`), that produced a **silent crash before the app
ever rendered anything: permanently stuck on the splash screen, no error
visible anywhere**, because the `preview` profile isn't a dev-client build
and shows no red-screen overlay.

Fixed two ways:
1. **Code**: the risky top-level calls are now deferred and guarded (see
   `lib/firebase/auth.ts`, `lib/firebase/client.ts`), and `app/_layout.tsx`
   now has a root Error Boundary + a 12s safety-net timeout, so any future
   problem like this shows a readable message instead of an infinite hang.
2. **Config**: `eas.json` now has an `"env"` block per build profile with
   these same two vars. **You still need to replace the placeholder
   `EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID` value in `eas.json` with your real
   OAuth web client ID** before rebuilding — it's currently a placeholder
   string, which won't crash the app anymore, but Google sign-in won't work
   until it's real.

Two ways to manage these for EAS builds — either works:
- **Simplest (already done)**: plain values directly in `eas.json`'s `env`
  block per profile. Fine for these two, since `EXPO_PUBLIC_*` vars are
  bundled into the JS and visible in the shipped app either way — there's
  no confidentiality to protect.
- **Alternative**: `eas env:create --scope project --name EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID --value "..." --environment preview` (repeat per profile/var) if you'd rather manage them from the EAS dashboard instead of committing them to `eas.json`.

After changing either `eas.json` or EAS-stored env vars, you must **rebuild**
(`eas build ...` again) — env vars are baked in at build time, not runtime.

## 4. Run it

```bash
npx expo start
```

Press `i` for iOS simulator, `a` for Android emulator, or scan the QR code
with Expo Go — **note:** `@react-native-firebase/*` requires a native build,
it will NOT work in the default Expo Go sandbox app. Use a development build:

```bash
npx expo prebuild
npx expo run:ios      # or run:android
```

## 5. Production builds (EAS)

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios --profile production
eas build --platform android --profile production
```

You'll need an Apple Developer account (iOS) and a Google Play Console
account (Android) for store submission — not covered here since that's an
account/billing step only you can do.

## 6. If the app ever gets stuck on the splash screen again

That's the exact symptom this session diagnosed and fixed (see §3 above).
If it happens again after a future change, in order of usefulness:

1. **Build a `development` profile instead of `preview`**
   (`eas build --platform android --profile development`, install it, then
   `npx expo start --dev-client`). Development builds show a red error
   overlay for uncaught JS errors — `preview`/`production` builds don't,
   which is exactly why this bug was invisible before.
2. **`adb logcat *:S ReactNative:V ReactNativeJS:V`** while launching the
   app — every `console.log`/`console.error`/`console.warn` in
   `app/_layout.tsx` and the `lib/firebase/*` files was written specifically
   to leave a breadcrumb trail here.
3. If it's fully stuck with no logs at all, suspect another top-level
   (module-import-time) call somewhere — search for
   `grep -rn "^[a-zA-Z].*(" lib/ app/_layout.tsx` for anything that executes
   immediately on import rather than inside a function/effect.

## 7. Common pitfalls carried over from the web project

- **Firestore rules still require manual publish in the Firebase Console** —
  this mobile app doesn't change that at all, it's the same Firestore
  project. If mobile reads/writes start failing with permission-denied,
  check the Firebase Console rules tab first, same as always.
- **`\n` → real newline** — irrelevant to this repo specifically (that's an
  Admin SDK server-side concern, and this app has no server), but worth
  remembering if you're debugging why an API route mobile calls is 500ing.
