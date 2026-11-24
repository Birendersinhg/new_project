// Static lists used by the admin pages. Live data (users, games, results, bids) comes from the API (see api.ts).
export const APP_NAME = 'Matka Admin';

export const today = () => new Date().toISOString().slice(0, 10);
export const prettyDate = (d = new Date()) =>
  d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
export const inr = (n: number | string | null | undefined) => '₹ ' + Number(n || 0).toLocaleString('en-IN');

// Market names shown in every "Game Name" / "Select Game" dropdown.
export const MARKETS = [
  'SRIDEVI MORNING', 'KARNATAKA DAY', 'RUDRAKSHA MORNING', 'MILAN MORNING', 'KALYAN MORNING', 'MADHUR MORNING',
  'SRIDEVI', 'TIME BAZAR', 'MADHUR DAY', 'MILAN DAY', 'RAJDHANI DAY', 'SUPREME DAY', 'KALYAN',
  'KARNATAKA NIGHT', 'SHRIDEVI NIGHT', 'RUDRAKSHA NIGHT', 'MADHUR NIGHT', 'SUPREME NIGHT', 'MILAN NIGHT',
  'KALYAN NIGHT', 'RAJDHANI NIGHT', 'MAIN BAZAR', 'TIRUPATI BAZAR',
];

export const SINGLE_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
export const JODI_DIGITS = Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0'));

// Panas use matka ordering where 0 ranks after 9.
const rank = (d: number) => (d === 0 ? 10 : d);
const ankOf = (s: string) => String([...s].reduce((a, c) => a + +c, 0) % 10);
function buildPanas() {
  const single: string[] = [], double: string[] = [], triple: string[] = [];
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
  for (const a of digits) for (const b of digits) for (const c of digits) {
    if (!(rank(a) <= rank(b) && rank(b) <= rank(c))) continue;
    const s = `${a}${b}${c}`;
    if (a === b && b === c) triple.push(s);
    else if (a === b || b === c) double.push(s);
    else single.push(s);
  }
  return { single, double, triple };
}
const P = buildPanas();
const groupByAnk = (list: string[]) =>
  SINGLE_DIGITS.map((ank) => ({ ank, items: list.filter((p) => ankOf(p) === ank) }));
export const SINGLE_PANA = P.single;
export const DOUBLE_PANA = P.double;
export const TRIPLE_PANA = P.triple;
export const SINGLE_PANA_BY_ANK = groupByAnk(P.single);
export const DOUBLE_PANA_BY_ANK = groupByAnk(P.double);
export const ALL_PANAS = [...P.single, ...P.double, ...P.triple].sort((a, b) => +a - +b);
export const panaAnk = ankOf;
export type PanaType = 'SP' | 'DP' | 'TP';
export const panaType = (p: string): PanaType => (P.triple.includes(p) ? 'TP' : P.double.includes(p) ? 'DP' : 'SP');
/** Every pana (all 220) grouped by its single digit, in matka order. */
export const PANA_BY_ANK = SINGLE_DIGITS.map((ank) => ({
  ank,
  items: [...P.single, ...P.double, ...P.triple].filter((p) => ankOf(p) === ank),
}));

export const GAME_TYPES = ['Single Digit', 'Jodi Digit', 'Single Pana', 'Double Pana', 'Tripple Pana', 'Half Sangam', 'Full Sangam'];

