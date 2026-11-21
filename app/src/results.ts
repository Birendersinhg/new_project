// Chart helpers. Results themselves come from the server (one per market per date).
import { ankOf } from './matka';

/** Panas declared for one market on one date. Ank and jodi are always derived, never stored. */
export interface MarketResult {
  open?: string;
  close?: string;
}

export const STARLINE_SLOTS = ['10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM',
  '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM', '11:00 PM'];
export const DISAWAR_SLOTS = ['10:30 AM', '11:30 AM', '12:30 PM', '1:30 PM', '2:30 PM', '3:30 PM', '4:30 PM',
  '5:00 PM', '5:30 PM', '6:30 PM', '7:30 PM', '8:30 PM', '9:30 PM', '10:30 PM', '11:30 PM'];

// ---------- dates (local time, not UTC, so "today" matches the user's clock) ----------
export const isoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const showDate = (iso: string): string => iso.split('-').reverse().join('-');
export const addDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Monday of the week containing `d`. */
export const weekStart = (d: Date): Date => addDays(d, -((d.getDay() + 6) % 7));

export const jodiOf = (r: MarketResult): string | undefined =>
  r.open && r.close ? ankOf(r.open) + ankOf(r.close) : undefined;

/** Red jodi: both digits equal or 5 apart (00, 05, 11, 16, ... 94, 99). Highlighted in charts. */
export const isRedJodi = (j: string) => (Number(j[0]) - Number(j[1]) + 10) % 5 === 0;

// ---------- cleanup of data kept in the browser before the server existed ----------
const OLD_KEYS = ['kalyan_users', 'kalyan_session', 'kalyan_results_market', 'kalyan_results_starline', 'kalyan_results_disawar', 'kalyan_results_demo'];

/** Removes the old browser-only accounts and results; everything now lives on the server. */
export function clearOldLocalData() {
  try { for (const k of OLD_KEYS) localStorage.removeItem(k); } catch { /* ignore */ }
}
