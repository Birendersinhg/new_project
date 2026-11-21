// Bid validation and result settlement. Uses the app's own matka rules so both sides always agree.
import { GAME_KIND, ankOf, normalizePana, panaKind, type GameKind } from '../../app/src/matka.ts';
import { changeBalance, db, getSetting } from './db.ts';

export type Rates = Record<'single' | 'jodi' | 'sp' | 'dp' | 'tp' | 'half' | 'full', number>;
export const getRates = (): Rates => JSON.parse(getSetting('rates')) as Rates;

/** Games that need both sessions' results, so they can only be played before the market opens. */
export const OPEN_ONLY: GameKind[] = ['jodi', 'half', 'full'];

export function gameKind(game: string): GameKind {
  const kind = GAME_KIND[game];
  if (!kind) throw new Error(`Unknown game: ${game}`);
  return kind;
}

const isDigit = (s: string) => /^\d$/.test(s);
const pana = (s: string) => {
  const p = normalizePana(s);
  return p && panaKind(p) ? p : null;
};

/** Returns the canonical bid number for this game, or null if it is not a valid number for it. */
export function canonicalNumber(kind: GameKind, number: string): string | null {
  const n = String(number).trim();
  switch (kind) {
    case 'single': return isDigit(n) ? n : null;
    case 'jodi': return /^\d{2}$/.test(n) ? n : null;
    case 'sp': case 'dp': case 'tp': {
      const p = pana(n);
      return p && panaKind(p) === { sp: 'SP', dp: 'DP', tp: 'TP' }[kind] ? p : null;
    }
    case 'spdptp': return pana(n);
    case 'spmotor': { const p = pana(n); return p && panaKind(p) === 'SP' ? p : null; }
    case 'dpmotor': { const p = pana(n); return p && panaKind(p) === 'DP' ? p : null; }
    case 'half': {
      const [x, y] = n.split('-');
      if (x && y && isDigit(x) && pana(y)) return `${x}-${pana(y)}`;
      if (x && y && pana(x) && isDigit(y)) return `${pana(x)}-${y}`;
      return null;
    }
    case 'full': {
      const [x, y] = n.split('-');
      return x && y && pana(x) && pana(y) ? `${pana(x)}-${pana(y)}` : null;
    }
  }
}

interface ResultRow { open_pana: string | null; close_pana: string | null }
interface BidRow { id: number; user_id: number; game: string; session: string | null; number: string; points: number; status: string; win_amount: number }

/** Win amount for a bid, null while the result it depends on is not declared, 0 if it lost. */
export function outcome(bid: Pick<BidRow, 'game' | 'session' | 'number' | 'points'>, r: ResultRow | undefined, rates: Rates): number | null {
  const kind = gameKind(bid.game);
  const O = r?.open_pana ?? null, C = r?.close_pana ?? null;
  const pay = (key: keyof Rates) => Math.floor((bid.points * rates[key]) / 10);
  const sessionPana = bid.session === 'Open' ? O : C;

  switch (kind) {
    case 'single':
      if (!sessionPana) return null;
      return bid.number === ankOf(sessionPana) ? pay('single') : 0;
    case 'sp': case 'dp': case 'tp': case 'spdptp': case 'spmotor': case 'dpmotor': {
      if (!sessionPana) return null;
      const key = ({ SP: 'sp', DP: 'dp', TP: 'tp' } as const)[panaKind(bid.number)!];
      return bid.number === sessionPana ? pay(key) : 0;
    }
    case 'jodi':
      if (!O || !C) return null;
      return bid.number === ankOf(O) + ankOf(C) ? pay('jodi') : 0;
    case 'half': {
      if (!O || !C) return null;
      const [x, y] = bid.number.split('-');
      const win = x.length === 1 ? x === ankOf(O) && y === C : x === O && y === ankOf(C);
      return win ? pay('half') : 0;
    }
    case 'full': {
      if (!O || !C) return null;
      const [x, y] = bid.number.split('-');
      return x === O && y === C ? pay('full') : 0;
    }
  }
}

/**
 * Brings every bid of a market/date in line with its current result. Safe to run any number of times:
 * declaring, correcting or deleting a result only pays or reverses the difference.
 * Must be called inside a transaction.
 */
export function settle(marketId: number, date: string): { won: number; lost: number; pending: number } {
  const result = db.prepare('SELECT open_pana, close_pana FROM results WHERE market_id = ? AND date = ?').get(marketId, date) as ResultRow | undefined;
  const market = db.prepare('SELECT name FROM markets WHERE id = ?').get(marketId) as { name: string };
  const bids = db.prepare('SELECT id, user_id, game, session, number, points, status, win_amount FROM bids WHERE market_id = ? AND date = ? AND status != \'reverted\'')
    .all(marketId, date) as unknown as BidRow[];
  const rates = getRates();
  const update = db.prepare('UPDATE bids SET status = ?, win_amount = ? WHERE id = ?');
  const count = { won: 0, lost: 0, pending: 0 };

  for (const bid of bids) {
    const win = outcome(bid, result, rates);
    const status = win === null ? 'pending' : win > 0 ? 'won' : 'lost';
    const amount = win ?? 0;
    count[status as keyof typeof count]++;
    if (status === bid.status && amount === bid.win_amount) continue;
    // Reverse any earlier payout first, then pay the new one. Reversal may take the balance to what it was.
    if (bid.win_amount > 0) reverseWin(bid.user_id, bid.win_amount, `Result corrected: ${market.name} ${bid.game} ${bid.number}`);
    if (amount > 0) changeBalance(bid.user_id, amount, `Win: ${market.name} ${bid.game} ${bid.number}`);
    update.run(status, amount, bid.id);
  }
  return count;
}

/** Takes back a payout; if the user already spent it, the balance stops at 0 rather than failing the correction. */
function reverseWin(userId: number, amount: number, remark: string) {
  const { balance } = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId) as { balance: number };
  const take = Math.min(balance, amount);
  if (take > 0) changeBalance(userId, -take, remark);
}
