# ADR-0008: Safety — report, block, hide, and community guidelines

**Status:** Accepted
**Date:** 2026-10-19

## Context
ECHOES publishes user-generated text, photos and voice to strangers at places.
Public launch requires:
- the App Store's user-generated-content rules (Guideline 1.2): a way to filter
  objectionable material, report it, and block abusive users, plus published
  contact information;
- Google Play's matching UGC policy;
- the product's own 13+ audience.

Neither the Flutter app nor Plan 1/2 has any of this.

## Decision
- **Terms acceptance.** Registration requires a second checkbox:
  `I agree to the Terms of Service and Community Guidelines.` It links to
  `https://echoes.app/terms` and `https://echoes.app/guidelines`. The URLs are
  configurable via `EXPO_PUBLIC_TERMS_URL` / `EXPO_PUBLIC_GUIDELINES_URL`.
  `users/{uid}.acceptedTermsAt` is stored. The page content is an external
  launch task for the owner.
- **Report.** Any signed-in viewer can report a visible memory through the
  `reportMemory` callable, choosing one reason: `spam`, `harassment`, `hate`,
  `sexual`, `violence` or `other`, with an optional 280-character note.
  - Reports are stored server-side in `reports/{id}`, one per reporter per
    memory.
  - The limit is 20 reports per user per day.
- **Auto-hide.** When 3 distinct users have reported a memory, the server sets
  `moderation: 'hidden'` on it.
  - `isVisibleMemory` in the rules then excludes it for everyone except its
    author, who sees a "Hidden after reports" badge.
  - Visibility queries add `where('moderation', '==', null)`.
- **Review queue.** Staff (custom claim `staff`) review reports in the Firebase
  console for v1. A staff review screen is deferred.
- **Block.** `users/{uid}/blocks/{otherUid}` is owner-only. The client hides
  blocked users' memories everywhere. Callables refuse tagging, inviting or
  transferring between a blocker and a blocked user, in either direction.
- **Profanity filter.** The client warns before saving text that contains
  words from a small built-in profanity list. The memory still saves.
  The server stores `flags.profanity: true`, so these memories can be found
  for review. They are not auto-hidden, to avoid false-positive censorship.
- **Contact.** The profile screen shows `Help & support` linking to
  `mailto:support@echoes.app`, configurable via `EXPO_PUBLIC_SUPPORT_EMAIL`.

## Consequences
- Meets store UGC requirements once the owner publishes the Terms and
  Guidelines pages and a support inbox.
- Three reports can hide legitimate content. That is acceptable for v1, because
  staff can restore it by clearing the `moderation` field in the console.
