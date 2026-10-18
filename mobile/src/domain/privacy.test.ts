import visibilityJson from '../../../fixtures/domain/visibility.json';
import { isMemoryVisibleTo, MAX_TAGS, validatePrivacy } from './privacy';
import type { PrivacyType } from './types';

interface VisibilityCase {
  name: string;
  memory: {
    userId: string;
    privacy: PrivacyType;
    taggedUserIds: string[];
    releaseDate: string | null;
    isDeleted: boolean;
  };
  viewerId: string;
  viewerIsCommunityMember: boolean;
  now: string;
  visible: boolean;
}

const cases = visibilityJson as VisibilityCase[];

describe('isMemoryVisibleTo (golden fixtures)', () => {
  it.each(cases)('$name', (c) => {
    const result = isMemoryVisibleTo(
      {
        ...c.memory,
        releaseDate: c.memory.releaseDate === null ? null : new Date(c.memory.releaseDate),
      },
      {
        viewerId: c.viewerId,
        viewerIsCommunityMember: c.viewerIsCommunityMember,
        now: new Date(c.now),
      },
    );
    expect(result).toBe(c.visible);
  });
});

describe('isMemoryVisibleTo moderation (ADR-0008)', () => {
  const hidden = {
    userId: 'author', privacy: 'public' as const, taggedUserIds: [], releaseDate: null,
    isDeleted: false, moderation: 'hidden' as const,
  };
  const viewer = (viewerId: string) => ({ viewerId, viewerIsCommunityMember: false, now: new Date() });
  it('hides a hidden memory from everyone but its author', () => {
    expect(isMemoryVisibleTo(hidden, viewer('someone'))).toBe(false);
    expect(isMemoryVisibleTo(hidden, viewer('author'))).toBe(true);
  });
  it('treats null moderation as visible', () => {
    expect(isMemoryVisibleTo({ ...hidden, moderation: null }, viewer('someone'))).toBe(true);
  });
});

describe('validatePrivacy', () => {
  const now = new Date('2026-10-18T09:00:00.000Z');
  const base = { privacy: 'public' as PrivacyType, taggedUserIds: [], releaseDate: null, communityId: null, now };

  it('requires tagged users', () => {
    expect(validatePrivacy({ ...base, privacy: 'tagged' })).toBe('Add at least one tagged user.');
  });
  it('caps tags at MAX_TAGS (ruling R24)', () => {
    const people = (n: number) => Array.from({ length: n }, (_, i) => `u${i}`);
    expect(MAX_TAGS).toBe(20);
    expect(validatePrivacy({ ...base, privacy: 'tagged', taggedUserIds: people(20) })).toBeNull();
    expect(validatePrivacy({ ...base, privacy: 'tagged', taggedUserIds: people(21) })).toBe(
      'You can tag up to 20 people.',
    );
  });
  it('requires a release date', () => {
    expect(validatePrivacy({ ...base, privacy: 'timeRelease' })).toBe('Choose a release date.');
  });
  it('requires a strictly future release date', () => {
    expect(validatePrivacy({ ...base, privacy: 'timeRelease', releaseDate: now })).toBe(
      'Choose a future release date.',
    );
  });
  it('accepts a future release date', () => {
    expect(
      validatePrivacy({ ...base, privacy: 'timeRelease', releaseDate: new Date(now.getTime() + 1) }),
    ).toBeNull();
  });
  it('requires a community', () => {
    expect(validatePrivacy({ ...base, privacy: 'community' })).toBe('Choose a community.');
  });
  it('accepts public', () => {
    expect(validatePrivacy(base)).toBeNull();
  });
});
