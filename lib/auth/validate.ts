export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;
export const NAME_MAX = 100;
export const EMAIL_MAX = 254;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length <= EMAIL_MAX && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Mengembalikan pesan error, atau null bila password memenuhi aturan. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Password minimal ${PASSWORD_MIN} karakter.`;
  if (password.length > PASSWORD_MAX) return `Password maksimal ${PASSWORD_MAX} karakter.`;
  return null;
}
