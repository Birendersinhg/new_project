export interface Market {
  id: number;
  name: string;
  open: string;
  close: string;
  result: string;
}

// [name, open, close] - times are local, 12-hour format.
export function toMinutes(t: string): number {
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) throw new Error(`Invalid time: ${t}`);
  const [, h, min, ap] = m;
  return (Number(h) % 12) * 60 + Number(min) + (ap.toUpperCase() === 'PM' ? 720 : 0);
}

const RAW: [name: string, open: string, close: string][] = [
  ['Sita Morning', '9:35 AM', '10:35 AM'],
  ['Karnataka Day', '9:50 AM', '10:50 AM'],
  ['Sridevi Morning', '10:00 AM', '11:00 AM'],
  ['Milan Morning', '10:20 AM', '11:20 AM'],
  ['Andhra Morning', '10:35 AM', '11:35 AM'],
  ['Mahadevi Morning', '11:35 AM', '12:35 PM'],
  ['Kalyan Morning', '11:40 AM', '12:40 PM'],
  ['Padmavathi', '11:40 AM', '12:40 PM'],
  ['Worli Morning', '12:00 PM', '1:00 PM'],
  ['New Time Bazar', '1:00 PM', '2:00 PM'],
  ['Sridevi Day', '1:25 PM', '2:25 PM'],
  ['Puna Bazar', '1:30 PM', '3:30 PM'],
  ['Sita Day', '1:35 PM', '2:35 PM'],
  ['Andhra Day', '3:30 PM', '5:30 PM'],
  ['Supreme Day', '3:35 PM', '5:35 PM'],
  ['Mahadevi', '4:20 PM', '6:20 PM'],
  ['Sita Night', '6:40 PM', '7:40 PM'],
  ['Karnataka Night', '6:45 PM', '7:45 PM'],
  ['Sridevi Night', '7:20 PM', '8:20 PM'],
  ['Mahadevi Night', '7:40 PM', '8:40 PM'],
  ['Padmavathi Night', '7:40 PM', '8:40 PM'],
  ['Andhra Night', '8:00 PM', '9:00 PM'],
  ['Supreme Night', '8:50 PM', '10:50 PM'],
  ['Old Mumbai', '9:40 PM', '11:30 PM'],
  ['Ratan Khatri', '9:40 PM', '11:40 PM'],
];

export const MARKETS: Market[] = RAW.map(([name, open, close], i) => ({
  id: i + 1,
  name,
  open,
  close,
  result: '***-**-***',
}));

export function isRunning(market: Market, now: Date = new Date()): boolean {
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= toMinutes(market.open) && mins < toMinutes(market.close);
}
