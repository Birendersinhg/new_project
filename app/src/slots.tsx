// Starline and Jackpot (Gali Disawar): time-slot games. Each slot takes bids until its time, then the admin's result settles them.
import { useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, CheckCircle2, Clock, Gamepad2, Trash2, Wallet } from 'lucide-react';
import { api, type SlotKind, type SlotList } from './api';
import { useAppData } from './appdata';
import { GAME_TYPES, GameIcon } from './games';
import { GAME_KIND, ankOf, bidNumbers, pickerOptions } from './matka';
import { NumberPicker } from './play';
import { PageHeader } from './screens';

export const SLOT_TITLE: Record<SlotKind, string> = { starline: 'STARLINE', jackpot: 'JACKPOT' };

const today = () => new Date().toLocaleDateString('en-GB').replace(/\//g, '-');

/** Today's result for a slot, with stars while it is not declared. */
const resultOf = (kind: SlotKind, result: string | null) =>
  kind === 'starline' ? (result ? `${result}-${ankOf(result)}` : '***-*') : (result ?? '**');

interface SlotsProps {
  kind: SlotKind;
  onBack: () => void;
  onPick: (slot: string, games: string[]) => void;
}

/** All of today's slots with their result and whether bids are still open. */
export function SlotsScreen({ kind, onBack, onPick }: SlotsProps) {
  const [data, setData] = useState<SlotList | null>(null);
  const [error, setError] = useState('');
  const [closed, setClosed] = useState('');

  useEffect(() => {
    const load = () => api<SlotList>('GET', `/slots/${kind}`).then(setData).catch((err: Error) => setError(err.message));
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [kind]);

  return (
    <div className="phone sub money">
      <PageHeader title={SLOT_TITLE[kind]} subtitle="Pick a time to play" onBack={onBack} right={<Clock size={26} />} />
      <div className="hub">
        {!data && <div className="info-box">{error || 'Loading...'}</div>}
        {closed && <div className="info-box">{closed} is closed for bids. Pick a later time.</div>}
        {data?.slots.map((s) => (
          <button key={s.slot} className="bh-row slot-row" onClick={() => (s.open ? onPick(s.slot, data.games) : setClosed(s.slot))}>
            <div className="bh-top">
              <b>{s.slot}</b>
              <span className={`bh-status ${s.open ? 'won' : 'reverted'}`}>{s.open ? 'Open' : 'Closed'}</span>
            </div>
            <div className="bh-mid">
              <span>Today&apos;s result</span>
              <span className="bh-num">{resultOf(kind, s.result)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

interface GamesProps {
  kind: SlotKind;
  slot: string;
  games: string[];
  onBack: () => void;
  onPick: (game: string) => void;
}

/** Game types offered for a Starline slot. */
export function SlotGamesScreen({ kind, slot, games, onBack, onPick }: GamesProps) {
  return (
    <div className="phone sub">
      <PageHeader title={`${SLOT_TITLE[kind]} ${slot}`} subtitle="Select Game Type" onBack={onBack} right={<Gamepad2 size={26} />} />
      <div className="game-grid">
        {GAME_TYPES.filter((g) => games.includes(g.name)).map((g) => (
          <button key={g.name} className="game-tile" onClick={() => onPick(g.name)}>
            <span className="game-icon"><GameIcon kind={g.icon} /></span>
            <b>{g.name}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

interface Bid { number: string; points: number }

interface PlayProps {
  kind: SlotKind;
  slot: string;
  game: string;
  balance: number;
  onBack: () => void;
  onAddMoney: () => void;
}

/** Bid screen for one slot and game; the server re-checks the time, numbers and balance on submit. */
export function SlotPlayScreen({ kind, slot, game, balance, onBack, onAddMoney }: PlayProps) {
  const { settings, refreshMe } = useAppData();
  const gameKind = GAME_KIND[game] ?? 'single';
  const [a, setA] = useState('');
  const [points, setPoints] = useState('');
  const [bids, setBids] = useState<Bid[]>([]);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const [lowBalance, setLowBalance] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const MIN = settings.minBid, MAX = settings.maxBid;

  const total = bids.reduce((s, b) => s + b.points, 0);
  const label = gameKind === 'jodi' ? 'Jodi' : game.includes('Pana') ? game : 'Digit';
  const options = pickerOptions(gameKind, label);

  const add = (e: FormEvent) => {
    e.preventDefault();
    const pts = Number(points);
    if (!Number.isInteger(pts) || pts < MIN || pts > MAX) return setError(`Points must be between ${MIN} and ${MAX}`);
    try {
      const [number] = bidNumbers(gameKind, { a });
      if (total + pts > balance) return setLowBalance(total + pts);
      setBids((list) => {
        const i = list.findIndex((b) => b.number === number);
        return i >= 0 ? list.map((b, j) => (j === i ? { ...b, points: b.points + pts } : b)) : [...list, { number, points: pts }];
      });
      setA('');
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await api('POST', '/slot-bids', { kind, slot, game, bids });
      setBids([]);
      setConfirm(false);
      setDone(true);
      refreshMe();
    } catch (err) {
      setConfirm(false);
      const msg = (err as Error).message;
      if (msg === 'Insufficient balance') setLowBalance(total);
      else setError(msg);
    }
    setSubmitting(false);
  };

  return (
    <div className="phone sub money">
      <PageHeader title={`${SLOT_TITLE[kind]} ${slot}`} subtitle={game} onBack={onBack}
        right={<span className="ph-pill"><Wallet size={16} /> ₹{balance.toFixed(2)}</span>} />
      <div className="hub play">
        {settings.texts.game && <div className="info-box">{settings.texts.game}</div>}
        <div className="play-card"><div className="play-date"><CalendarDays size={20} /> {today()}</div></div>

        <form className="play-card play-form" onSubmit={add}>
          <label className="play-field"><span>{label}</span>
            <input value={a} inputMode="numeric" placeholder={`Enter ${label}`} className="active"
              maxLength={gameKind === 'jodi' ? 2 : gameKind === 'single' ? 1 : 3}
              onChange={(e) => { setA(e.target.value.replace(/\D/g, '')); setError(''); }} />
          </label>
          <div className="picker">
            <div className="picker-title">Select {label}<small>{options.length} numbers</small></div>
            <NumberPicker options={options} value={a} grouped={options.length > 20 && gameKind !== 'jodi'}
              onPick={(n) => { setA(n); setError(''); }} />
          </div>
          <label className="play-field"><span>Points</span>
            <input value={points} inputMode="numeric" placeholder={`Min ${MIN}`}
              onChange={(e) => { setPoints(e.target.value.replace(/\D/g, '')); setError(''); }} />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-btn">ADD BID</button>
        </form>

        {bids.length > 0 && (
          <div className="play-card bid-list">
            <div className="bid-row head"><span>Number</span><span>Game</span><span>Points</span><span /></div>
            {bids.map((b, i) => (
              <div key={b.number} className="bid-row">
                <span>{b.number}</span>
                <span>{game}</span>
                <span>{b.points}</span>
                <button aria-label="Remove" onClick={() => setBids((l) => l.filter((_, j) => j !== i))}><Trash2 size={18} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="list-end" />
      </div>

      <div className="play-footer">
        <div><small>Bids</small><b>{bids.length}</b></div>
        <div><small>Points</small><b>{total}</b></div>
        <button className="auth-btn" disabled={!bids.length} onClick={() => (total > balance ? setLowBalance(total) : setConfirm(true))}>SUBMIT</button>
      </div>

      {confirm && (
        <div className="overlay center" onClick={() => setConfirm(false)}>
          <div className="closed-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: '#222' }}>Confirm Bids</h3>
            <p>{SLOT_TITLE[kind]} {slot} · {game}<br />{bids.length} bids · {total} points</p>
            <div className="seg">
              <button onClick={() => setConfirm(false)}>CANCEL</button>
              <button className="on" disabled={submitting} onClick={submit}>{submitting ? 'PLEASE WAIT' : 'CONFIRM'}</button>
            </div>
          </div>
        </div>
      )}
      {lowBalance !== null && (
        <div className="overlay center" onClick={() => setLowBalance(null)}>
          <div className="closed-modal" onClick={(e) => e.stopPropagation()}>
            <span className="closed-x"><Wallet size={42} /></span>
            <h3>Insufficient Balance</h3>
            <p>
              You need <b>₹{lowBalance}</b> for these bids but your wallet has <b>₹{balance.toFixed(2)}</b>.
              <br />Minimum bid is ₹{MIN}. Please add money to continue.
            </p>
            <div className="seg">
              <button onClick={() => setLowBalance(null)}>OK</button>
              <button className="on" onClick={onAddMoney}>ADD MONEY</button>
            </div>
          </div>
        </div>
      )}
      {done && (
        <div className="overlay center" onClick={() => setDone(false)}>
          <div className="closed-modal" onClick={(e) => e.stopPropagation()}>
            <span className="closed-x ok"><CheckCircle2 size={46} /></span>
            <h3 style={{ color: '#2e7d32' }}>Success</h3>
            <p>Your bids have been placed. Check them in My Bids.</p>
            <button className="auth-btn" onClick={() => setDone(false)}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
