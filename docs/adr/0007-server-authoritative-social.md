# ADR-0007: Server-authoritative social operations

**Status:** Accepted
**Date:** 2026-10-19

## Context
The Flutter app implemented communities, custodianship transfers, institution
admin verification and notifications as client writes guarded by Firestore
rules. A survey of that code (2026-10-19) found that the rules cannot express
these operations safely, so the flows were broken or exploitable:
- Accepting a transfer requires the recipient to update a place they are not yet
  a custodian of, which the rules deny.
- Any user can self-join a community with `role: owner`, and any member can
  rewrite the community document (that is how `memberCount` was incremented).
- Institution admin "verification" only checks a typed email's domain and can
  never succeed under the rules.
- Any user can create a `notificationRequests` document with an arbitrary
  recipient, which is a spam vector. Push tokens were never registered.
- `users/{uid}` (including email) is readable by every signed-in user, and user
  search scanned the first 30 user documents client-side.

## Decision
1. **Callable Cloud Functions** (`onCall`, Admin SDK) own every multi-document or
   privileged write: `createCommunity`, `joinCommunity`, `leaveCommunity`,
   `inviteToCommunity`, `initiateTransfer`, `respondToTransfer`
   (accept/reject), `revokeTransfer`, `createInstitution` (staff only),
   `claimInstitutionAdmin`, `addInstitutionSubZone`, `reportMemory`. Clients get
   **read-only** rules on `communities`, `members`, `transfers`,
   `institutions` and `reports`.
2. **Notifications are produced only by the server.** Functions write an in-app
   inbox `users/{uid}/notifications/{id}` (owner can read and mark read; nobody
   creates). Push delivery through Expo's push service is added in Plan 4,
   together with the development build. Client creation of
   `notificationRequests` is disabled.
3. **Public vs private profile.** `users/{uid}` becomes owner-only. A minimal
   `publicProfiles/{uid}` holds `displayName` and `displayNameLower`; it is
   written by its owner (shape validated by rules) and searchable by prefix
   (`displayNameLower >= q && < q + ''`, limit 10, minimum 2 characters).
4. **Institution admins** are proven with Firebase Auth: the caller's ID token
   must have `email_verified == true` and an email whose domain exactly matches
   one of the institution's `allowedEmailDomains`. Only accounts holding the
   custom claim `staff == true` can create institutions.
5. Every callable validates input, checks blocks (ADR-0008), and is
   rate-limited per user with a Firestore counter
   (`rateLimits/{uid}_{action}_{yyyymmdd}`).

## Consequences
- Easier: correct invariants (member counts, custodian lists, one pending
  transfer per place and recipient), no notification spam, emails private.
- Harder: these flows need network access (no outbox). The UI shows a clear
  offline error. Function cold starts add roughly 1 s.
- Tests: function units with a fake Firestore, plus emulator contract tests that
  call the callables through the client SDK (`httpsCallable` with
  `connectFunctionsEmulator`).
