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

Create `.env.local`:

```bash
EXPO_PUBLIC_API_BASE_URL=https://acadegrade.vercel.app
EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID=<OAuth 2.0 Web client ID from Google Cloud Console, same Firebase project>
EXPO_PUBLIC_USE_FIREBASE_EMULATOR=false
```

The web client ID is **not** the same as any `NEXT_PUBLIC_FIREBASE_*` value —
it's a separate OAuth client Google Sign-In needs, found under
Google Cloud Console → APIs & Services → Credentials, in the same GCP
project your Firebase project lives in.

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

## 6. Common pitfalls carried over from the web project

- **Firestore rules still require manual publish in the Firebase Console** —
  this mobile app doesn't change that at all, it's the same Firestore
  project. If mobile reads/writes start failing with permission-denied,
  check the Firebase Console rules tab first, same as always.
- **`\n` → real newline** — irrelevant to this repo specifically (that's an
  Admin SDK server-side concern, and this app has no server), but worth
  remembering if you're debugging why an API route mobile calls is 500ing.
