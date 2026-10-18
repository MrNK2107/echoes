import type { NotificationPrefs } from './types';

export const DISPLAY_NAME_ERROR = 'Use 2 to 40 characters.';

export function validateDisplayName(s: string): string | null {
  const length = [...s.trim()].length;
  return length >= 2 && length <= 40 ? null : DISPLAY_NAME_ERROR;
}

/** New accounts (and Plan 1/2 docs without the field) get every notification. */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = Object.freeze({
  transfers: true,
  tags: true,
  communityInvites: true,
});
