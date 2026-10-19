# Store privacy labels

Derived from the code on branch `expo-rewrite`, not from intent. Owner gate: a human must re-check this file against the build that is submitted and enter the answers in the store consoles. Nothing here has been entered or accepted by either store.

## Data inventory (source of truth for both tables)

| Data | Where it lives | Source |
|---|---|---|
| Email address | Firebase Auth; `users/{uid}.email` | `mobile/src/domain/types.ts` (`AppUser.email`, `AuthSession`) |
| Display name | `users/{uid}.displayName`; public copy in `publicProfiles/{uid}` (readable by other signed-in users; name only) | `types.ts` (`AppUser`, `PublicProfile`); `functions/onPublicProfileWritten.js` |
| Profile photo URL | `users/{uid}.photoUrl` (field exists; no upload UI in v1) | `types.ts` (`AppUser.photoUrl`) |
| Precise location of memories | `memories/{id}.latitude/longitude/geohash`; place coordinates in `places/{id}` | `types.ts` (`Memory`, `Place`) |
| Current device location | Read on device to find and pin nearby memories; the live position is not stored. It becomes data only as the coordinates of a memory the user saves | `mobile/app.config.ts` (`expo-location`, when-in-use only); `mobile/src/device/expoLocation.ts` |
| Photos | Firebase Storage `memory-images/{uid}/...` (max 1 MB, image/*); URL on the memory | `storage.rules`; `types.ts` (`Memory.imageUrl`) |
| Voice notes (audio) | Firebase Storage `memory-audio/{uid}/...` (max 5 MB, audio/*, 60 s cap in the app); URL on the memory | `storage.rules`; `app.config.ts` (`expo-audio`) |
| Other user content | Memory text, tags, privacy mode, community and transfer records, community names and descriptions, institution data, notification preferences, terms acceptance time | `types.ts` |
| Reports and blocks | `reports/{id}` (server-only: reporter id, reason, optional 280-char note, verified flag); `users/{uid}/blocks/{otherUid}` (owner-only) | `functions/safety.js`; `firestore.rules.template` |
| In-app notifications | `users/{uid}/notifications/{id}` (title, body, ids, actor id); expire 90 days after creation | `types.ts` (`AppNotification`); `firestore.indexes.json` TTL |
| User ID | Firebase Auth uid on every owned document | all of the above |
| Device ID (Expo push token) | `users/{uid}/pushTokens/{tokenId}` (max 10 per user); sent to Expo Push to deliver notifications | `functions/push.js`; `firestore.rules.template` |
| Crash logs, diagnostics, performance | Sentry, only in builds with `EXPO_PUBLIC_SENTRY_DSN`. `sendDefaultPii: false`, no `setUser`, no session replay, `tracesSampleRate: 0.1`. Query strings, push tokens, bearer tokens, email-shaped strings and uids in Storage and Firestore paths (`memory-images/<uid>/`, `users/<uid>`, `publicProfiles/<uid>`) are scrubbed in `beforeSend` and `beforeBreadcrumb`, which is why the Apple "not linked" answer holds. Retention is the Sentry project setting (default 90 days; OWNER confirms) | `mobile/src/device/crashReporter.ts`; ADR-0011 |
| Camera / microphone / photo library | Camera: only to attach a photo (the permission string says so; camera AR is not in v1 and its wording returns with it, ADR-0010). Microphone: only to record a voice note. Content leaves the device only as the photo or audio the user saves | `app.config.ts` permissions and plugin strings |

Not collected: contacts, advertising ID, browsing history, financial data, health data, background location (when-in-use only), analytics events. No ads SDK and no analytics SDK are in `mobile/package.json`. `NSPrivacyTracking` is `false` in `app.config.ts`.

Processors: Google Firebase (Auth, Firestore, Storage, Cloud Functions), Expo (push delivery), Sentry (crash and diagnostics). Data is encrypted in transit (HTTPS/TLS) and at rest by the providers.

Deletion: Profile, delete account (requires re-authentication). Deleting the Auth user fires `cleanupDeletedUser` (`functions/index.js`), which deletes the user's memories, transfers, community memberships (owned communities pass to the earliest member or are removed), public profile, institution admin roles, reports the user filed, notifications caused by the user, the `users/{uid}` tree (profile, push tokens, blocks, notifications) and all Storage files under `memory-images/{uid}/` and `memory-audio/{uid}/`. Reports other people filed about the user's memories are left in place, but the memories themselves are deleted. Retention: a soft-deleted memory is purged after 30 days (`functions/purgeDeletedMemories.js`, the restore window); notifications expire after 90 days; rate-limit counters after two days; push receipts after one day. Some data outlives account deletion and is part of the label: `taggedUserIds` entries naming the user in other people's memories; reports other people filed about the user's memories or profile (`reports`); notifications without an `actorId` (older than Plan 5) until the 90-day TTL; and the name and description of a community the user owned that passes to another member. Sentry events are kept per the Sentry retention setting and carry no user id. Backups (see the runbook) keep deleted data until they age out (14 weeks for scheduled backups).

## Google Play: Data safety

Global answers: data is encrypted in transit: yes. Data "shared" with service providers (Firebase, Expo, Sentry) acting on our behalf is answered No for every row, per Play's definition. Users can request deletion: yes (in-app, and via support email; add a web deletion URL in the console, owner gate). No data is sold. Nothing is shared for advertising. The Expo and Sentry rows say "service provider" for transparency only; their Shared answer is No.

| Data type (Play category) | Collected | Shared | Purpose | Optional | Notes and source |
|---|---|---|---|---|---|
| Personal info: Email address | Yes | No | Account management; App functionality | No | Required to sign up. `types.ts` |
| Personal info: Name (display name) | Yes | No | App functionality; Account management | No | Visible to other signed-in users via `publicProfiles` |
| Personal info: User IDs | Yes | No | App functionality; Account management | No | Auth uid |
| Location: Precise location | Yes | No | App functionality | Yes (permission can be denied; memories need coordinates) | Memory coordinates are stored; live position is processed on device. `app.config.ts`, `types.ts` |
| Photos and videos: Photos | Yes | No | App functionality | Yes | `storage.rules` |
| Audio: Voice or sound recordings | Yes | No | App functionality | Yes | `storage.rules`, `expo-audio` |
| App activity / Other user-generated content | Yes | No | App functionality | Yes | Memory text, community text, reports (note up to 280 chars) |
| Device or other IDs (Expo push token) | Yes | No (Expo is a service provider for push delivery) | App functionality | Yes (notification permission) | `functions/push.js` |
| App info and performance: Crash logs | Yes | No (Sentry is a service provider) | App functionality (stability) | No, in builds with a DSN | `crashReporter.ts`; not linked to identity |
| App info and performance: Diagnostics and performance | Yes | No (Sentry is a service provider) | App functionality | No, in builds with a DSN | 10 percent trace sample |
| Advertising, analytics, financial, health, contacts, web history | No | No | n/a | n/a | None collected |

## Apple: App Privacy ("nutrition labels")

Tracking: **No** (no data is combined with third-party data for ads, no data brokers).

| Data type | Collected | Linked to user | Used for tracking | Purpose |
|---|---|---|---|---|
| Contact Info: Email Address | Yes | Yes | No | App Functionality |
| Contact Info: Name | Yes | Yes | No | App Functionality |
| Location: Precise Location | Yes | Yes | No | App Functionality |
| User Content: Photos or Videos | Yes | Yes | No | App Functionality |
| User Content: Audio Data | Yes | Yes | No | App Functionality |
| User Content: Other User Content | Yes | Yes | No | App Functionality |
| Identifiers: User ID | Yes | Yes | No | App Functionality |
| Identifiers: Device ID (Expo push token) | Yes | Yes | No | App Functionality |
| Diagnostics: Crash Data | Yes | **No** | No | App Functionality |
| Diagnostics: Performance Data | Yes | **No** | No | App Functionality |
| Diagnostics: Other Diagnostic Data | Yes | **No** | No | App Functionality |
| Usage Data, Purchases, Financial, Health, Contacts, Search or Browsing History | No | n/a | n/a | n/a |

Analytics purpose: none declared. Sentry data is declared as App Functionality, not linked, not tracking (Sentry runs with `sendDefaultPii: false` and no `setUser`).

The app also ships an Apple privacy manifest (`app.config.ts` `privacyManifests`): `NSPrivacyTracking: false`, UserDefaults (CA92.1) and File timestamp (C617.1) required-reason APIs. Re-check the prebuild output and third-party SDK manifests (Sentry, Firebase) before submission (owner gate).

## Cross-check log (Task 14 Step 1)

Compared `types.ts` (every persisted field), `app.config.ts` (camera, notifications, location, microphone, photos) and `crashReporter.ts` with the tables above.

- Found in code but not in the brief's list, now declared: profile photo URL field (no UI sets it; covered under Photos), notification content and actor id (Other User Content), reports and blocks, `acceptedTermsAt`. Fixed here as defects of the brief's list.
- `app.config.ts` Android permissions are only CAMERA and POST_NOTIFICATIONS; location and microphone come from plugins. Foreground location only, so no background-location declaration is needed.
- Code differs from ADR-0011 wording: the Sentry release is the SDK default (`bundleId@version+build`), not just the app version (ADR corrected).
- Platform ids differ on purpose (ADR-0009 records the split); store application ids are permanent once the apps are created, so confirm them first. Platform ids: Android `com.phantom.echoes`, iOS `com.mrnk2107.echoes`. Not a label issue, but confirm both before creating the store records (owner gate).
