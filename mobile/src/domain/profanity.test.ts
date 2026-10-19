/// <reference types="node" />
// Node types for the fs-based sync check below (this file runs only under Jest, never in the app).
import fixture from '../../../fixtures/domain/communities.json';
import words from '../../../fixtures/domain/profanity.json';
import { readFileSync } from 'fs';
import { join } from 'path';

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
  it('bundles an exact copy of fixtures/domain/profanity.json (R30)', () => {
    // Metro only bundles files inside mobile/, so the app ships a local copy; this keeps it in sync.
    const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    expect(read(join(__dirname, 'profanity.json'))).toBe(
      read(join(__dirname, '..', '..', '..', 'fixtures', 'domain', 'profanity.json')),
    );
  });
});
