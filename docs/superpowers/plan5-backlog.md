# Plan 5 backlog (carried from Plan 3 final review)

Launch-readiness items deferred from Plan 3's final whole-branch review. Plan 5's plan must cover or explicitly drop each one.

## Safety and moderation
- Report brigading: only count reporters with a verified email toward auto-hide (3 throwaway accounts can hide any memory today).
- Community names, community descriptions and display names cannot be reported (App Store Guideline 1.2).
- `visibility.js` lacks the own-read clause (no caller needs it yet).
- Tags on time-release memories never notify after release.
- Deterministic invite notification ids drop re-invites while the old notification exists (up to 90 days).

## Privacy and scale
- `publicProfiles` can be listed without a limit (scraping): require `request.query.limit <= 25` in rules and in client queries.
- `institutions.adminUserIds` is world-readable and ties uids to an email domain; consider a self-read admins subcollection.
- Hot documents: `time-<year>.memberCount`, `joinCommunity` increments on busy communities; consider distributed counters.
- A deleted user's display name stays in other users' notification bodies.
- Prod rules accept loopback media hosts; add a `--prod` build flag that drops them.
- `rateLimits` and `notifications` TTL policies must be enabled in the console (fields exist since 21dabd1).
- Legacy data backfill: `moderation: null`, legacy string `releaseDate`, Flutter member docs missing `userId`.

## Client polish and accessibility
- Standard `<Notice>` live-region component (Android live region + iOS announce).
- `BlocksProvider` under `(app)/_layout` instead of per-screen `useBlocksState`.
- Map top row crowding on 320dp / large fonts (Communities, bell, AR).
- Aura history chart dark-mode contrast and aspect.
- Partial registration (Auth account without users doc) repair step.
- Old inbox items show blocked actors' names.
- Debounce forced token refresh on institution screens.
- Membership load error shows Join.
- TransferSheet dedicated test for its remove label.

## From Plan 4 final review
- Poll Expo push receipts (tickets only today).
- Generic lock-screen preview text for community-invite pushes.
- Unregister the push token on auth-state null (sign-out/expiry).
- Note token squatting (registering another device's token) in ADR-0009.
- Throttle AppState-driven push re-registration.
- Wrapper test for onPushTokenCreated (relay + trim).
- Offline registration retry for push tokens.
- Device/a11y pass: dense-area AR orb overlap, small-radar crowding, AR back-button safe area.
- AR listener cost budget (per-place memory subscriptions).
- Camera AR: per-device field-of-view calibration (a constant 62° today) and a compass-calibration hint when headings jump.

## Post-launch (from Plan 5 final review)
- Incremental place aggregates or a dirty-marker sweep instead of a full per-place recompute on every memory write.
- Per-user daily memory-creation cap.
- High-water mark for notifyReleasedTags (replace the overlapping 2 h window).
- Page the account-deletion queries.
- Push-receipt throughput scaling.
- maxInstances and concurrency tuning.
- Push-token creation throttle.
- publicProfiles search callable with a budget.
- Report id prefix scheme.
- Shared-budget test for the memory backend.
- rolledUpAt skip.
- BulkWriter for push receipts.
- Single-pass backfill.
- Help and support fallback when no mail client is installed (mailto fails).
- Retry affordances on the memory detail and inbox load-error states (memory backend included).
- Report a profile from user search and from the blocked list.
- Remote minimum-version gate (force update).
- Once-nearby: wait for a `fromCache: false` snapshot before treating the list as final.
- Migrate the remaining 15 screen test files to `renderWithServices`.
- Red test for switching uid within one session (stale listeners and caches).
- Throttle InstitutionsScreen searches.

## Post-launch (from the Plan 5 final fix-wave re-review)
- cleanupDeletedUser: catch the admins-cleanup error inside the trigger and rethrow only after the Storage deletes, so a transient index error doesn't stall memory/user/media deletion until a retry.
- Password reset cooldown: key the 30 s cooldown by email so a corrected typo can be sent immediately.
- Unify `validateEmail` and `isValidEmail` (they disagree on `@b.co`).
- Play foreground-service review: note expo-notifications' merged RECEIVE_BOOT_COMPLETED and expo-location's location foreground-service declarations (no foreground-service permission is requested).
- Pin firebase-tools in the root `deploy:rules` script as CI does.
- Exhausted tag-notify author still costs ~4 reads on their first memory per run; precheck the budget earlier.
