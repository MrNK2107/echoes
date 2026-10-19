import { validateDisplayName, validateEmail, validatePassword } from './validators';

describe('validators', () => {
  it.each([
    ['', 'Email is required'],
    ['   ', 'Email is required'],
    ['nope', 'Enter a valid email'],
    ['a@b', 'Enter a valid email'],
    ['a.b', 'Enter a valid email'],
    ['a@b.co', null],
    ['  a@b.co  ', null],
  ])('validateEmail(%j)', (v, expected) => {
    expect(validateEmail(v)).toBe(expected);
  });

  it.each([
    ['', 'Password is required'],
    ['1234567', 'Use at least 8 characters'],
    ['12345678', null],
  ])('validatePassword(%j)', (v, expected) => {
    expect(validatePassword(v)).toBe(expected);
  });

  it.each([
    ['', 'Name is required'],
    ['  ', 'Name is required'],
    ['Ada', null],
    ['A', 'Use 2 to 40 characters.'],
    ['x'.repeat(41), 'Use 2 to 40 characters.'],
  ])('validateDisplayName(%j)', (v, expected) => {
    expect(validateDisplayName(v)).toBe(expected);
  });
});
