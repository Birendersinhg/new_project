// Frontend-only demo auth. Everything lives in this browser's localStorage and must be
// replaced by a real backend (server-side OTP + password hashing) before launch.
export interface StoredUser {
  name: string;
  hash: string;
}

export type UserMap = Record<string, StoredUser>;

const USERS_KEY = 'kalyan_users';
const SESSION_KEY = 'kalyan_session';

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked - session just won't persist */
  }
}

export async function hashPassword(mobile: string, password: string): Promise<string> {
  const text = `${mobile}:${password}`;
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Non-secure contexts (http over LAN) have no crypto.subtle; demo-only fallback.
  let h = 5381;
  for (const c of text) h = (h * 33) ^ c.charCodeAt(0);
  return String(h >>> 0);
}

export const getUsers = (): UserMap => read<UserMap>(USERS_KEY, {});
export const saveUser = (mobile: string, user: StoredUser): void => write(USERS_KEY, { ...getUsers(), [mobile]: user });
export const getSession = (): string | null => read<string | null>(SESSION_KEY, null);
export const setSession = (mobile: string): void => write(SESSION_KEY, mobile);
export const clearSession = (): void => {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
};
