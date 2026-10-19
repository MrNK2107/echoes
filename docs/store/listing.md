# Store listing (draft)

All text is a draft for the owner to approve. Items marked OWNER need a person, an account or an asset; none of them is done.

## Basics

- **Name:** ECHOES (30-character limit on both stores; OWNER: confirm availability).
- **Subtitle (iOS, 30 chars):** Memories pinned to places
- **Short description (Play, 80 chars):** Leave photos, voice notes and stories at the places that matter.
- **Category:** Social.
- **Content rating:** 13+ / Teen, with user-generated content (see below). Sign-up requires accepting the Terms of Service and Community Guidelines.
- **Support email:** the `EXPO_PUBLIC_SUPPORT_EMAIL` value (placeholder `support@echoes.app`; OWNER: real inbox).
- **Support URL / Marketing URL:** `https://echoes.app/support`, `https://echoes.app` (placeholders; OWNER).
- **Privacy policy URL:** `https://echoes.app/privacy` (placeholder; OWNER writes and hosts it, consistent with `privacy-labels.md`).
- **Terms / Community Guidelines / Privacy Policy:** `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_GUIDELINES_URL`, `EXPO_PUBLIC_PRIVACY_URL` (the store consoles also need the privacy policy URL). The defaults on `echoes.app` must not ship unless those pages exist.
- **Keywords (iOS, 100 chars):** memories,places,map,journal,voice notes,photos,local history,community,aura,nostalgia

## Full description

ECHOES lets you leave a memory where it happened. Pin a photo, a few words or a 60-second voice note to a place, choose who can see it, and come back later to find it waiting.

- Map of memories: browse public memories near you and see the mood of each place as a colour-coded aura that grows with its stories.
- Photos and voice notes: attach a picture or record a short voice note to any memory.
- You decide who sees it: keep it private, share it publicly, tag people, share it with a community, or set it to appear on a future date.
- Communities and institutions: join neighbourhood, theme or school communities and see what they remember.
- Place custodians: care for a place and hand custodianship to someone else with a transfer request.
- Radar view: see memories around you.
- Works offline: saves are queued and retried when you are back online.
- Safe by design: report any memory, community or profile, block people, and rely on a moderation team that aims to respond within 24 hours. Memories reported by three verified users are hidden until staff review them.
- Your data, your control: delete a memory (kept 30 days so you can restore it) or delete your whole account from inside the app.

ECHOES uses your location only while the app is open, to find and pin memories near you. Public memories show where they were left.

## Age rating considerations (user-generated content)

- The app hosts user-generated text, photos and audio visible to other users. The store requirements and where the app meets them:
  - terms acceptance at sign-up (built);
  - in-app report for memories, communities and profiles (built);
  - block (built);
  - content filtering and moderation: profanity warning on save, auto-hide after three verified reports, staff review (built; staff procedure in `docs/ops/runbook.md`);
  - published contact: Help & support in Profile (built);
  - a stated response time: 24 hours (a staffing commitment the owner must be able to keep).
- Apple questionnaire: answer yes to user-generated content and no to unrestricted web access. The 13+ target is a request, not a choice: Apple computes the tier from the answers. OWNER: submit it and accept or contest the result.
- Google Play (IARC): declare that users can interact, share content and share location (memory locations are visible to others). Expect Teen.

## Screenshots checklist (OWNER)

Capture on a build with demo data or a production reviewer account. Do not show real people's names, emails or private places.

- [ ] iPhone 6.9" and 6.5" sets: 3 to 10 images each.
- [ ] iPad 13" set, because `supportsTablet` is true in `app.config.ts` (or set it false and drop this).
- [ ] Android phone: 2 to 8 images.
- [ ] Play feature graphic 1024x500 and 512x512 icon.
- [ ] Suggested shots: map with aura, place detail, memory with photo, add memory with voice note, communities, notifications inbox, privacy choices, report and block sheet.
- [ ] Optional short preview video.

Check the exact pixel sizes in each console at submission time; they change.

## App Review notes and demo account (OWNER)

Create a reviewer account on the production backend before submission. The `demo@echoes.app` / `echoes-demo` login exists only in the `memory` backend builds, not in production. Put in the review notes:

- Reviewer email and password (a verified-email account, so reporting and communities work).
- Where to find report and block, and the in-app account deletion (Profile, delete account).
- Location is needed to pin memories; while-using access is enough. Push notifications are optional.
- Camera AR is not shipped in v1 (2D radar only; see the Viro gate in `docs/release-readiness.md`).
- Moderation contact and the 24 hour response target.
