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

/**
 * Loads `path` on mount and whenever it changes; `reload()` fetches again. Pass null to skip.
 * `everyMs` keeps it fresh (used by the auto deposit screens, which change without a click).
 */
export function useLoad<T>(path: string | null, everyMs?: number) {
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
  useEffect(() => {
    reload();
    if (!everyMs) return;
    const timer = setInterval(reload, everyMs);
    return () => clearInterval(timer);
  }, [reload, everyMs]);
  return { data, error, reload };
}

// ---------- shapes returned by the server ----------
export interface AdminUser { id: number; name: string; mobile: string; balance: number; active: number; betting: number; approved: number; date: string }
export interface WalletRow { dt: string; amt: number; bal: number; remark: string }
export interface UserBid { date: string; game: string; type: string; session: string | null; digit: string; points: number; status: string; win: number }
export interface AdminMarket { id: number; name: string; open: string; close: string; active: number }
export interface DeclaredResult { marketId: number; name: string; date: string; open: string | null; close: string | null; openAnk: string | null; closeAnk: string | null }
export interface BidReportRow { id: number; user: string; mobile: string; market: string; game: string; session: string | null; number: string; points: number; status: string; win: number; time: string }
export interface Stats {
  users: number; approved: number; unapproved: number; games: number; bidsToday: number; pointsToday: number; winsToday: number;
  registeredToday: number; loggedInToday: number;
  /** Credited auto deposits (today) and every approved top-up today. */
  autoDepositToday: number; autoDepositCountToday: number; autoDepositTotal: number; depositToday: number;
}
export interface DailyUser { id: number; name: string; mobile: string; balance: number; active: number; time: string; logins?: number }
export interface DailyUsers { date: string; registered: DailyUser[]; loggedIn: DailyUser[] }

/** One payment pushed in by the UPI payment feed. */
export interface AdminAutoDeposit {
  id: number; amount: number; utr: string; payer: string | null; payerName: string | null;
  payee: string | null; note: string | null; status: 'credited' | 'unmatched' | 'pending' | 'rejected';
  remark: string | null; source: string | null;
  userId: number | null; userName: string | null; userMobile: string | null; paymentId: number | null;
  date: string; time: string;
}

/** A row of the deposit report: every top-up claim, auto or manual. */
export interface AdminDepositRow {
  id: number; name: string; mobile: string; amount: number; utr: string; payer: string | null;
  status: 'pending' | 'approved' | 'rejected'; remark: string | null; date: string; time: string; auto: number;
}

/** Where the payment feed has to post, and the key it signs every payment with. */
export interface AutoDepositFeed {
  url: string; key: string; upi: string;
  lastPayment: string | null;
  attempts: { at: string; code: number; detail: string }[];
}
export interface Rates { single: number; jodi: number; sp: number; dp: number; tp: number; half: number; full: number }
export interface Slider { url: string; order: number }
export interface SlotRates { starSingle: number; starSp: number; starDp: number; starTp: number; jackpotJodi: number }
export interface AdminSettings {
  slotRates: SlotRates;
  maintenance_on: string; maintenance_msg: string; app_name: string; theme_start: string; theme_end: string; theme_accent: string; theme_bg: string; ticker: string; contact_phone: string; whatsapp: string; min_bid: string; max_bid: string; welcome_bonus: string;
  how_to_play: string; notice_board: string;
  text_home: string; text_rates: string; text_timetable: string; text_support: string; text_game: string; rates: Rates; sliders: Slider[];
  app_mode: 'gaming' | 'quiz'; quiz_timer: string;
  /** The payee's mobile number; the app builds the UPI address from it. */
  pay_mobile: string;
  /** UPI payee used by the app to build payment links. */
  upi_id: string; upi_name: string; upi_note: string; upi_enabled: string; min_deposit: string; min_withdraw: string;
  /** '1' credits a UPI payment to the wallet as soon as the feed reports it; '0' waits for the admin. */
  auto_credit: string;
  /** How the app takes payment: 'qr' shows the QR only, 'upi' opens a UPI app. */
  payment_type: string;
  /** Trust and security messages visible on the app Add Money page when enabled. */
  trust_title: string; trust_note: string;
}

/** A top-up claim waiting for the admin to check its UTR. */
export interface AdminDeposit {
  id: number; userId: number; name: string; mobile: string; balance: number;
  amount: number; utr: string; payer: string | null; status: 'pending' | 'approved' | 'rejected';
  remark: string | null; date: string; reviewed: string | null;
}

/** A withdrawal request; the points were held when the user submitted it. */
export interface AdminWithdrawal {
  id: number; userId: number; name: string; mobile: string; balance: number;
  amount: number; method: 'upi' | 'bank'; upi: string | null;
  accountName: string | null; accountNo: string | null; ifsc: string | null;
  status: 'pending' | 'paid' | 'rejected'; remark: string | null; date: string; reviewed: string | null;
}

/** Today's date as YYYY-MM-DD in local time. */
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** The date `days` days ago, for the report's "last 7 days" default. */
export const isoDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
