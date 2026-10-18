import type { AuraZone, Memory, SentimentCategory } from './types';

export const AURA_COLORS: Record<SentimentCategory, string> = {
  positive: '#FFB347',
  peaceful: '#77B5FE',
  heavy: '#9B59B6',
  mixed: '#DDA0DD',
  neutral: '#C0C0C0',
};

const DAY_MS = 86_400_000;

export function emptyAura(now: Date): AuraZone {
  return {
    dominantSentiment: 'neutral',
    compoundScore: 0,
    intensity: 0,
    memoryCount: 0,
    colorHex: AURA_COLORS.neutral,
    updatedAt: now,
  };
}

function dominantSentiment(score: number, positiveCount: number, negativeCount: number): SentimentCategory {
  if (positiveCount > 0 && negativeCount > 0) return 'mixed';
  if (score >= 0.35) return 'positive';
  if (score >= 0.1) return 'peaceful';
  if (score <= -0.35) return 'heavy';
  return 'neutral';
}

export function calculateAura(
  memories: Pick<Memory, 'sentiment' | 'createdAt' | 'isDeleted'>[],
  now: Date,
): AuraZone {
  const live = memories.filter((m) => !m.isDeleted);
  if (live.length === 0) return emptyAura(now);

  let weightedTotal = 0;
  let totalWeight = 0;
  let positiveCount = 0;
  let negativeCount = 0;

  for (const m of live) {
    const ageDays = Math.max(Math.trunc((now.getTime() - m.createdAt.getTime()) / DAY_MS), 0);
    const weight = 1 / (1 + ageDays / 30);
    weightedTotal += m.sentiment.compound * weight;
    totalWeight += weight;
    if (m.sentiment.compound >= 0.1) positiveCount++;
    if (m.sentiment.compound <= -0.1) negativeCount++;
  }

  const score = totalWeight === 0 ? 0 : weightedTotal / totalWeight;
  const sentiment = dominantSentiment(score, positiveCount, negativeCount);
  return {
    dominantSentiment: sentiment,
    compoundScore: Math.min(Math.max(score, -1), 1),
    intensity: Math.min(live.length / 20, 1),
    memoryCount: live.length,
    colorHex: AURA_COLORS[sentiment],
    updatedAt: now,
  };
}
