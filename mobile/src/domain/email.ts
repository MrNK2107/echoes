/** The shape check shared by the sign-in form and the auth repositories: something@host.tld, not a deliverability test. */
export function isValidEmail(value: string): boolean {
  const t = value.trim();
  const at = t.indexOf('@');
  return at > 0 && t.slice(at).includes('.');
}
