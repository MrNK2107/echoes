# ECHOES operations runbook

Commands were checked against the repo (`package.json`, `functions/tools/backfill.js --help`, `scripts/build-rules.js`). Cloud and console steps (`gcloud`, Firebase console, Cloud Monitoring, Expo, Sentry) cannot be run from the repo and have not been executed; the owner verifies them on the production project. Replace `<id>` with the production Firebase project id.

## 1. Deploy order

Do not skip or reorder. Every step except the client release can be repeated.

0. **Rehearse the backfill on the emulator** (required before any production `--apply`; procedure in `docs/release-readiness.md`, "Expo Plan 5 data backfill runbook"). Do this once, before step 4.
1. **Indexes, including TTL.** `npx firebase deploy --only firestore:indexes --project <id>`. `firestore.indexes.json` carries the TTL `fieldOverrides` (`rateLimits.expireAt`, `notifications.expireAt`, `pushReceipts.expireAt`) and the collection-group overrides (`pushTokens.token`, `notifications.actorId`, `admins.userId`). Wait until every index shows Enabled in the console; the new queries and the account cleanup fail until then.
2. **Functions.** `npx firebase deploy --only functions --project <id>`. Set `EXPO_ACCESS_TOKEN` first (section 7). Functions run with `maxInstances: 50` (`functions/globalOptions.js`).
3. **Rules and Storage rules.** The rules pin the Storage bucket, so a bucket value is required. Set `FIREBASE_STORAGE_BUCKET` to the exact bucket in the Firebase console (for example `<project>.firebasestorage.app`), then:
   - bash: `FIREBASE_STORAGE_BUCKET=<bucket> npm run deploy:rules -- --project <id>`
   - PowerShell: `$env:FIREBASE_STORAGE_BUCKET="<bucket>"; npm run deploy:rules -- --project <id>`

   `deploy:rules` runs `node scripts/build-rules.js --prod`, which refuses to run without the variable and overwrites the committed `firestore.rules` (it pins the emulator bucket). **Immediately run `git checkout firestore.rules`**, or the next `rules_test` run fails. The old root `.env.example` documented this variable; it is deleted with the Flutter tree, so this paragraph is the record. Never deploy `firestore.lan.rules`.
   Deploying these rules retires the legacy Flutter client and hides memories that lack `moderation` from non-authors, so run step 4 straight after.
4. **Backfill (dry run, then apply).** Always with `--project <id>`; dry run is the default.
   - `node functions/tools/backfill.js all --project <id>`, read the per-task summary (`invalid=` are `releaseDate` strings left for manual review).
   - `node functions/tools/backfill.js all --apply --project <id>` (moderation, releaseDate, member userId).
5. **Institution admins.** `node functions/tools/backfill.js migrateInstitutionAdmins --project <id>` (dry run), then with `--apply`. It needs the functions and indexes from steps 1 and 2. A concurrent change shows `failed=` and exit code 1; re-run. Optional: `deleteLegacyNotificationRequests --apply`.
6. **Client release.** Build with EAS (`mobile/` , profile `production`), submit, then roll out. Follow-up C11: once the `migrateInstitutionAdmins` dry run shows `changed=0`, ship the change that drops the legacy `adminUserIds` fallback.

Cost and flags: `node functions/tools/backfill.js --help` (`--page-size`, `--resume-after <doc path>` for a single task). Each task is a full collection scan; every updated memory fires `onMemoryWritten`, so run off-peak.

### Legacy Flutter data

- Member docs written by the Flutter client have no `userId`; `backfillMemberUserIds` copies it from the doc id.
- Memories without `moderation` are hidden from non-authors; `backfillModeration` sets `null`.
- String `releaseDate` values never notify until `backfillReleaseDates` converts them.
- Institutions with `adminUserIds[]` move to `institutions/{id}/admins/{uid}` via `migrateInstitutionAdmins`.

## 2. Backups and recovery

- **Point-in-time recovery.** Enable PITR on the Firestore database (console, or `gcloud firestore databases update --enable-pitr --database='(default)'`). It keeps 7 days of versions. OWNER: verify it is on.
- **Daily scheduled backups.** `gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=14w`. OWNER: run and confirm with `gcloud firestore backups schedules list`.
- **Restore.** Restores always go into a new database, never over the live one:
  - from a backup: `gcloud firestore databases restore --source-backup=<backup resource> --destination-database=<new-db>`;
  - from PITR: `gcloud firestore databases clone --source-database=... --snapshot-time=<RFC3339 within 7 days> --destination-database=<new-db>`.

  Verify the data in the new database, then copy the affected documents back with a script, or point the app at the new database. Account deletions made after the snapshot must be re-applied, or deleted users reappear (privacy). Storage objects are not covered by Firestore backups; enable object versioning or a soft-delete window on the bucket if recovery of media matters (OWNER decision).
- **TTL.** Expired `rateLimits`, `notifications` and `pushReceipts` documents are removed by Firestore TTL (field `expireAt`), typically within a day of expiry, not instantly. Restoring old data brings old `expireAt` values back and they are deleted again.

## 3. Alerts, quotas and budgets (Cloud Monitoring and Billing; OWNER sets up)

- Alert policy on function error rate (any function, for example above 5 percent over 15 minutes).
- Alert on `checkPushReceipts` failures (log-based: severity ERROR from function `checkPushReceipts`); it runs every 30 minutes, so silence for over 2 hours is also a signal.
- Alert on Firestore document reads per day (set the threshold near twice the expected launch volume).
- Billing budgets with alerts at 50, 90 and 100 percent of the monthly budget.
- Quotas: callable functions rely on per-user daily rate limits in `rateLimits` (for example reports 20 per day) and on `maxInstances: 50` for every function, which caps cost under abuse. Raise the cap in `functions/globalOptions.js` only with a reason. Review Firestore, Storage egress and Cloud Functions quotas in the console before launch.
- Auth: enable email-enumeration protection (Firebase console, Authentication, Settings, User actions) so sign-in and password reset do not reveal whether an email exists. OWNER: enable and note the date here.

## 4. Moderation procedures (staff)

Staff have the custom claim `staff` (see README, "Granting the staff claim"). Target: act on a report within 24 hours.

1. Open `reports` in the Firebase console (server-only collection). Filter by `memoryId`, or by `targetType` and `targetId` for communities and profiles. Fields: `reporterId`, `reporterVerified`, `reason`, `note`, `createdAt`.
2. Judge the content. Only reports with `reporterVerified: true` count toward the automatic hide (three distinct reporters set `moderation: 'hidden'`). Reports about communities and profiles never auto-hide; staff act by hand.
3. Remove content that breaks the Community Guidelines: delete the memory or community in the console; for repeat abuse disable the user in Firebase Auth.
4. **Restore a wrongly hidden memory:** set `moderation` to `null` on the memory document. Never delete the field: a memory without it is hidden from everyone but its author (ADR-0008).
5. Answer the reporter or the user through the support inbox if needed; record the action in your team's tracker.

Legal or safety escalations (threats, illegal content): preserve the report and memory, then follow the owner's legal contact process (OWNER defines).

## 5. Incidents

Severity: SEV1 (data exposure, rules wide open, app unusable for everyone), SEV2 (a core flow broken for many, push outage, abuse flood), SEV3 (degraded or limited impact), SEV4 (cosmetic). Declare, name an owner, write the timeline.

- **Abuse spike (many reports or spam).** Check `rateLimits` and the function logs for the offender, disable the Auth user, hide or delete the content (section 4), and if it continues disable the abused callable (below).
- **Push outage.** Check Expo status and the `checkPushReceipts` logs. In-app notifications still work because the inbox is Firestore. Kill switch: revoke the `EXPO_ACCESS_TOKEN` in the Expo dashboard (sends then fail); create a new one and redeploy functions when resolved.
- **Rules regression.** Redeploy the previous release's rules: `git checkout <previous-release-tag> -- firestore.rules.template storage.rules`, then `FIREBASE_STORAGE_BUCKET=<bucket> npm run deploy:rules -- --project <id>`, then `git checkout firestore.rules` and restore the working tree. Do not deploy the committed `firestore.rules` as it is: it pins the emulator bucket.
- **Disable a function.** Delete it with `npx firebase functions:delete <name> --project <id>` (redeploy to bring it back), or for a scheduled function pause its Cloud Scheduler job in the console. Remove the user-facing entry point first if the app depends on it.
- **Bad client release.** Halt the staged rollout in the store console; ship a fix. Backend changes in this repo are backward compatible with the previous client unless noted.

## 6. Secret and token rotation

- **Sentry.** Create a new auth token in Sentry (Settings, Auth Tokens), replace the `SENTRY_AUTH_TOKEN` EAS secret, revoke the old token, then rebuild so source maps upload with the new one. To rotate the DSN, change `EXPO_PUBLIC_SENTRY_DSN` and rebuild; the old DSN keeps accepting events from shipped apps until you disable its key in Sentry.
- **Expo.** Create a new `EXPO_ACCESS_TOKEN` (Expo dashboard, Access tokens), update the functions secret or environment, redeploy functions, then delete the old token. Enhanced push security must stay enabled.
- **Maps.** Rotate `GOOGLE_MAPS_ANDROID_API_KEY` in Google Cloud (restricted to the package and signing certificate), update the EAS secret and rebuild.

## 7. Owner gates (none of these is done; tick only after doing it)

- [ ] Expo account, EAS project (`npx eas-cli init` in `mobile/`), `EXPO_PUBLIC_EAS_PROJECT_ID`, and the EAS environment variables listed in `docs/release-readiness.md`.
- [ ] Android FCM and iOS APNs credentials in EAS; Apple Developer and Google Play Console accounts; app records created; confirm the application ids (`com.phantom.echoes`, `com.mrnk2107.echoes`).
- [ ] Firebase production project, production keys (`EXPO_PUBLIC_FIREBASE_*`), Auth providers, and the deploy steps in section 1.
- [ ] Sentry project, `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` as an EAS secret.
- [ ] A symbolicated test crash visible in Sentry from a production-profile build (readable stack, correct release).
- [ ] `GOOGLE_MAPS_ANDROID_API_KEY` set as an EAS secret for production Android builds (the maps block is silently omitted without it).
- [ ] `EXPO_ACCESS_TOKEN` set on functions and enhanced push security enabled in Expo.
- [ ] Legal text: Terms of Service, Community Guidelines, privacy policy, support URL and a real support inbox; set `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_GUIDELINES_URL`, `EXPO_PUBLIC_SUPPORT_EMAIL`.
- [ ] Store listing, screenshots, privacy labels, age rating and reviewer account (`docs/store/`).
- [ ] PITR, backup schedule, alerts, budgets and Auth email-enumeration protection (sections 2 and 3).
- [ ] Maestro flows run on a device against the `e2e` build (ADR-0012; index selectors are unverified).
- [ ] AR device matrix (`docs/release-readiness.md`); camera AR stays off until the Viro gate passes.
- [ ] First `ci.yml` run green on GitHub (when T15 adds it).
- [ ] Moderation staff named, the `staff` claim granted, and the 24 hour response rota agreed.
