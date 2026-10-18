import * as copy from './errors';

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
      PHOTO_TOO_LARGE: 'Photo is too large to upload.',
    });
  });
});
