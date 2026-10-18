const DISPLAY_NAME_ERROR = 'Use 2 to 40 characters.';

export function validateDisplayName(s: string): string | null {
  const length = [...s.trim()].length;
  return length >= 2 && length <= 40 ? null : DISPLAY_NAME_ERROR;
}
