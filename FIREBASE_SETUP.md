# AcadeGrade mobile: Firebase and Expo setup

The mobile app uses the existing Firebase project `acadegrade-4329c` and the native app IDs below:

- Android package: `com.acadegrade.app`
- iOS bundle ID: `com.acadegrade.appname`
- Expo project ID: `400f09c4-64fa-4219-9088-4d98658cc1b7`

## 1. Enable authentication providers

In Firebase Console, open **Build → Authentication → Sign-in method** and enable:

1. **Email/Password**.
2. **Google**, selecting a public project support email.

Email/password authentication does not require a SHA certificate. Android Google authentication does.

In Google Cloud Console, verify the OAuth consent screen has an app name, support email, developer email, and the intended test users while the app is in Testing mode. Add `acadegrade.vercel.app` to the authorized domains used by the project.

## 2. Register Android certificate fingerprints

Open **Firebase Console → Project settings → General → Your apps → AcadeGrade Android (`com.acadegrade.app`) → Add fingerprint**.

The checked-in local debug keystore currently has these fingerprints:

```text
SHA-1:   5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
SHA-256: FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C
```

These fingerprints cover local `npx expo run:android` builds. EAS builds are normally signed by the EAS-managed keystore, so register that keystore's SHA-1 and SHA-256 as well:

```powershell
eas credentials -p android
```

Select the relevant build profile and inspect or download the Android keystore. If downloaded, obtain its fingerprints with:

```powershell
& 'C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe' -list -v -keystore 'C:\path\to\downloaded-keystore.jks' -alias 'YOUR_ALIAS'
```

Use the alias and passwords supplied by EAS. If development, preview, and production use different keystores, add every certificate. Once the app is published with Google Play App Signing, also add the Play Console **App signing key certificate** SHA-1 and SHA-256 from **Setup → App integrity**.

## 3. Refresh native Firebase files

After adding the SHA certificates, download a fresh `google-services.json` from the Firebase Android app. It should contain an Android OAuth entry with `client_type: 1` in addition to the Web client with `client_type: 3`.

Replace both copies in this project:

```text
google-services.json
android/app/google-services.json
```

For iOS, keep `GoogleService-Info.plist` matched to `com.acadegrade.appname`. Its reversed client ID remains the `iosUrlScheme` in `app.json`.

## 4. Configure Expo/EAS environment variables

Set these for Development, Preview, and Production in the Expo project:

```text
EXPO_PUBLIC_API_BASE_URL=https://acadegrade.vercel.app
EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID=380362341267-bi3akdpp264t7ki0fbrkmkooh3qf2dtu.apps.googleusercontent.com
EXPO_PUBLIC_USE_FIREBASE_EMULATOR=false
```

`EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID` must be the OAuth Web client (`client_type: 3`). Do not use the iOS client ID from `GoogleService-Info.plist`.

Do not put Firebase Admin, Gemini, Groq, OpenRouter, email, Cloudinary secret, or `INTERNAL_API_SECRET` values in Expo. They belong in the Vercel server environment only.

## 5. Publish Firebase rules and messaging configuration

Deploy or publish the web repository's rules:

```text
../acadegrade-web/firestore.rules
../acadegrade-web/database.rules.json
```

For Android push notifications, Cloud Messaging works from `google-services.json`; accept notification permission on Android 13+. For iOS, upload an APNs authentication key in Firebase Cloud Messaging and let EAS configure the app's push entitlement during a new iOS build.

## 6. Rebuild and test

Google Sign-In and Firebase Messaging are native modules, so Expo Go is not sufficient and `expo start` alone cannot apply changed native configuration.

```powershell
npm.cmd run typecheck
eas build --platform android --profile development --clear-cache
npx expo start --dev-client
```

Test email registration, email login, password reset, Google login, logout/login, Firestore reads, transcript API authentication, foreground notifications, background notifications, and notification-open behavior on a physical device.
