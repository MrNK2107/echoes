import { isValidEmail } from './email';

describe('isValidEmail', () => {
  it('accepts address-shaped text, ignoring surrounding spaces', () => {
    expect(isValidEmail(' a@b.co ')).toBe(true);
  });
  it('rejects empty, host-less and dot-less input', () => {
    for (const v of ['', 'nope', 'a@b', '@b.co']) expect(isValidEmail(v)).toBe(false);
  });
});
