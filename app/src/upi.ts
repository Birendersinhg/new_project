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

/**
 * A reference the payer sees on the payment page and can quote to support, sent as `tr`.
 * Uppercase, no vowels-only words, well under the 35-character limit UPI apps accept.
 */
export function paymentRef(now: number = Date.now()): string {
  const tail = now.toString(36).slice(-6).toUpperCase();
  const salt = Math.random().toString(36).slice(2, 4).toUpperCase();
  return `KLN${tail}${salt}`;
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const under100 = (n: number): string =>
  n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;

const under1000 = (n: number): string => {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : '', rest ? under100(rest) : ''].filter(Boolean).join(' ');
};

/** "Rupees Three Hundred Only", in the Indian lakh/crore grouping. */
export function amountInWords(amount: number): string {
  const n = Math.floor(Math.abs(amount));
  if (!Number.isFinite(n) || n <= 0) return '';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts = [
    crore ? `${under1000(crore)} Crore` : '',
    lakh ? `${under100(lakh)} Lakh` : '',
    thousand ? `${under100(thousand)} Thousand` : '',
    rest ? under1000(rest) : '',
  ].filter(Boolean);
  return `Rupees ${parts.join(' ')} Only`;
}
