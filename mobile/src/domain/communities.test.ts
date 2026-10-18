import fixture from '../../../fixtures/domain/communities.json';
import { GEO_THRESHOLD, eraCommunity, geoCommunity, normalizeName, searchRange, yearCommunity } from './communities';

interface Case<I, O> {
  input: I;
  expected: O;
}
interface Range {
  start: string;
  end: string;
}
interface Bucket {
  id: string;
  name: string;
}

const f = fixture as {
  normalizeName: Case<string, string>[];
  searchRange: Case<string, Range | null>[];
  yearCommunity: Case<string, Bucket>[];
  eraCommunity: Case<string, Bucket>[];
  geoCommunity: Case<Bucket, Bucket>[];
};

describe('communities helpers (golden fixtures)', () => {
  it.each(f.normalizeName)('normalizeName %j', ({ input, expected }) => {
    expect(normalizeName(input)).toBe(expected);
  });
  it.each(f.searchRange)('searchRange %j', ({ input, expected }) => {
    expect(searchRange(input)).toEqual(expected);
  });
  it.each(f.yearCommunity)('yearCommunity %j', ({ input, expected }) => {
    expect(yearCommunity(new Date(input))).toEqual(expected);
  });
  it.each(f.eraCommunity)('eraCommunity %j', ({ input, expected }) => {
    expect(eraCommunity(new Date(input))).toEqual(expected);
  });
  it.each(f.geoCommunity)('geoCommunity %j', ({ input, expected }) => {
    expect(geoCommunity(input)).toEqual(expected);
  });
  it('GEO_THRESHOLD is 5', () => {
    expect(GEO_THRESHOLD).toBe(5);
  });
});
