// Talks to the backend (proxied to the API server by Vite in development).
const TOKEN_KEY = 'kalyan_token';

export const getToken = (): string | null => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t: string | null) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* session won't persist */ }
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Called when the server says the session is no longer valid. */
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your internet connection.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    setToken(null);
    onUnauthorized();
  }
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? 'Something went wrong');
  return data as T;
}

export interface Me { id: number; name: string; mobile: string; balance: number; betting: boolean }
export interface Rates { single: number; jodi: number; sp: number; dp: number; tp: number; half: number; full: number }
export interface PublicSettings {
  ticker: string; phone: string; whatsapp: string; minBid: number; maxBid: number; rates: Rates;
  howToPlay: string; notice: string; sliders: string[];
}
export interface MyBid { id: number; date: string; market: string; game: string; session: string | null; number: string; points: number; status: 'pending' | 'won' | 'lost' | 'reverted'; win: number }
