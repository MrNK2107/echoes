import { calculateAura } from '@/domain/aura';
import { distanceMeters } from '@/domain/geo';
import { buildSeed, DEMO_USER } from './seed';
import { createMemoryBackend } from './memory';

const now = new Date('2026-10-18T12:00:00Z');
const center = { latitude: 12.9716, longitude: 77.5946 };

describe('buildSeed', () => {
  const seed = buildSeed(now);

  it('has >= 6 places within 1500 m covering all five aura categories', () => {
    expect(seed.places.length).toBeGreaterThanOrEqual(6);
    for (const p of seed.places) expect(distanceMeters(center, p)).toBeLessThanOrEqual(1500);
    const cats = new Set(seed.places.map((p) => p.aura.dominantSentiment));
    expect([...cats].sort()).toEqual(['heavy', 'mixed', 'neutral', 'peaceful', 'positive']);
  });

  it('has >= 20 memories across all five privacy modes', () => {
    expect(seed.memories.length).toBeGreaterThanOrEqual(20);
    expect(new Set(seed.memories.map((m) => m.privacy)).size).toBe(5);
  });

  it('place aggregates match their memories', () => {
    for (const p of seed.places) {
      const mine = seed.memories.filter((m) => m.placeId === p.id && !m.isDeleted);
      const pub = mine.filter((m) => m.privacy === 'public');
      expect(p.aura).toEqual(calculateAura(pub, now));
      expect(p.memoryCount).toBe(mine.length);
      expect(p.publicMemoryCount).toBe(pub.length);
      const first = [...mine].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
      if (first) expect(p.custodianIds).toContain(first.userId);
    }
  });

  it('supports privacy test fixtures', () => {
    const demo = seed.users.find((u) => u.email === DEMO_USER.email)!;
    expect(seed.users.length).toBeGreaterThanOrEqual(2);
    expect(seed.memories.some((m) => m.privacy === 'private' && m.userId !== demo.id)).toBe(true);
    expect(seed.memories.some((m) => m.privacy === 'tagged' && m.taggedUserIds.includes(demo.id))).toBe(true);
    expect(seed.memories.some((m) => m.privacy === 'timeRelease' && m.releaseDate && m.releaseDate > now)).toBe(true);
    const comm = seed.memories.find((m) => m.privacy === 'community');
    expect(comm?.communityId).toBeTruthy();
    expect(demo.communityIds).toContain(comm?.communityId);
    expect(seed.credentials[0]).toMatchObject({ userId: demo.id, email: DEMO_USER.email });
  });

  it('demo user can sign in on the seeded memory backend', async () => {
    const repos = createMemoryBackend(buildSeed(now));
    const s = await repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    expect(s.email).toBe(DEMO_USER.email);
  });
});
