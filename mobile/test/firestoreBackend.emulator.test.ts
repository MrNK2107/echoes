import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithCustomToken, signOut, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';

import { createFirestoreBackend } from '@/data/firestore';
import type { Repositories } from '@/data/types';
import { emptyAura } from '@/domain/aura';
import type { Memory } from '@/domain/types';
import { runDraft } from '@/features/memories/submitMemory';
import type { Services } from '@/services/services';

import { authRepositoryContract } from './contracts/auth.contract';
import { memoryRepositoryContract } from './contracts/memories.contract';
import { placeRepositoryContract } from './contracts/places.contract';
import { userRepositoryContract } from './contracts/users.contract';
import { waitFor } from './contracts/util';

// runDraft's module pulls in the native image compressor; the outbox replay never calls it.
jest.mock('@/features/memories/compressImage', () => ({ compressImage: async (u: string) => u }));

const PROJECT_ID = 'demo-echoes';
const HOST = '127.0.0.1';

interface Ctx {
  app: FirebaseApp;
  db: Firestore;
  auth: Auth;
  storage: FirebaseStorage;
  repos: Repositories;
  signInAs(uid: string): Promise<void>;
  cleanup(): Promise<void>;
}

const b64url = (s: string) => btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

/** The Auth emulator accepts unsigned custom tokens, which lets tests act as any uid. */
function emulatorCustomToken(uid: string): string {
  const iat = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      iss: 'firebase-auth-emulator@example.com',
      sub: 'firebase-auth-emulator@example.com',
      aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
      iat,
      exp: iat + 3600,
      uid,
    }),
  );
  return `${header}.${payload}.`;
}

async function resetEmulators(): Promise<void> {
  const urls = [
    `http://${HOST}:8080/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    `http://${HOST}:9099/emulator/v1/projects/${PROJECT_ID}/accounts`,
  ];
  for (const url of urls) {
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Emulator reset failed (${res.status}) for ${url}`);
  }
}

/**
 * Writes a document as the server would: the emulator's `Bearer owner` token bypasses the rules.
 * Memberships are server-written (ADR-0007), so tests seed them this way.
 */
async function adminSetDoc(path: string, fields: Record<string, string>): Promise<void> {
  const body = {
    fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { stringValue: v }])),
  };
  const res = await fetch(
    `http://${HOST}:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`,
    {
      method: 'PATCH',
      headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`Admin write failed (${res.status}) for ${path}`);
}

let appSeq = 0;

/** A fresh app per test so Firestore's local cache never leaks documents between tests. */
async function makeCtx(): Promise<Ctx> {
  await resetEmulators();
  appSeq += 1;
  const app = initializeApp(
    { projectId: PROJECT_ID, apiKey: 'demo-api-key', storageBucket: `${PROJECT_ID}.appspot.com` },
    `emulator-test-${appSeq}`,
  );
  const db = getFirestore(app);
  connectFirestoreEmulator(db, HOST, 8080);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${HOST}:9099`, { disableWarnings: true });
  const storage = getStorage(app);
  connectStorageEmulator(storage, HOST, 9199);
  const repos = createFirestoreBackend({ db, auth, storage });
  return {
    app, db, auth, storage, repos,
    async signInAs(uid) {
      if (auth.currentUser?.uid === uid) return;
      await signInWithCustomToken(auth, emulatorCustomToken(uid));
    },
    async cleanup() {
      await signOut(auth);
      await deleteApp(app);
      await resetEmulators();
    },
  };
}

const make = async () => {
  const ctx = await makeCtx();
  return { repos: ctx.repos, signInAs: ctx.signInAs, cleanup: ctx.cleanup };
};

placeRepositoryContract('firestore', make);
// Aggregation runs through `onMemoryWritten`; account cleanup through `cleanupDeletedUser`
// (both need the functions emulator, see jest.emulator.config.js).
// Deletion times are server-stamped (ruling R13), so the backdated-delete case is memory-only.
memoryRepositoryContract('firestore', make, { supportsLifecycle: true, supportsClientDeletionTime: false });
authRepositoryContract('firestore', make, { supportsLifecycle: true });
userRepositoryContract('firestore', make, { supportsLifecycle: true });

describe('firestore backend specifics', () => {
  let ctx: Ctx;
  beforeEach(async () => { ctx = await makeCtx(); });
  afterEach(async () => { await ctx.cleanup(); });

  const T = new Date('2026-01-01T00:00:00Z');
  function communityMemory(id: string, communityId: string): Memory {
    return {
      id, userId: 'author', placeId: 'place-1', imageUrl: null, audioUrl: null,
      textContent: 'together', latitude: 12.97, longitude: 77.59, geohash: 'tdr1v9q',
      sentiment: { compound: 0.5, positive: 0.5, neutral: 0.5, negative: 0 },
      privacy: 'community', taggedUserIds: [], communityId, releaseDate: null,
      isDeleted: false, deletedAt: null, createdAt: T, updatedAt: T,
    };
  }

  it('community memories are visible to members of that community only', async () => {
    await ctx.signInAs('author');
    await ctx.repos.memories.create(communityMemory('c-mine', 'club'));
    await ctx.repos.memories.create(communityMemory('c-other', 'other-club'));
    await ctx.signInAs('member');
    await adminSetDoc('communities/club/members/member', { role: 'member' });

    let latest: string[] | null = null;
    let error: Error | null = null;
    const unsub = ctx.repos.memories.subscribeVisibleForPlace(
      { placeId: 'place-1', viewerId: 'member', viewerCommunityIds: ['club'], now: new Date() },
      (ms) => { latest = ms.map((m) => m.id); },
      (e) => { error = e; },
    );
    try {
      await waitFor(() => {
        expect(error).toBeNull();
        expect(latest).toEqual(['c-mine']);
      });
    } finally {
      unsub();
    }
  });

  it('a client clock far ahead of the server still shows public memories without a denial', async () => {
    // `now` +1 day simulates a fast device clock. The timeRelease bound is clamped below the
    // real client clock, so the rules (releaseDate <= request.time) still accept that branch:
    // public memories appear, released ones appear, and onError never fires.
    await ctx.signInAs('author');
    const base = communityMemory('pub', 'unused');
    await ctx.repos.memories.create({ ...base, privacy: 'public', communityId: null });
    await ctx.repos.memories.create({
      ...base, id: 'released', privacy: 'timeRelease', communityId: null,
      releaseDate: new Date('2026-02-01T00:00:00Z'),
    });
    await ctx.signInAs('viewer');

    let latest: string[] | null = null;
    let error: Error | null = null;
    const unsub = ctx.repos.memories.subscribeVisibleForPlace(
      {
        placeId: 'place-1', viewerId: 'viewer', viewerCommunityIds: [],
        now: new Date(Date.now() + 86_400_000),
      },
      (ms) => { latest = ms.map((m) => m.id).sort(); },
      (e) => { error = e; },
    );
    try {
      await waitFor(() => expect(latest).toEqual(['pub', 'released']));
      expect(error).toBeNull();
    } finally {
      unsub();
    }
  });

  it('register creates the users doc with public default privacy', async () => {
    const s = await ctx.repos.auth.register('u@example.com', 'secret12', 'U');
    const user = await ctx.repos.users.get(s.userId);
    expect(user).toMatchObject({
      id: s.userId, displayName: 'U', email: 'u@example.com', photoUrl: null,
      defaultPrivacy: 'public', managedPlaceIds: [], communityIds: [],
    });
  });

  it('uploads a memory image to memory-images/{uid}/{memoryId}.jpg and returns a URL', async () => {
    await ctx.signInAs('author');
    // Node cannot fetch a device file path; a data: URI exercises the same fetch -> blob path.
    const jpegBytes = String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9);
    const url = await ctx.repos.media.uploadMemoryImage({
      userId: 'author',
      memoryId: 'm1',
      localUri: `data:image/jpeg;base64,${btoa(jpegBytes)}`,
    });
    expect(url).toContain('memory-images%2Fauthor%2Fm1.jpg');
  });

  it('uploads a voice note to memory-audio/{uid}/{memoryId}.m4a and returns a URL', async () => {
    await ctx.signInAs('author');
    const m4aBytes = String.fromCharCode(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20);
    const url = await ctx.repos.media.uploadMemoryAudio({
      userId: 'author',
      memoryId: 'm1',
      localUri: `data:audio/mp4;base64,${btoa(m4aBytes)}`,
    });
    expect(url).toContain('memory-audio%2Fauthor%2Fm1.m4a');
  });

  it('the rules accept the download URLs the Storage emulator issues', async () => {
    await ctx.signInAs('author');
    await ctx.repos.memories.create(communityMemory('with-media', 'unused'));
    const jpegBytes = String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9);
    const imageUrl = await ctx.repos.media.uploadMemoryImage({
      userId: 'author',
      memoryId: 'with-media',
      localUri: `data:image/jpeg;base64,${btoa(jpegBytes)}`,
    });
    await ctx.repos.memories.attachMedia('with-media', { imageUrl }, new Date());
    expect((await ctx.repos.memories.findById('with-media'))?.imageUrl).toBe(imageUrl);
  });

  it('update writes only mutable fields and clears privacy fields that no longer apply', async () => {
    await ctx.signInAs('author');
    const base = communityMemory('edit-me', 'unused');
    await ctx.repos.memories.create({
      ...base, privacy: 'timeRelease', communityId: null, releaseDate: new Date('2026-02-01T00:00:00Z'),
    });
    const at = new Date('2026-03-01T00:00:00Z');
    await ctx.repos.memories.update(
      'edit-me',
      {
        textContent: 'now public', privacy: 'public', taggedUserIds: ['x'],
        releaseDate: new Date('2027-01-01T00:00:00Z'), communityId: 'c',
        sentiment: { compound: -0.4, positive: 0, neutral: 0.6, negative: 0.4 },
      },
      at,
    );
    expect(await ctx.repos.memories.findById('edit-me')).toMatchObject({
      textContent: 'now public', privacy: 'public', taggedUserIds: [], releaseDate: null,
      sentiment: { compound: -0.4, positive: 0, neutral: 0.6, negative: 0.4 }, communityId: null, createdAt: T, updatedAt: at,
    });
  });

  it('places round-trip through findById with the aura mapped', async () => {
    await ctx.signInAs('custodian');
    await ctx.repos.places.create({
      id: 'p', name: 'P', latitude: 1, longitude: 2, geohash: 's01mtw', communityId: null,
      custodianIds: ['custodian'], aura: emptyAura(T), memoryCount: 0, publicMemoryCount: 0,
      createdAt: T, updatedAt: T,
    });
    expect(await ctx.repos.places.findById('p')).toMatchObject({ id: 'p', aura: emptyAura(T) });
  });

  it('replaying an outbox draft twice writes one place and one memory (ADR-0006)', async () => {
    await ctx.signInAs('author');
    const services = { repos: ctx.repos } as unknown as Services;
    const draft = {
      memoryId: 'q1', placeIdIfNew: 'p_q1', userId: 'author', createdAt: T.toISOString(),
      textContent: 'queued offline', privacy: 'public' as const, releaseDate: null, taggedUserIds: [],
      communityId: null, location: { latitude: 12.97, longitude: 77.59 }, imageUri: null, audioUri: null,
    };
    await expect(runDraft(services, draft)).resolves.toEqual({ memoryId: 'q1', placeId: 'p_q1' });
    // Replay: the memory already exists, so nothing is rewritten.
    await expect(runDraft(services, draft)).resolves.toEqual({ memoryId: 'q1', placeId: 'p_q1' });
    expect(await ctx.repos.memories.findById('q1')).toMatchObject({
      id: 'q1', placeId: 'p_q1', textContent: 'queued offline', createdAt: T, updatedAt: T,
    });
  });
});
