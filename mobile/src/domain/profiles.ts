import type { NotificationPrefs } from './types';

export const DISPLAY_NAME_ERROR = 'Use 2 to 40 characters.';

/** Shown, and used for a repaired public profile, when there is no valid display name. */
export const CUSTODIAN_FALLBACK_NAME = 'ECHOES custodian';

// C0 controls (incl. line breaks and tab) and DEL; firestore.rules' `^.{2,40}$` refuses line breaks.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export function validateDisplayName(s: string): string | null {
  const name = s.trim();
  const length = [...name].length;
  return length >= 2 && length <= 40 && !CONTROL_CHARS.test(name) ? null : DISPLAY_NAME_ERROR;
}

/** New accounts (and Plan 1/2 docs without the field) get every notification. */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = Object.freeze({
  transfers: true,
  tags: true,
  communityInvites: true,
});
