import { validateDisplayName } from './profiles';

describe('validateDisplayName', () => {
  const msg = 'Use 2 to 40 characters.';
  it('accepts 2 to 40 characters after trim', () => {
    expect(validateDisplayName('Al')).toBeNull();
    expect(validateDisplayName('  Ann  ')).toBeNull();
    expect(validateDisplayName('x'.repeat(40))).toBeNull();
  });
  it('rejects too short or too long', () => {
    expect(validateDisplayName('')).toBe(msg);
    expect(validateDisplayName(' a ')).toBe(msg);
    expect(validateDisplayName('x'.repeat(41))).toBe(msg);
  });
  it('rejects control characters, including line breaks', () => {
    for (const s of ['Ann\nLee', 'Ann\rLee', 'Ann\tLee', 'Ann\u0000', 'Ann\u007f', 'Ann\u001f']) {
      expect(validateDisplayName(s)).toBe(msg);
    }
    expect(validateDisplayName('Zoë Ángel 🙂')).toBeNull();
  });
});
