import * as errors from './errors';

const { messageOf, ...copy } = errors;

describe('shared error copy', () => {
  it('keeps the user-facing strings every layer agrees on', () => {
    expect(copy).toEqual({
      GENERIC_ERROR: 'Something went wrong. Please try again.',
      TIMEOUT_ERROR: 'Could not reach the server. Check your connection and try again.',
      RESTORE_EXPIRED: 'This memory can no longer be restored.',
      INCORRECT_PASSWORD: 'Incorrect password.',
      BAD_CREDENTIALS: 'Incorrect email or password.',
      EMAIL_IN_USE: 'An account already exists for that email.',
      NOT_SIGNED_IN: 'Not signed in.',
      USER_EXISTS: 'This account is already set up.',
      PHOTO_TOO_LARGE: 'Photo is too large to upload.',
      REPORT_DUPLICATE: 'You already reported this.',
      REPORT_RATE: "You've sent a lot of reports today. Try again tomorrow.",
      OWNER_CANNOT_LEAVE: "Owners can't leave their community.",
      TRANSFER_DUPLICATE: 'A request to this person is already pending.',
      VERIFY_EMAIL_FIRST: 'Verify your email address first.',
      EMAIL_DOMAIN_NOT_APPROVED: "Your email domain isn't approved for this institution.",
    });
  });
});

describe('messageOf', () => {
  it("uses a rejection's message (repositories reject with user-facing copy)", () => {
    expect(messageOf(new Error(errors.REPORT_RATE))).toBe(errors.REPORT_RATE);
  });

  it('falls back to generic copy for empty messages and non-errors', () => {
    expect(messageOf(new Error(''))).toBe(errors.GENERIC_ERROR);
    expect(messageOf('boom')).toBe(errors.GENERIC_ERROR);
    expect(messageOf(undefined)).toBe(errors.GENERIC_ERROR);
  });
});
