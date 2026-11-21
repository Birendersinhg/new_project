export interface Market {
  id: number;
  name: string;
  open: string;
  close: string;
  /** Today's declared panas, null until the admin declares them. */
  openPana?: string | null;
  closePana?: string | null;
}

export function toMinutes(t: string): number {
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) throw new Error(`Invalid time: ${t}`);
  const [, h, min, ap] = m;
  return (Number(h) % 12) * 60 + Number(min) + (ap.toUpperCase() === 'PM' ? 720 : 0);
}

/** Home card result: "128-15-140", "128-1*-***" after open only, "***-**-***" before any result. */
export function resultText(m: Market): string {
  const ank = (p: string) => String([...p].reduce((s, c) => s + Number(c), 0) % 10);
  const open = m.openPana ? `${m.openPana}-${ank(m.openPana)}` : '***-*';
  const close = m.closePana ? `${ank(m.closePana)}-${m.closePana}` : '*-***';
  return `${open}${close}`;
}

/** "9:35 AM" -> "09:35 AM" for the time table. */
export const padTime = (t: string): string => t.padStart(8, '0');

/** A market takes bids all day until its close time; after open time only the Close session is left. */
export function isRunning(market: Market, now: Date = new Date()): boolean {
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins < toMinutes(market.close);
}
