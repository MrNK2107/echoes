import words from '../../../fixtures/domain/profanity.json';
import { normalizeName } from './communities';

// Single source of truth: fixtures/domain/profanity.json (shared with functions).
export const PROFANITY_WORDS: readonly string[] = words;

const WORD_SET = new Set(PROFANITY_WORDS);
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };

function deLeet(token: string): string {
  return token.replace(/[013457@$]/g, (c) => LEET[c] ?? c);
}

export function containsProfanity(text: string): boolean {
  const tokens = normalizeName(text).split(/[^\p{L}\p{N}@$]+/u);
  return tokens.some((t) => t.length > 0 && (WORD_SET.has(t) || WORD_SET.has(deLeet(t))));
}
