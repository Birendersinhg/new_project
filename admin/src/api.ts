import { useCallback, useEffect, useState } from 'react';

// Admin session token. Proxied to the API server by Vite in development.
const TOKEN_KEY = 'admin_token';

export const getToken = (): string | null => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t: string | null) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* not persisted */ }
};

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Cannot reach the API server. Is it running (npm run dev in server/)?');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    setToken(null);
    onUnauthorized();
  }
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Something went wrong');
  return data as T;
}

/** Loads `path` on mount and whenever it changes; `reload()` fetches again. Pass null to skip. */
export function useLoad<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    if (!path) return;
    try {
      setData(await api<T>('GET', path));
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }, [path]);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, reload };
}

// ---------- shapes returned by the server ----------
export interface AdminUser { id: number; name: string; mobile: string; balance: number; active: number; betting: number; approved: number; date: string }
export interface WalletRow { dt: string; amt: number; bal: number; remark: string }
export interface UserBid { date: string; game: string; type: string; session: string | null; digit: string; points: number; status: string; win: number }
export interface AdminMarket { id: number; name: string; open: string; close: string; active: number }
export interface DeclaredResult { marketId: number; name: string; date: string; open: string | null; close: string | null; openAnk: string | null; closeAnk: string | null }
export interface BidReportRow { id: number; user: string; mobile: string; market: string; game: string; session: string | null; number: string; points: number; status: string; win: number; time: string }
export interface Stats { users: number; approved: number; unapproved: number; games: number; bidsToday: number; pointsToday: number; winsToday: number }
export interface Rates { single: number; jodi: number; sp: number; dp: number; tp: number; half: number; full: number }
export interface Slider { url: string; order: number }
export interface AdminSettings {
  ticker: string; contact_phone: string; whatsapp: string; min_bid: string; max_bid: string; welcome_bonus: string;
  how_to_play: string; notice_board: string; rates: Rates; sliders: Slider[];
}

/** Today's date as YYYY-MM-DD in local time. */
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
