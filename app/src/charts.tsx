import { useEffect, useState } from 'react';
import { BarChart3, Dice5, Sparkles, Star, Trophy } from 'lucide-react';
import { toMinutes, type Market } from './data';
import { api } from './api';
import { useAppData } from './appdata';
import { ankOf } from './matka';
import {
  DISAWAR_SLOTS, STARLINE_SLOTS, addDays, isRedJodi, isoDate, jodiOf, showDate, weekStart, type MarketResult,
} from './results';
import { PageHeader } from './screens';
import type { LucideIcon } from './types';

const WEEKS = 10;
const DAYS = 30;
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

interface NavProps {
  onBack: () => void;
}

/** Loads chart rows for a date range and indexes them by "date" or "date|slot". */
function useRows<T extends { date: string; slot?: string }>(path: string): { rows: Map<string, T> | null; error: string } {
  const [rows, setRows] = useState<Map<string, T> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    api<T[]>('GET', path)
      .then((list) => live && setRows(new Map(list.map((r) => [r.slot ? `${r.date}|${r.slot}` : r.date, r]))))
      .catch((err: Error) => live && setError(err.message));
    return () => { live = false; };
  }, [path]);
  return { rows, error };
}

const Status = ({ error }: { error: string }) => <div className="info-box" style={{ margin: 14 }}>{error || 'Loading chart...'}</div>;

// ---------- Game Chart hub ----------
const HUB: { id: 'chartmarkets' | 'starlinechart' | 'disawarchart'; title: string; desc: string; icon: LucideIcon; from: string; to: string; tint: string }[] = [
  { id: 'chartmarkets', title: 'Matka Chart', desc: 'Explore Jodi and Panel charts', icon: BarChart3, from: '#ef3b3b', to: '#c62828', tint: '#fdecec' },
  { id: 'starlinechart', title: 'Starline Chart', desc: 'Starline chart with date', icon: Sparkles, from: '#9c27b0', to: '#6a1b9a', tint: '#f3e5f5' },
  { id: 'disawarchart', title: 'Disawar Chart', desc: 'Disawar chart with date', icon: Trophy, from: '#ffa726', to: '#ef6c00', tint: '#fff3e0' },
];

export function ChartHubScreen({ onBack, onOpen }: NavProps & { onOpen: (id: string) => void }) {
  return (
    <div className="phone sub">
      <PageHeader title="GAME CHART" subtitle="Explore Game Results" onBack={onBack} right={<BarChart3 size={24} />} />
      <div className="hub">
        {HUB.map(({ id, title, desc, icon: Icon, from, to, tint }) => (
          <button key={id} className="hub-item" onClick={() => onOpen(id)}>
            <span className="hub-icon" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}><Icon size={32} /></span>
            <span className="hub-text"><b>{title}</b><small>{desc}</small></span>
            <span className="hub-chev" style={{ background: tint, color: to }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Main market list ----------
export function ChartMarketsScreen({ onBack, onPick }: NavProps & { onPick: (m: Market, type: 'jodi' | 'panel') => void }) {
  const { markets: all } = useAppData();
  // One row per market name, even if the source list ever repeats one.
  const markets = all.filter((m, i) => all.findIndex((x) => x.name === m.name) === i);
  return (
    <div className="phone sub money">
      <PageHeader title="MAIN MARKET" subtitle="Select Market" onBack={onBack} right={<BarChart3 size={24} />} />
      <div className="hub">
        {markets.map((m) => (
          <div key={m.name} className="cm-row">
            <span>{m.name}</span>
            <button onClick={() => onPick(m, 'jodi')}>Jodi</button>
            <button onClick={() => onPick(m, 'panel')}>Panel</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A result counts as "pending" (**) until its time has passed; future days stay blank. */
function dayState(date: Date, today: Date): 'past' | 'today' | 'future' {
  const a = isoDate(date), b = isoDate(today);
  return a < b ? 'past' : a === b ? 'today' : 'future';
}

function weeks(today: Date) {
  const first = weekStart(today);
  return Array.from({ length: WEEKS }, (_, w) => {
    const monday = addDays(first, -7 * w);
    return { monday, days: WEEKDAYS.map((_, d) => addDays(monday, d)) };
  });
}

const range = (mon: Date) => {
  const sun = addDays(mon, 6);
  const f = (d: Date) => showDate(isoDate(d)).slice(0, 5);
  return <>{f(mon)}<br />to<br />{f(sun)}</>;
};

// ---------- Jodi chart ----------
export function JodiChartScreen({ market, now, onBack }: NavProps & { market: Market; now: Date }) {
  const first = addDays(weekStart(now), -7 * (WEEKS - 1));
  const { rows, error } = useRows<MarketResult & { date: string }>(
    `/charts/market/${market.id}?from=${isoDate(first)}&to=${isoDate(addDays(weekStart(now), 6))}`);
  const result = (d: Date): MarketResult => rows?.get(isoDate(d)) ?? {};
  return (
    <div className="phone sub money">
      <PageHeader title={market.name.toUpperCase()} subtitle="Jodi Chart" onBack={onBack} right={<Dice5 size={24} />} />
      {!rows ? <Status error={error} /> : <div className="chart-wrap">
        <table className="chart jodi">
          <thead><tr><th>DATE</th>{WEEKDAYS.map((d) => <th key={d}>{d}</th>)}</tr></thead>
          <tbody>
            {weeks(now).map(({ monday, days }) => (
              <tr key={isoDate(monday)}>
                <td className="date">{range(monday)}</td>
                {days.map((d) => {
                  const state = dayState(d, now);
                  const j = state === 'future' ? '' : jodiOf(result(d));
                  return <td key={isoDate(d)} className={j && isRedJodi(j) ? 'red' : ''}>{state === 'future' ? '' : j ?? <i>**</i>}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
    </div>
  );
}

// ---------- Panel chart ----------
const PanaCol = ({ p }: { p?: string }) => <span className="pcol">{p ? [...p].map((c, i) => <span key={i}>{c}</span>) : <><i>*</i><i>*</i><i>*</i></>}</span>;

export function PanelChartScreen({ market, now, onBack }: NavProps & { market: Market; now: Date }) {
  const mins = now.getHours() * 60 + now.getMinutes();
  const first = addDays(weekStart(now), -7 * (WEEKS - 1));
  const { rows, error } = useRows<MarketResult & { date: string }>(
    `/charts/market/${market.id}?from=${isoDate(first)}&to=${isoDate(addDays(weekStart(now), 6))}`);
  const result = (d: Date): MarketResult => rows?.get(isoDate(d)) ?? {};
  return (
    <div className="phone sub money">
      <PageHeader title={market.name.toUpperCase()} subtitle="Panel Chart" onBack={onBack} right={<BarChart3 size={24} />} />
      {!rows ? <Status error={error} /> : <div className="chart-wrap">
        <table className="chart panel">
          <thead><tr><th>DATE</th>{WEEKDAYS.map((d) => <th key={d}>{d}</th>)}</tr></thead>
          <tbody>
            {weeks(now).map(({ monday, days }) => (
              <tr key={isoDate(monday)}>
                <td className="date">{range(monday)}</td>
                {days.map((d) => {
                  const state = dayState(d, now);
                  if (state === 'future' || (state === 'today' && mins < toMinutes(market.open))) return <td key={isoDate(d)} />;
                  const r = result(d);
                  const open = r.open ? ankOf(r.open) : undefined;
                  const close = r.close ? ankOf(r.close) : undefined;
                  const j = jodiOf(r);
                  return (
                    <td key={isoDate(d)}>
                      <div className="pcell">
                        <PanaCol p={r.open} />
                        <b className={j && isRedJodi(j) ? 'red' : ''}>{open ?? <i>*</i>}{close ?? <i>*</i>}</b>
                        <PanaCol p={r.close} />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
    </div>
  );
}

// ---------- Starline / Disawar history tables ----------
const lastDays = (now: Date) => Array.from({ length: DAYS }, (_, i) => addDays(now, -i));
const slotHead = (s: string) => { const [t, ap] = s.split(' '); return <>{t}<br />{ap}</>; };
const slotPassed = (date: Date, slot: string, now: Date) =>
  dayState(date, now) === 'past' || (dayState(date, now) === 'today' && now.getHours() * 60 + now.getMinutes() >= toMinutes(slot));

export function StarlineChartScreen({ now, onBack }: NavProps & { now: Date }) {
  const { rows, error } = useRows<{ date: string; slot: string; pana: string }>(
    `/charts/starline?from=${isoDate(addDays(now, -(DAYS - 1)))}&to=${isoDate(now)}`);
  return (
    <div className="phone sub money">
      <PageHeader title="STARLINE HISTORY" subtitle="View starline result records" onBack={onBack} right={<Star size={24} fill="#fff" />} />
      {!rows ? <Status error={error} /> : <div className="chart-wrap">
        <table className="chart grid">
          <thead><tr><th className="date">DATE</th>{STARLINE_SLOTS.map((s) => <th key={s}>{slotHead(s)}</th>)}</tr></thead>
          <tbody>
            {lastDays(now).map((d) => (
              <tr key={isoDate(d)}>
                <td className="date">{showDate(isoDate(d))}</td>
                {STARLINE_SLOTS.map((s) => {
                  const p = slotPassed(d, s, now) ? rows?.get(`${isoDate(d)}|${s}`)?.pana : undefined;
                  return (
                    <td key={s} className="sl">
                      {p ? <><b>{ankOf(p)}</b><small>{p}</small></> : <><i>*</i><i className="sm">***</i></>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
    </div>
  );
}

export function DisawarChartScreen({ now, onBack }: NavProps & { now: Date }) {
  const { rows, error } = useRows<{ date: string; slot: string; jodi: string }>(
    `/charts/disawar?from=${isoDate(addDays(now, -(DAYS - 1)))}&to=${isoDate(now)}`);
  return (
    <div className="phone sub money">
      <PageHeader title="DISHAWAR HISTORY" subtitle="View dishawar result records" onBack={onBack} right={<Dice5 size={24} />} />
      {!rows ? <Status error={error} /> : <div className="chart-wrap">
        <table className="chart grid">
          <thead><tr><th className="date">DATE</th>{DISAWAR_SLOTS.map((s) => <th key={s}>{slotHead(s)}</th>)}</tr></thead>
          <tbody>
            {lastDays(now).map((d) => (
              <tr key={isoDate(d)}>
                <td className="date">{showDate(isoDate(d))}</td>
                {DISAWAR_SLOTS.map((s) => {
                  const j = slotPassed(d, s, now) ? rows?.get(`${isoDate(d)}|${s}`)?.jodi : undefined;
                  return <td key={s} className="dw">{j ? <b>{j}</b> : <i>**</i>}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
    </div>
  );
}
