import auraJson from '../../../fixtures/domain/aura.json';
import { AURA_COLORS, calculateAura, emptyAura } from './aura';
import type { SentimentCategory } from './types';

interface AuraCase {
  name: string;
  now: string;
  memories: { compound: number; createdAt: string; isDeleted: boolean }[];
  expected: {
    dominantSentiment: SentimentCategory;
    compoundScore: number;
    intensity: number;
    memoryCount: number;
    colorHex: string;
  };
}

const cases = auraJson as AuraCase[];

describe('calculateAura (golden fixtures)', () => {
  it.each(cases)('$name', (c) => {
    const now = new Date(c.now);
    const aura = calculateAura(
      c.memories.map((m) => ({
        sentiment: { compound: m.compound, positive: 0, neutral: 0, negative: 0 },
        createdAt: new Date(m.createdAt),
        isDeleted: m.isDeleted,
      })),
      now,
    );
    expect(aura.dominantSentiment).toBe(c.expected.dominantSentiment);
    expect(aura.colorHex).toBe(c.expected.colorHex);
    expect(aura.memoryCount).toBe(c.expected.memoryCount);
    expect(aura.compoundScore).toBeCloseTo(c.expected.compoundScore, 10);
    expect(aura.intensity).toBeCloseTo(c.expected.intensity, 10);
    expect(aura.updatedAt).toEqual(now);
  });
});

describe('aura helpers', () => {
  it('has spec colors', () => {
    expect(AURA_COLORS).toEqual({
      positive: '#FFB347',
      peaceful: '#77B5FE',
      heavy: '#9B59B6',
      mixed: '#DDA0DD',
      neutral: '#C0C0C0',
    });
  });
  it('emptyAura is neutral', () => {
    const now = new Date();
    expect(emptyAura(now)).toEqual({
      dominantSentiment: 'neutral',
      compoundScore: 0,
      intensity: 0,
      memoryCount: 0,
      colorHex: '#C0C0C0',
      updatedAt: now,
    });
  });
});
