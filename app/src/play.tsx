import { useState, type FormEvent } from 'react';
import { CalendarDays, CheckCircle2, Trash2, Wallet } from 'lucide-react';
import { toMinutes, type Market } from './data';
import { DIGITS, GAME_KIND, ankOf, bidNumbers, normalizePana, pickerOptions, type GameKind, type PanaKind } from './matka';
import { PageHeader } from './screens';
import { api } from './api';
import { useAppData } from './appdata';
import { useT } from './i18n';

type Session = 'Open' | 'Close';

/** Games that use both sessions' results can only be played before the market opens. */
const OPEN_ONLY: GameKind[] = ['jodi', 'half', 'full'];

interface Bid {
  number: string;
  session: Session | null;
  points: number;
}

interface PickerProps {
  options: string[];
  value: string;
  grouped: boolean;
  multi?: boolean;
  onPick: (n: string) => void;
}

/** Tappable grid of valid numbers; panas are grouped by ank and the list narrows as you type. */
export function NumberPicker({ options, value, grouped, multi, onPick }: PickerProps) {
  const t = useT();
  const norm = normalizePana(value);
  const shown = multi || !value ? options : options.filter((o) => o.startsWith(value) || o === norm);
  const chip = (n: string) => (
    <button key={n} type="button" className={`num-chip ${(multi ? value.includes(n) : value === n || n === norm) ? 'on' : ''}`} onClick={() => onPick(n)}>
      {n}
    </button>
  );
  if (!shown.length) return <div className="picker-empty">{t('No matching number')}</div>;
  if (!grouped) return <div className="num-grid">{shown.map(chip)}</div>;
  return (
    <div className="picker-groups">
      {DIGITS.map((ank) => {
        const list = shown.filter((p) => ankOf(p) === ank);
        return list.length ? (
          <div key={ank}>
            <div className="ank-head">{t('Ank')} <b>{ank}</b> <small>{list.length}</small></div>
            <div className="num-grid">{list.map(chip)}</div>
          </div>
        ) : null;
      })}
    </div>
  );
}

const today = () => new Date().toLocaleDateString('en-GB').replace(/\//g, '-');

interface PlayProps {
  market: Market;
  game: string;
  now: Date;
  balance: number;
  onBack: () => void;
  onAddMoney: () => void;
}

export function GamePlayScreen({ market, game, now, balance, onBack, onAddMoney }: PlayProps) {
  const t = useT();
  const kind = GAME_KIND[game] ?? 'single';
  const mins = now.getHours() * 60 + now.getMinutes();
  const openPassed = mins >= toMinutes(market.open);
  const usesSession = !OPEN_ONLY.includes(kind);
  const blocked = OPEN_ONLY.includes(kind) && openPassed;

  const [session, setSession] = useState<Session>(openPassed ? 'Close' : 'Open');
  const [halfMode, setHalfMode] = useState<'A' | 'B'>('A');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [kinds, setKinds] = useState<PanaKind[]>(['SP', 'DP', 'TP']);
  const [points, setPoints] = useState('');
  const [bids, setBids] = useState<Bid[]>([]);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const [field, setField] = useState<'a' | 'b'>('a');
  const [lowBalance, setLowBalance] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { settings, refreshMe } = useAppData();
  const MIN_POINTS = settings.minBid;
  const MAX_POINTS = settings.maxBid;

  const isMotor = kind === 'spmotor' || kind === 'dpmotor';

  const total = bids.reduce((s, x) => s + x.points, 0);
  const reset = () => { setA(''); setB(''); setError(''); setField('a'); };

  // Same number + session adds to the existing row instead of duplicating it.
  const addBids = (numbers: string[], pts: number) => {
    const sess = usesSession ? session : null;
    setBids((list) => {
      const next = [...list];
      for (const number of numbers) {
        const i = next.findIndex((x) => x.number === number && x.session === sess);
        if (i >= 0) next[i] = { ...next[i], points: next[i].points + pts };
        else next.push({ number, session: sess, points: pts });
      }
      return next;
    });
    reset();
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (usesSession && session === 'Open' && openPassed) return setError(t('Open session is closed. Select Close.'));
    const pts = Number(points);
    if (!Number.isInteger(pts) || pts < MIN_POINTS || pts > MAX_POINTS) {
      return setError(t('Points must be between {min} and {max}', { min: MIN_POINTS, max: MAX_POINTS }));
    }
    try {
      const numbers = bidNumbers(kind, { a, b, halfMode, kinds });
      // Every bid in the list must be covered by the wallet, including the ones being added now.
      const needed = total + numbers.length * pts;
      if (needed > balance) return setLowBalance(needed);
      addBids(numbers, pts);
    } catch (err) {
      setError(t((err as Error).message));
    }
  };

  // The server re-checks every rule (time, numbers, balance) and deducts the points.
  const submit = async () => {
    setSubmitting(true);
    try {
      await api('POST', '/bids', {
        marketId: market.id, game, session: usesSession ? session : null,
        bids: bids.map(({ number, points }) => ({ number, points })),
      });
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

  const inputLabel: Record<GameKind, [string, string?]> = {
    single: ['Digit'], jodi: ['Jodi'], sp: ['Single Pana'], dp: ['Double Pana'], tp: ['Triple Pana'],
    half: halfMode === 'A' ? ['Open Digit', 'Close Pana'] : ['Open Pana', 'Close Digit'],
    full: ['Open Pana', 'Close Pana'], spdptp: ['Digit'],
    spmotor: ['Digits (e.g. 12345)'], dpmotor: ['Digits (e.g. 1234)'],
  };
  const [labelA, labelB] = inputLabel[kind];
  const activeLabel = (field === 'b' && labelB) || labelA;
  const options = pickerOptions(kind, activeLabel);
  const activeValue = field === 'b' && labelB ? b : a;
  const pick = (n: string) => {
    setError('');
    if (isMotor) setA((v) => (v.includes(n) ? v.replace(n, '') : (v + n).slice(0, 10)));
    else if (field === 'b' && labelB) setB(n);
    else {
      setA(n);
      if (labelB) setField('b');
    }
  };

  return (
    <div className="phone sub money">
      <PageHeader
        title={market.name.toUpperCase()}
        subtitle={game}
        onBack={onBack}
        right={<span className="ph-pill"><Wallet size={16} /> ₹{balance.toFixed(2)}</span>}
      />
      <div className="hub play">
        {settings.texts.game && <div className="info-box">{settings.texts.game}</div>}
        <div className="play-card">
          <div className="play-date"><CalendarDays size={20} /> {today()}</div>
          {usesSession && (
            <div className="seg">
              {(['Open', 'Close'] as Session[]).map((s) => (
                <button key={s} type="button" disabled={s === 'Open' && openPassed}
                  className={session === s ? 'on' : ''} onClick={() => { setSession(s); setError(''); }}>
                  {t(s).toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        {blocked ? (
          <div className="info-box">{t("{game} closes at the market's open time ({time}). Please play tomorrow.", { game: t(game), time: market.open })}</div>
        ) : (
          <form className="play-card play-form" onSubmit={add}>
            {kind === 'half' && (
              <div className="seg">
                <button type="button" className={halfMode === 'A' ? 'on' : ''} onClick={() => { setHalfMode('A'); reset(); }}>{t('Half Sangam A')}</button>
                <button type="button" className={halfMode === 'B' ? 'on' : ''} onClick={() => { setHalfMode('B'); reset(); }}>{t('Half Sangam B')}</button>
              </div>
            )}
            <label className="play-field"><span>{t(labelA)}</span>
              <input value={a} inputMode="numeric" placeholder={t('Enter {label}', { label: t(labelA) })} onFocus={() => setField('a')}
                className={field === 'a' ? 'active' : ''}
                maxLength={kind.endsWith('motor') ? 10 : labelA.includes('Pana') ? 3 : kind === 'jodi' ? 2 : 1}
                onChange={(e) => { setA(e.target.value.replace(/\D/g, '')); setError(''); }} />
            </label>
            {labelB && (
              <label className="play-field"><span>{t(labelB)}</span>
                <input value={b} inputMode="numeric" placeholder={t('Enter {label}', { label: t(labelB) })} onFocus={() => setField('b')}
                  className={field === 'b' ? 'active' : ''}
                  maxLength={labelB.includes('Pana') ? 3 : 1}
                  onChange={(e) => { setB(e.target.value.replace(/\D/g, '')); setError(''); }} />
              </label>
            )}
            <div className="picker">
              <div className="picker-title">
                {isMotor ? t('Tap digits to select') : t('Select {label}', { label: t(activeLabel) })}
                <small>{t('{n} numbers', { n: options.length })}</small>
              </div>
              <NumberPicker options={options} value={activeValue} grouped={options.length > 20 && kind !== 'jodi'}
                multi={isMotor} onPick={pick} />
            </div>
            {kind === 'spdptp' && (
              <div className="checks">
                {(['SP', 'DP', 'TP'] as PanaKind[]).map((k) => (
                  <label key={k}>
                    <input type="checkbox" checked={kinds.includes(k)}
                      onChange={() => setKinds((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))} /> {k}
                  </label>
                ))}
              </div>
            )}
            <label className="play-field"><span>{t('Points')}{kind === 'spdptp' || kind.endsWith('motor') ? ` ${t('(per pana)')}` : ''}</span>
              <input value={points} inputMode="numeric" placeholder={t('Min {n}', { n: MIN_POINTS })}
                onChange={(e) => { setPoints(e.target.value.replace(/\D/g, '')); setError(''); }} />
            </label>
            {error && <div className="auth-error">{t(error)}</div>}
            <button className="auth-btn">{t('ADD BID')}</button>
          </form>
        )}

        {bids.length > 0 && (
          <div className="play-card bid-list">
            <div className="bid-row head"><span>{t('Number')}</span><span>{t('Session')}</span><span>{t('Points')}</span><span /></div>
            {bids.map((x, i) => (
              <div key={`${x.number}-${x.session}`} className="bid-row">
                <span>{x.number}</span>
                <span>{x.session ? t(x.session) : '-'}</span>
                <span>{x.points}</span>
                <button aria-label="Remove" onClick={() => setBids((l) => l.filter((_, j) => j !== i))}><Trash2 size={18} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="list-end" />
      </div>

      <div className="play-footer">
        <div><small>{t('Bids')}</small><b>{bids.length}</b></div>
        <div><small>{t('Points')}</small><b>{total}</b></div>
        <button className="auth-btn" disabled={!bids.length} onClick={() => (total > balance ? setLowBalance(total) : setConfirm(true))}>{t('SUBMIT')}</button>
      </div>

      {confirm && (
        <div className="overlay center" onClick={() => setConfirm(false)}>
          <div className="closed-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: '#222' }}>{t('Confirm Bids')}</h3>
            <p>{market.name} · {t(game)}<br />{t('{bids} bids · {points} points', { bids: bids.length, points: total })}</p>
            <div className="seg">
              <button onClick={() => setConfirm(false)}>{t('CANCEL')}</button>
              <button className="on" disabled={submitting} onClick={submit}>{t(submitting ? 'PLEASE WAIT' : 'CONFIRM')}</button>
            </div>
          </div>
        </div>
      )}
      {lowBalance !== null && (
        <div className="overlay center" onClick={() => setLowBalance(null)}>
          <div className="closed-modal" onClick={(e) => e.stopPropagation()}>
            <span className="closed-x"><Wallet size={42} /></span>
            <h3>{t('Insufficient Balance')}</h3>
            <p>
              {t('You need ₹{need} for these bids but your wallet has ₹{have}.', { need: lowBalance, have: balance.toFixed(2) })}
              <br />{t('Minimum bid is ₹{min}. Please add money to continue.', { min: MIN_POINTS })}
            </p>
            <div className="seg">
              <button onClick={() => setLowBalance(null)}>{t('OK')}</button>
              <button className="on" onClick={onAddMoney}>{t('ADD MONEY')}</button>
            </div>
          </div>
        </div>
      )}
      {done && (
        <div className="overlay center" onClick={() => setDone(false)}>
          <div className="closed-modal" onClick={(e) => e.stopPropagation()}>
            <span className="closed-x ok"><CheckCircle2 size={46} /></span>
            <h3 style={{ color: '#2e7d32' }}>{t('Success')}</h3>
            <p>{t('Your bids have been placed. Check them in My Bids.')}</p>
            <button className="auth-btn" onClick={() => setDone(false)}>{t('OK')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
