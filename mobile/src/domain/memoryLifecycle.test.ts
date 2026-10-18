import {
  canRestore,
  normalizePrivacyFields,
  placeIdForNewMemory,
  RESTORE_WINDOW_DAYS,
  restoreDaysLeft,
  validateMemoryText,
} from './memoryLifecycle';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-19T12:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe('restoreDaysLeft', () => {
  it('is the window length when just deleted', () => {
    expect(RESTORE_WINDOW_DAYS).toBe(30);
    expect(restoreDaysLeft({ isDeleted: true, deletedAt: ago(0) }, NOW)).toBe(30);
  });
  it('rounds partial days up', () => {
    expect(restoreDaysLeft({ isDeleted: true, deletedAt: ago(29 * DAY + 3_600_000) }, NOW)).toBe(1);
  });
  it('is 0 at exactly 30 days', () => {
    expect(restoreDaysLeft({ isDeleted: true, deletedAt: ago(30 * DAY) }, NOW)).toBe(0);
  });
  it('is 0 when not deleted', () => {
    expect(restoreDaysLeft({ isDeleted: false, deletedAt: null }, NOW)).toBe(0);
  });
});

describe('canRestore', () => {
  it('is true just inside the window', () => {
    expect(canRestore({ isDeleted: true, deletedAt: ago(30 * DAY - 1) }, NOW)).toBe(true);
  });
  it('is false at 30 days', () => {
    expect(canRestore({ isDeleted: true, deletedAt: ago(30 * DAY) }, NOW)).toBe(false);
  });
  it('is false when not deleted', () => {
    expect(canRestore({ isDeleted: false, deletedAt: null }, NOW)).toBe(false);
  });
});

describe('validateMemoryText', () => {
  it.each([
    ['', 'Write something to remember.'],
    ['   \n', 'Write something to remember.'],
    ['a'.repeat(2001), 'Memories can be at most 2000 characters.'],
    ['a'.repeat(2000), null],
    ['  hello  ', null],
  ])('%j', (text, expected) => {
    expect(validateMemoryText(text)).toBe(expected);
  });
});

describe('placeIdForNewMemory', () => {
  it('prefixes p_', () => {
    expect(placeIdForNewMemory('abc')).toBe('p_abc');
  });
});

describe('normalizePrivacyFields', () => {
  const release = new Date('2027-01-01T00:00:00Z');
  const base = { taggedUserIds: ['u1'], releaseDate: release, communityId: 'c1' };
  it('public clears all', () => {
    expect(normalizePrivacyFields({ privacy: 'public', ...base })).toEqual({
      privacy: 'public',
      taggedUserIds: [],
      releaseDate: null,
      communityId: null,
    });
  });
  it('timeRelease keeps only the date', () => {
    expect(normalizePrivacyFields({ privacy: 'timeRelease', ...base })).toEqual({
      privacy: 'timeRelease',
      taggedUserIds: [],
      releaseDate: release,
      communityId: null,
    });
  });
  it('tagged keeps only tags', () => {
    expect(normalizePrivacyFields({ privacy: 'tagged', ...base })).toEqual({
      privacy: 'tagged',
      taggedUserIds: ['u1'],
      releaseDate: null,
      communityId: null,
    });
  });
  it('community keeps only community', () => {
    expect(normalizePrivacyFields({ privacy: 'community', ...base })).toEqual({
      privacy: 'community',
      taggedUserIds: [],
      releaseDate: null,
      communityId: 'c1',
    });
  });
});
