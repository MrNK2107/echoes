# ADR-0009: EAS development build and push notifications via Expo

**Status:** Accepted
**Date:** 2026-10-19

## Context
Plans 1–3 run entirely in Expo Go. Two features need native code that Expo Go
cannot provide:
- **Remote push on Android.** Expo Go dropped remote push support on Android in
  SDK 53.
- **AR.** The AR library is a native module.

Notifications already exist server-side as an in-app inbox
(`users/{uid}/notifications`, ADR-0007). They need delivery to the device. The
Firebase project is registered for Android package `com.phantom.echoes` and iOS
bundle `com.mrnk2107.echoes`.

## Decision
- **EAS Build profiles** in `mobile/eas.json`:
  - `development` (dev client, internal distribution)
  - `preview` (internal APK/IPA against the emulator or staging)
  - `production` (store builds, auto-increment)
- **Identifiers:** `app.config.ts` keeps `android.package = com.phantom.echoes` and
  `ios.bundleIdentifier = com.mrnk2107.echoes`, matching the registered Firebase
  apps. The EAS `projectId` comes from `EXPO_PUBLIC_EAS_PROJECT_ID`.
- **Expo Go remains supported.** Anything native is optional at runtime:
  - Push registration is skipped when `Constants.appOwnership === 'expo'` or the
    device is a simulator.
  - AR falls back to the 2D view (ADR-0010).
- **Push transport: Expo Push Service.**
  - **Client:** `expo-notifications` obtains an Expo push token after the user
    opts in (Profile → Notifications → `Turn on push notifications`). It stores
    it at `users/{uid}/pushTokens/{tokenHash}` as
    `{ token, platform, createdAt, lastSeenAt }`, owner-only. Sign-out and
    account deletion remove it.
  - **Server:** a function `onNotificationCreated`
    (`users/{uid}/notifications/{id}`) sends the stored title, body and `data`
    to every token of that user through `https://exp.host/--/api/v2/push/send`,
    in chunks of 100. It removes tokens whose ticket reports
    `DeviceNotRegistered`.
  - Preferences and blocks are already applied when the inbox document is
    created, so push follows the inbox exactly.
- **Tapping a notification** routes through the same mapping as the inbox:
  - `memoryTagged` → memory
  - `communityInvite` → community
  - `transfer*` → notifications
  - anything else → notifications

## Consequences
- **Easier:** one transport for both platforms. No APNs or FCM credentials in our
  code (EAS manages them).
- **Harder:** releases require EAS accounts and credentials, which are owner
  tasks. Push cannot be tested in Expo Go, so it is unit-tested with fakes and
  smoke-tested on a development build.

## Token squatting
A client can register another device's push token under its own uid: the rules only check the
token's format. The effects:
- **Impact.** The attacker's notifications are delivered to the victim's device (the token now
  belongs to the attacker's inbox). `onPushTokenCreated` also removes the token from every other
  user, so the victim's own token doc is deleted and the victim stops receiving their own pushes
  until their client registers again.
- **No content leaks.** Push bodies are generic per type and titles are fixed, so the victim sees
  only text such as "You have a new community invitation."; the inbox keeps the details, and it is
  readable only by its owner.
- **Bounded.** The victim's next registration (app start, foreground after 6 h, or enabling
  push) reclaims the token and removes it from the attacker. The attacker also needs the victim's
  token, which is not public.
- **Enhanced push security.** Setting `EXPO_ACCESS_TOKEN` makes Expo require it for sends, so
  third parties who learn a token cannot send to it. It stops outsiders only; it does not stop the
  registration above. It must be enabled for the project before launch.
