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

export interface Me {
  id: number; name: string; mobile: string; balance: number; betting: boolean; active: boolean;
  /** 'quiz' when the admin set Quiz App Mode globally or marked this account inactive. */
  mode: 'gaming' | 'quiz';
}
export interface Rates { single: number; jodi: number; sp: number; dp: number; tp: number; half: number; full: number }

/** Payee details for UPI payments, set by the admin. `enabled` is false until a UPI ID is saved. */
export interface UpiConfig {
  enabled: boolean;
  /** 'qr' shows only the QR code; 'upi' opens the customer's UPI app. Set by the admin. */
  type: 'qr' | 'upi';
  vpa: string;
  /** The payee's mobile number, shown to the customer; links still pay the VPA. */
  mobile: string;
  name: string;
  note: string;
  minDeposit: number;
  minWithdraw: number;
}

export interface PublicSettings {
  ticker: string; phone: string; whatsapp: string; minBid: number; maxBid: number; rates: Rates; slotRates: SlotRates;
  howToPlay: string; notice: string; sliders: string[];
  /** Short admin-written messages for individual screens; empty means hidden. */
  texts: { home: string; rates: string; timetable: string; support: string; game: string };
  /** What the app shows after login; switched by the admin from Auto Active. */
  mode: 'gaming' | 'quiz';
  /** Seconds allowed per quiz question. */
  quizTimer: number;
  /** Where to send UPI payments. */
  upi: UpiConfig;
  /** Reassurance lines shown under the payment options; the admin edits them. */
  trust: { title: string; items: string[] };
}

export type PaymentStatus = 'pending' | 'approved' | 'paid' | 'rejected';

/** A top-up the customer says they paid; credited only after the admin checks the UTR. */
export interface DepositRow {
  id: number; amount: number; utr: string; /** UPI ID or mobile the customer paid from. */
  payer: string | null; status: PaymentStatus; remark: string | null; date: string;
}

/** A withdrawal request; the amount is held from the balance when it is created. */
export interface WithdrawRow {
  id: number; amount: number; method: 'upi' | 'bank';
  upi: string | null; accountName: string | null; accountNo: string | null; ifsc: string | null;
  status: PaymentStatus; remark: string | null; date: string;
}

export interface MyPayments { deposits: DepositRow[]; withdrawals: WithdrawRow[] }
export type SlotKind = 'starline' | 'jackpot';
/** Today's Starline/Jackpot time slots: `open` is decided by the server clock, `result` is the pana (Starline) or jodi (Jackpot). */
export interface SlotList { games: string[]; slots: { slot: string; open: boolean; result: string | null }[] }
export interface SlotBid { id: number; date: string; at: string; kind: SlotKind; slot: string; game: string; number: string; points: number; status: 'pending' | 'won' | 'lost' | 'reverted'; win: number }
export interface SlotRates { starSingle: number; starSp: number; starDp: number; starTp: number; jackpotJodi: number }
export interface SupportMessage { id: number; sender: 'user' | 'admin'; text: string; at: string }
export interface AppNotification { id: number; title: string; message: string; at: string }
export interface PassbookRow { id: number; at: string; amount: number; balance: number; remark: string }
export interface MyBid { id: number; at: string; date: string; market: string; game: string; session: string | null; number: string; points: number; status: 'pending' | 'won' | 'lost' | 'reverted'; win: number }
