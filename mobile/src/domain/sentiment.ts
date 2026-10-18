import {
  boosters,
  contrastive,
  intensifiers,
  negations,
  negativeWords,
  positiveWords,
} from './sentimentLexicon';
import type { SentimentCategory, SentimentResult } from './types';

const NEUTRAL_RESULT: SentimentResult = { compound: 0, positive: 0, neutral: 1, negative: 0 };

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z']+/)
    .filter((w) => w.length > 0);
}

export function analyzeSentiment(text: string): SentimentResult {
  const tokens = tokenize(text);
  if (tokens.length === 0) return { ...NEUTRAL_RESULT };

  let totalPositive = 0;
  let totalNegative = 0;
  let scoredCount = 0;
  let inNegatedContext = false;
  let contrastiveSeen = false;
  let afterContrastiveNegation = false;

  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i]!;
    const prevWord = i > 0 ? tokens[i - 1]! : null;
    const nextWord = i < tokens.length - 1 ? tokens[i + 1]! : null;

    if (contrastive.has(word)) {
      contrastiveSeen = true;
      inNegatedContext = false;
      continue;
    }

    if (negations.has(word)) {
      inNegatedContext = !inNegatedContext;
      if (contrastiveSeen) afterContrastiveNegation = !afterContrastiveNegation;
      continue;
    }

    if (intensifiers.has(word) || boosters.has(word)) continue;

    const isPositive = positiveWords.has(word);
    const isNegative = negativeWords.has(word);
    if (!isPositive && !isNegative) continue;

    let intensityMultiplier = 1.0;
    if (prevWord !== null) {
      if (intensifiers.has(prevWord)) intensityMultiplier = 1.35;
      else if (boosters.has(prevWord)) intensityMultiplier = 1.15;
    }
    if (nextWord !== null && intensifiers.has(nextWord)) intensityMultiplier = 1.25;

    if (inNegatedContext) {
      if (isPositive) totalNegative += 0.6 * intensityMultiplier;
      else totalPositive += 0.6 * intensityMultiplier;
    } else if (isPositive) {
      totalPositive += 1.0 * intensityMultiplier;
    } else {
      totalNegative += 1.0 * intensityMultiplier;
    }

    scoredCount++;

    if (!afterContrastiveNegation) inNegatedContext = false;
  }

  if (scoredCount === 0) return { ...NEUTRAL_RESULT };

  const sumScore = totalPositive - totalNegative;
  const maxScore = totalPositive + totalNegative;
  const compound = maxScore === 0 ? 0 : clamp(sumScore / maxScore, -1, 1);

  return {
    compound,
    positive: clamp(totalPositive / (totalPositive + totalNegative + 1), 0, 1),
    neutral: clamp(1 - (totalPositive + totalNegative) / (scoredCount * 1.5), 0, 1),
    negative: clamp(totalNegative / (totalPositive + totalNegative + 1), 0, 1),
  };
}

export function sentimentCategory(r: SentimentResult): SentimentCategory {
  if (r.positive >= 0.35 && r.negative >= 0.35) return 'mixed';
  if (r.compound >= 0.35) return 'positive';
  if (r.compound >= 0.1) return 'peaceful';
  if (r.compound <= -0.35) return 'heavy';
  return 'neutral';
}
