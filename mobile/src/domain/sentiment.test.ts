import sentimentJson from '../../../fixtures/domain/sentiment.json';
import { analyzeSentiment, sentimentCategory } from './sentiment';
import type { SentimentCategory } from './types';

interface SentimentCase {
  text: string;
  compound: number;
  positive: number;
  neutral: number;
  negative: number;
  category: SentimentCategory;
}

const cases = sentimentJson as SentimentCase[];

describe('analyzeSentiment (golden fixtures)', () => {
  it.each(cases.map((c, i) => [i, c.text.slice(0, 40), c] as const))('#%i %j', (_i, _name, c) => {
    const r = analyzeSentiment(c.text);
    expect(r.compound).toBeCloseTo(c.compound, 10);
    expect(r.positive).toBeCloseTo(c.positive, 10);
    expect(r.neutral).toBeCloseTo(c.neutral, 10);
    expect(r.negative).toBeCloseTo(c.negative, 10);
    expect(sentimentCategory(r)).toBe(c.category);
  });
});

describe('sentimentCategory', () => {
  it('is mixed when both positive and negative are strong', () => {
    expect(sentimentCategory({ compound: 0.5, positive: 0.4, neutral: 0.2, negative: 0.4 })).toBe('mixed');
  });
});
