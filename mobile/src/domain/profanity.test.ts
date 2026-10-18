import fixture from '../../../fixtures/domain/communities.json';
import words from '../../../fixtures/domain/profanity.json';
import { PROFANITY_WORDS, containsProfanity } from './profanity';

const cases = fixture.containsProfanity as { input: string; expected: boolean }[];

describe('containsProfanity', () => {
  it.each(cases)('%j', ({ input, expected }) => {
    expect(containsProfanity(input)).toBe(expected);
  });
  it('uses the shared word list and keeps it small', () => {
    expect([...PROFANITY_WORDS]).toEqual(words);
    expect(words.length).toBeLessThanOrEqual(60);
  });
});
