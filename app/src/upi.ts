// UPI deep links.
//
// A UPI link only *starts* a payment; it can never confirm one. The customer pays, then
// sends us the 12-digit UTR from their UPI app and an admin (or a bank API) checks it.
// Nothing here may credit a wallet.
//
// The query string is built by hand on purpose: URLSearchParams encodes spaces as "+" and
// the "@" in a UPI ID as "%40", and several UPI apps reject links built that way.

export type UpiApp = 'gpay' | 'paytm' | 'phonepe' | 'any';

export interface UpiPayment {
  /** Payee UPI ID, e.g. shop@okhdfc */
  vpa: string;
  /** Payee name as it should appear in the UPI app. */
  name: string;
  /** Optional. Leave out for a payee-only link. */
  amount?: number;
  /** Optional transaction note (tn). */
  note?: string;
  /** Optional order/reference id (tr). */
  txnRef?: string;
}

export const PACKAGES = {
  gpay: 'com.google.android.apps.nbu.paisa.user',
  paytm: 'net.one97.paytm',
  phonepe: 'com.phonepe.app',
} as const;

export const IOS_SCHEME = {
  gpay: 'gpay://upi/pay',
  paytm: 'paytmmp://pay',
  phonepe: 'phonepe://pay',
} as const;

/** Apps offered as direct buttons. Everything else goes through the generic upi:// link. */
export const UPI_APPS: { id: keyof typeof PACKAGES; label: string }[] = [
  { id: 'gpay', label: 'Google Pay' },
  { id: 'phonepe', label: 'PhonePe' },
  { id: 'paytm', label: 'Paytm' },
];

/** Keeps "@" literal and spaces as %20 (never "+"). Some apps reject %40 and "+". */
const enc = (v: string) => encodeURIComponent(v).replace(/%40/g, '@');

/** Removes spaces and invisible characters that sneak in when an ID is pasted. */
export const cleanVpa = (v: string) => v.replace(/[^\x21-\x7e]/g, '');

export const isValidVpa = (v: string) => /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z0-9]{2,64}$/.test(v);

export function buildQuery(p: UpiPayment): string {
  const parts: [string, string][] = [['pa', cleanVpa(p.vpa)], ['pn', p.name.trim()]];
  if (p.amount !== undefined && Number.isFinite(p.amount) && p.amount > 0) {
    parts.push(['am', p.amount.toFixed(2)], ['cu', 'INR']);
  }
  const note = (p.note ?? '').trim();
  if (note) parts.push(['tn', note]);
  const ref = (p.txnRef ?? '').trim();
  if (ref) parts.push(['tr', ref]);
  return parts.map(([k, v]) => `${k}=${enc(v)}`).join('&');
}

export type Device = 'android' | 'ios' | 'other';

/** navigator is missing on the server and on some embedded webviews. */
const userAgent = () => (globalThis as unknown as { navigator?: { userAgent?: string } }).navigator?.userAgent ?? '';

export const deviceOf = (ua: string = userAgent()): Device =>
  /android/i.test(ua) ? 'android' : /iphone|ipad|ipod/i.test(ua) ? 'ios' : 'other';

/**
 * The best link for the device and the chosen app.
 * Android gets an intent:// link so the app opens directly; iOS gets its own scheme;
 * anywhere else (desktop, tablets, unknown webviews) gets the generic upi:// link.
 */
export function upiLink(p: UpiPayment, app: UpiApp = 'any', ua: string = userAgent()): string {
  const q = buildQuery(p);
  if (app === 'any') return `upi://pay?${q}`;
  const device = deviceOf(ua);
  if (device === 'android') return `intent://pay?${q}#Intent;scheme=upi;package=${PACKAGES[app]};end`;
  if (device === 'ios') return `${IOS_SCHEME[app]}?${q}`;
  return `upi://pay?${q}`;
}

/**
 * Payee-only link (pa + pn). Google Pay and Paytm often reject prefilled amounts to
 * personal UPI IDs; merchant/business IDs accept the full link. Use this as the fallback.
 */
export const upiLinkBasic = (p: UpiPayment, app: UpiApp = 'any', ua: string = userAgent()) =>
  upiLink({ vpa: p.vpa, name: p.name }, app, ua);

/** Mobile number behind an ID like 9876543210@paytm, so it can also be paid by number. */
export const payeeMobile = (vpa: string) => {
  const handle = cleanVpa(vpa).split('@')[0];
  return /^[6-9]\d{9}$/.test(handle) ? handle : '';
};

/** ₹ with two decimals, for the "pay exactly this" text. */
export const amountText = (amount: number) => `₹${amount.toFixed(2)}`;
