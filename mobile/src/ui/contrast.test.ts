import { AURA_COLORS } from '@/domain/aura';

import { colors } from './theme';

const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) / 255) + 0.7152 * lin(((n >> 8) & 255) / 255) + 0.0722 * lin((n & 255) / 255);
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

describe('chart contrast', () => {
  it('uses the chart surface colour from the theme', () => {
    expect(colors.surface).toBe('#161B22');
  });
  for (const [name, hex] of Object.entries(AURA_COLORS)) {
    it(`aura ${name} (${hex}) is at least 3:1 against the chart surface`, () => {
      expect(ratio(hex, '#161B22')).toBeGreaterThanOrEqual(3);
    });
  }
});
