import visibilityJson from '../../../fixtures/domain/visibility.json';
import { isMemoryVisibleTo, validatePrivacy } from './privacy';
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

describe('validatePrivacy', () => {
  const now = new Date('2026-10-18T09:00:00.000Z');
  const base = { privacy: 'public' as PrivacyType, taggedUserIds: [], releaseDate: null, communityId: null, now };

  it('requires tagged users', () => {
    expect(validatePrivacy({ ...base, privacy: 'tagged' })).toBe('Add at least one tagged user.');
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
