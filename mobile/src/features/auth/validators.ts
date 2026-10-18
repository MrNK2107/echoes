export function validateEmail(v: string): string | null {
  const t = v.trim();
  if (!t) return 'Email is required';
  const at = t.indexOf('@');
  if (at < 0 || !t.slice(at).includes('.')) return 'Enter a valid email';
  return null;
}

export function validatePassword(v: string): string | null {
  if (!v) return 'Password is required';
  if (v.length < 8) return 'Use at least 8 characters';
  return null;
}

export function validateDisplayName(v: string): string | null {
  return v.trim() ? null : 'Name is required';
}
