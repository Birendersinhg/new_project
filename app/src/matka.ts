// Matka number rules. Panas are 3 digits in matka order, where 0 ranks after 9 (e.g. 128, 190, 550).
export type PanaKind = 'SP' | 'DP' | 'TP';

const rank = (d: number) => (d === 0 ? 10 : d);
const ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

/** Ank (single digit) of a pana: sum of its digits mod 10. */
export const ankOf = (pana: string): string =>
  String([...pana].reduce((sum, c) => sum + Number(c), 0) % 10);

function buildPanas() {
  const SP: string[] = [], DP: string[] = [], TP: string[] = [];
  for (const a of ORDER) for (const b of ORDER) for (const c of ORDER) {
    if (!(rank(a) <= rank(b) && rank(b) <= rank(c))) continue;
    const p = `${a}${b}${c}`;
    if (a === b && b === c) TP.push(p);
    else if (a === b || b === c) DP.push(p);
    else SP.push(p);
  }
  return { SP, DP, TP };
}

export const PANAS: Record<PanaKind, string[]> = buildPanas();
const KIND_OF = new Map<string, PanaKind>(
  (Object.keys(PANAS) as PanaKind[]).flatMap((k) => PANAS[k].map((p) => [p, k] as const)),
);

export const DIGITS = ORDER.map(String).sort();
export const JODIS = Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0'));

/** Puts any 3 digits into matka order, so "821" and "182" both become "128". */
export function normalizePana(input: string): string | null {
  if (!/^\d{3}$/.test(input)) return null;
  return [...input].sort((x, y) => rank(Number(x)) - rank(Number(y))).join('');
}

export const panaKind = (pana: string): PanaKind | undefined => KIND_OF.get(pana);

/** All panas of the given kinds whose ank equals `digit`. */
export const panasForAnk = (digit: string, kinds: PanaKind[]): string[] =>
  kinds.flatMap((k) => PANAS[k].filter((p) => ankOf(p) === digit));

/** Motor: every pana of `kind` that can be made only from the chosen digits. */
export function motorPanas(digits: string, kind: 'SP' | 'DP'): string[] {
  const set = new Set(digits);
  return PANAS[kind].filter((p) => [...p].every((c) => set.has(c)));
}

export type GameKind = 'single' | 'jodi' | 'sp' | 'dp' | 'tp' | 'half' | 'full' | 'spdptp' | 'spmotor' | 'dpmotor';

export const GAME_KIND: Record<string, GameKind> = {
  'Single Digit': 'single',
  Jodi: 'jodi',
  'Single Pana': 'sp',
  'Double Pana': 'dp',
  'Triple Pana': 'tp',
  'Half Sangam': 'half',
  'Full Sangam': 'full',
  'SP DP TP': 'spdptp',
  'SP MOTER': 'spmotor',
  'DP MOTER': 'dpmotor',
};

export const PANA_KIND: Partial<Record<GameKind, PanaKind>> = { sp: 'SP', dp: 'DP', tp: 'TP' };
export const ALL_PANAS = [...PANAS.SP, ...PANAS.DP, ...PANAS.TP];
export const MOTOR_MIN_DIGITS = { spmotor: 4, dpmotor: 3 } as const;

export interface BidInput {
  a: string;
  b?: string;
  halfMode?: 'A' | 'B';
  kinds?: PanaKind[];
}

const KIND_NAME: Record<PanaKind, string> = { SP: 'Single', DP: 'Double', TP: 'Triple' };

function pana(v: string, label: string, want?: PanaKind): string {
  const p = normalizePana(v.trim());
  const k = p && panaKind(p);
  if (!p || !k) throw new Error(`Enter a valid ${label} (3 digits)`);
  if (want && k !== want) throw new Error(`${v} is not a ${KIND_NAME[want]} Pana`);
  return p;
}

function digit(v: string, label: string): string {
  if (!/^\d$/.test(v.trim())) throw new Error(`Enter a valid ${label} (0-9)`);
  return v.trim();
}

/** Validates the input for a game and returns the bid numbers it produces. Throws with a user-facing message. */
export function bidNumbers(kind: GameKind, { a, b = '', halfMode = 'A', kinds = [] }: BidInput): string[] {
  switch (kind) {
    case 'single': return [digit(a, 'digit')];
    case 'jodi':
      if (!/^\d{2}$/.test(a.trim())) throw new Error('Enter a valid Jodi (00-99)');
      return [a.trim()];
    case 'sp': case 'dp': case 'tp': return [pana(a, 'pana', PANA_KIND[kind])];
    case 'half':
      return [halfMode === 'A'
        ? `${digit(a, 'open digit')}-${pana(b, 'close pana')}`
        : `${pana(a, 'open pana')}-${digit(b, 'close digit')}`];
    case 'full': return [`${pana(a, 'open pana')}-${pana(b, 'close pana')}`];
    case 'spdptp':
      if (!kinds.length) throw new Error('Select at least one of SP, DP, TP');
      return panasForAnk(digit(a, 'digit'), kinds);
    case 'spmotor': case 'dpmotor': {
      const digits = [...new Set(a.replace(/\D/g, ''))].join('');
      const need = MOTOR_MIN_DIGITS[kind];
      if (digits.length < need) throw new Error(`Enter at least ${need} different digits`);
      const list = motorPanas(digits, kind === 'spmotor' ? 'SP' : 'DP');
      if (!list.length) throw new Error('No panas can be made from these digits');
      return list;
    }
  }
}

/** Numbers offered in the picker for a field with this label. */
export function pickerOptions(kind: GameKind, label: string): string[] {
  if (kind === 'spmotor' || kind === 'dpmotor') return DIGITS;
  if (label.includes('Pana')) {
    const pk = PANA_KIND[kind];
    return pk ? PANAS[pk] : ALL_PANAS;
  }
  return kind === 'jodi' ? JODIS : DIGITS;
}
