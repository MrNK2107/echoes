# ECHOES Production Release Gates

Repository automation must be green before device validation:

```powershell
flutter analyze
flutter test
flutter test integration_test -d <device-id>
npm test --prefix functions
npx firebase emulators:exec --only firestore "npm test --prefix rules_test"
```

## Required external configuration

- Supply Firebase Android/iOS apps and native configuration files.
- Restrict Google Maps keys by application/package and signing certificate.
- Set `MAPS_API_KEY` or `GOOGLE_MAPS_ANDROID_API_KEY` for Android builds.
- Set `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD` for release signing.
- Deploy Firestore rules, indexes, Storage rules, and Cloud Functions to the
  selected production Firebase project.

## Android device gate

- Sign up (13+ confirmation), sign in, delete the account, and confirm backend
  cleanup of profile, memory media, memberships, transfers, and notifications.
- Exercise location and notification allow/deny/permanently-denied states.
- Create text, image, and 60-second voice-note memories across all privacy modes.
- Verify offline image retry when connectivity returns.
- Verify Maps markers/details, community and institution persistence, aura
  history, custodianship transfer, and 30-day restore.
- Verify ARCore aura nodes and memory navigation on an AR device; verify the 2D
  fallback on a non-AR device.
- Measure launch under 3 seconds, memory load under 2 seconds, location update
  under 1 second, and AR at 30 FPS or better on a mid-range device.

## iOS/macOS gate

- Build and archive on macOS with the production bundle ID and signing profile.
- Repeat the Android functional matrix on iOS 15+.
- Verify ARKit lifecycle across background/foreground and repeated scene opens.
- Complete App Store privacy labels, age rating (13+), support URL, privacy
  policy, and account-deletion disclosure.
