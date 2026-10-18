/**
 * User-facing error copy shared across layers. Repositories throw `Error(<one of these>)` on
 * purpose and screens match on the message, so both sides must use the same constant.
 */
export const GENERIC_ERROR = 'Something went wrong. Please try again.';
export const TIMEOUT_ERROR = 'Could not reach the server. Check your connection and try again.';
export const RESTORE_EXPIRED = 'This memory can no longer be restored.';
export const INCORRECT_PASSWORD = 'Incorrect password.';
export const BAD_CREDENTIALS = 'Incorrect email or password.';
export const EMAIL_IN_USE = 'An account already exists for that email.';
export const NOT_SIGNED_IN = 'Not signed in.';
export const PHOTO_TOO_LARGE = 'Photo is too large to upload.';
export const REPORT_DUPLICATE = 'You already reported this memory.';
export const REPORT_RATE = "You've sent a lot of reports today. Try again tomorrow.";
export const OWNER_CANNOT_LEAVE = "Owners can't leave their community.";
export const TRANSFER_DUPLICATE = 'A request to this person is already pending.';
export const VERIFY_EMAIL_FIRST = 'Verify your email address first.';
export const EMAIL_DOMAIN_NOT_APPROVED = "Your email domain isn't approved for this institution.";
