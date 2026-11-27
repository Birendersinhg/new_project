import { useState } from 'react';
import { Copy, Landmark, Link2, RefreshCw, Search } from 'lucide-react';
import {
  api, isoDaysAgo, todayIso, useLoad,
  type AdminAutoDeposit, type AdminDepositRow, type AdminMarket, type AdminUser, type AutoDepositFeed, type BidReportRow,
} from '../api';
import { PageHeader, Card, Field, DateInput, GameSelect, DataTable, Modal, useDemo, useToast } from '../ui';
import { SINGLE_DIGITS, JODI_DIGITS, SINGLE_PANA, DOUBLE_PANA, TRIPLE_PANA, GAME_TYPES } from '../data';
import type { Go } from '../types';

const TypeSelect = () => (
  <select className="select"><option>All</option>{GAME_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
);

export function BidHistory() {
  const { data: markets } = useLoad<AdminMarket[]>('/admin/markets');
  const [date, setDate] = useState(todayIso);
  const [marketId, setMarketId] = useState('');
  const [type, setType] = useState('All');
  // "All Games" lists market, Starline and Jackpot bids together; "starline" / "jackpot" narrow to one of those.
  const isSlot = marketId === 'starline' || marketId === 'jackpot';
  const { data: marketBids, error } = useLoad<BidReportRow[]>(isSlot ? null : `/admin/bids?date=${date}${marketId ? `&marketId=${marketId}` : ''}`);
  const { data: slotBids } = useLoad<BidReportRow[]>(marketId === '' || isSlot ? `/admin/slot-bids?date=${date}${isSlot ? `&kind=${marketId}` : ''}` : null);
  const loaded = isSlot ? slotBids : marketId === '' ? (marketBids && slotBids ? [...marketBids, ...slotBids].sort((a, b) => (a.time < b.time ? 1 : -1)) : null) : marketBids;
  const bids = loaded;
  const rows = (bids ?? []).filter((b) => type === 'All' || b.game === type);
  const total = rows.reduce((s, b) => s + b.points, 0);
  return (
    <>
      <PageHeader title="Bid History Report" trail="Report Management" current="Bid History" />
      <Card title="Filter Bids">
        <div className="row">
          <Field label="Date"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Game Name">
            <select className="select" value={marketId} onChange={(e) => setMarketId(e.target.value)}>
              <option value="">All Games</option>
              <option value="starline">Starline (all times)</option>
              <option value="jackpot">Jackpot / Disawar (all times)</option>
              {markets?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Game Type">
            <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
              <option>All</option>{APP_GAMES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>
      </Card>
      <Card title="Bid History List" right={<span style={{ fontSize: '.85rem', color: 'var(--muted)' }}>Total Bids: <b style={{ color: 'var(--heading)' }}>{rows.length}</b> · Points: <b style={{ color: 'var(--heading)' }}>{total}</b></span>}>
        <DataTable rows={rows} empty={error || (bids ? 'No Bids Found for selected filters.' : 'Loading...')} columns={[
          { h: 'Time', r: (b) => b.time },
          { h: 'Username', r: (b) => <b>{b.user} <small style={{ color: 'var(--muted)' }}>{b.mobile}</small></b> },
          { h: 'Game Name', r: (b) => b.market },
          { h: 'Game Type', r: (b) => b.game },
          { h: 'Session', r: (b) => b.session ?? '-' },
          { h: 'Number', r: (b) => <b>{b.number}</b> },
          { h: 'Points', r: (b) => b.points },
          { h: 'Status', r: (b) => <span className={'badge ' + (b.status === 'won' ? 'success' : b.status === 'lost' ? 'danger' : '')}>{b.status}{b.status === 'won' ? ` ₹${b.win}` : ''}</span> },
        ]} />
      </Card>
    </>
  );
}

// Game types the user app offers.
const APP_GAMES = ['Single Digit', 'Jodi', 'Single Pana', 'Double Pana', 'Triple Pana', 'Half Sangam', 'Full Sangam', 'SP DP TP', 'SP MOTER', 'DP MOTER'];

const SellSection = ({ title, items }: { title: string; items: string[] }) => (
  <Card>
    <div className="sell-section-head"><h6>{title}</h6><span>Subtotal: ₹ 0</span></div>
    <div className="sell-grid">
      {items.map((n) => <div className="sell-cell" key={n}><div className="n">{n}</div><div className="v">0</div></div>)}
    </div>
  </Card>
);

export function SellReport() {
  const demo = useDemo();
  return (
    <>
      <PageHeader title="Customer Sell Report" trail="Report Management" current="Customer Sell Report" />
      <Card title="Select Report Criteria">
        <div className="row">
          <Field label="Date"><DateInput /></Field>
          <Field label="Game Name"><GameSelect /></Field>
          <Field label="Game Type"><TypeSelect /></Field>
          <Field label="Session"><select className="select"><option>Open</option><option>Close</option></select></Field>
          <div style={{ flex: 1, minWidth: 160 }}><button className="btn info block" onClick={demo('Report loaded')}>Submit</button></div>
        </div>
      </Card>
      <div style={{ marginBottom: 20 }}><span className="pill success">Total Sell Points: ₹ 0</span></div>
      <SellSection title="Single Digit" items={SINGLE_DIGITS} />
      <SellSection title="Jodi Digit" items={JODI_DIGITS} />
      <SellSection title="Single Pana" items={SINGLE_PANA} />
      <SellSection title="Double Pana" items={DOUBLE_PANA} />
      <SellSection title="Triple Pana" items={TRIPLE_PANA} />
    </>
  );
}

export function WinningReport() {
  const demo = useDemo();
  return (
    <>
      <PageHeader title="Winning History Report" trail="Report Management" current="Winning Report" />
      <Card title="Filter Winners">
        <div className="row">
          <Field label="Date"><DateInput /></Field>
          <Field label="Game Name"><GameSelect /></Field>
          <Field label="Market Time"><select className="select"><option>All</option><option>Open</option><option>Close</option></select></Field>
          <div style={{ flex: 1, minWidth: 180 }}><button className="btn info block" onClick={demo('Filtered')}>Submit</button></div>
        </div>
      </Card>
      <Card title="Winning List" right={<div style={{ display: 'flex', gap: 8 }}><span className="pill soft-success">Total Winning: ₹ 0</span><span className="pill soft-primary">Total Points: 0</span></div>}>
        <DataTable rows={[]} empty="No Winners Found!!" columns={
          ['Date', 'User Phone', 'User Name', 'Game Name', 'Game Type', 'Open Pana', 'Open Digit', 'Close Pana', 'Close Digit', 'Winning Amount', 'Points'].map((h) => ({ h }))
        } />
      </Card>
    </>
  );
}

export function BidWinReport({ go }: { go: Go }) {
  const demo = useDemo();
  return (
    <>
      <PageHeader title="Bid Winning Report" trail="Report Management" current="Bid Win Report" />
      <Card title="Select Date & Game">
        <div className="row">
          <Field label="Date"><DateInput /></Field>
          <Field label="Game Name"><GameSelect allLabel="-All Games-" /></Field>
          <div style={{ flex: 1, minWidth: 180 }}><button className="btn success block" onClick={demo('Report loaded')}>Submit</button></div>
        </div>
      </Card>
      <div className="profit-grid" style={{ marginTop: 0 }}>
        <div className="profit-card dashed" style={{ background: '#fff' }}><div><small>Total Bid Amount</small><b>₹ 0</b></div><button className="btn sm" onClick={() => go('report_bid_history')}>View</button></div>
        <div className="profit-card dashed" style={{ background: '#fff' }}><div><small>Total Win Amount</small><b>₹ 0</b></div><button className="btn sm" onClick={() => go('report_winning')}>View</button></div>
        <div className="profit-card outline-green" style={{ background: '#fff' }}><div><small>Total Profit Amount</small><b>₹ 0</b></div></div>
      </div>
    </>
  );
}

export function WithdrawReport() {
  const demo = useDemo();
  return (
    <>
      <PageHeader title="Withdraw History Report" trail="Report Management" current="Withdraw Report" />
      <Card title="Filter Withdrawals">
        <div className="row">
          <Field label="Date" style={{ maxWidth: 390 }}><DateInput empty /></Field>
          <button className="btn success" onClick={demo('Filtered')}>Submit</button>
        </div>
      </Card>
      <Card title="Withdraw List" right={<span className="pill success">Total Transfer Amount is ₹ 0</span>}>
        <DataTable rows={[]} empty="No Report Found" columns={['S.No.', 'User Name', 'Phone Number', 'Amount', 'Date'].map((h) => ({ h }))} />
      </Card>
    </>
  );
}

const AUTO_CLASS: Record<string, string> = { credited: 'success', unmatched: 'danger', pending: 'warning', rejected: 'danger' };
const DEPOSIT_CLASS: Record<string, string> = { pending: 'pending', approved: 'success', rejected: 'danger' };
const clock = (t: string) => t.slice(0, 5);

/**
 * Payments the UPI feed delivered to the admin's UPI ID. Credited ones already topped up the
 * customer's wallet; unmatched ones keep the payer's number so the admin can credit them.
 */
export function AutoDepositHistory() {
  const toast = useToast();
  const [from, setFrom] = useState(isoDaysAgo(6));
  const [to, setTo] = useState(todayIso);
  const [status, setStatus] = useState<'all' | 'credited' | 'unmatched' | 'pending' | 'rejected'>('all');
  const [q, setQ] = useState('');
  const [credit, setCredit] = useState<AdminAutoDeposit | null>(null);
  const [who, setWho] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: users } = useLoad<AdminUser[]>('/admin/users');
  const { data: feed } = useLoad<AutoDepositFeed>('/admin/auto-deposits/feed');
  const path = `/admin/auto-deposits?from=${from}&to=${to}${status === 'all' ? '' : `&status=${status}`}`;
  // The feed can post a payment at any moment, so this list refreshes itself.
  const { data: rows, error, reload } = useLoad<AdminAutoDeposit[]>(path, 15000);

  const all = rows ?? [];
  const list = all.filter((d) => `${d.userName ?? ''} ${d.userMobile ?? ''} ${d.payer ?? ''} ${d.utr}`.toLowerCase().includes(q.trim().toLowerCase()));
  const sum = (s: string) => all.filter((d) => d.status === s).reduce((t, d) => t + d.amount, 0);
  const endpoint = feed ? `${location.origin}${feed.url}` : '';

  const copy = (text: string, what: string) => {
    navigator.clipboard.writeText(text).then(() => toast(`${what} copied`), () => toast('Could not copy — select it and copy by hand'));
  };
  const label = (u: AdminUser) => `${u.name} · ${u.mobile}`;

  const doCredit = async () => {
    if (!credit) return;
    const user = users?.find((u) => label(u) === who.trim() || u.mobile === who.trim());
    if (!user) return toast('Pick the customer from the list');
    if (!confirm(`Credit ₹${credit.amount} (UTR ${credit.utr}) to ${user.name}?`)) return;
    setBusy(true);
    try {
      const r = await api<{ balance: number }>('POST', `/admin/auto-deposits/${credit.id}/credit`, { userId: user.id });
      toast(`Credited ₹${credit.amount} to ${user.name}. Balance is now ₹${r.balance}`);
      setCredit(null);
      setWho('');
      reload();
    } catch (err) {
      toast((err as Error).message);
    }
    setBusy(false);
  };

  return (
    <>
      <PageHeader title="Auto Deposit History" trail="Report Management" current="Auto Deposit" />
      <Card title="Filter Auto Deposits">
        <div className="row">
          <Field label="From Date"><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To Date"><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Field label="Status">
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="all">All</option>
              <option value="credited">Credited</option>
              <option value="unmatched">Unmatched</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </Field>
          <button className="btn" onClick={reload}><RefreshCw size={15} /> Refresh</button>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <span className="pill primary">Payments: {all.length}</span>
          <span className="pill success">Credited: ₹ {sum('credited')}</span>
          <span className="pill warning">Pending: ₹ {sum('pending')}</span>
          <span className="pill danger">Unmatched: ₹ {sum('unmatched')}</span>
        </div>
      </Card>

      <Card title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Landmark size={18} color="var(--primary)" /> Payment Feed</span>}>
        <div className="card-sub" style={{ margin: '0 0 14px' }}>
          Point your UPI payment app / bank-SMS forwarder at this URL with this key. Every payment it posts is
          credited on its own when the payer's number is a customer's number, or when the customer already entered
          that UTR in Add Money. Anything that cannot be matched is listed below with the payer's number.
        </div>
        {feed ? (
          <div className="feed-box">
            <div><small>POST</small><code>{endpoint}</code><button className="btn light xs" onClick={() => copy(endpoint, 'Endpoint')}><Copy size={12} /> Copy</button></div>
            <div><small>HEADER</small><code>x-api-key: {feed.key}</code><button className="btn light xs" onClick={() => copy(feed.key, 'Key')}><Copy size={12} /> Copy</button></div>
            <div><small>PAYEE</small><code>{feed.upi || 'Set the UPI ID in Settings first'}</code></div>
          </div>
        ) : <div className="hint">Loading the feed details...</div>}
        {feed && (
          <div className="hint" style={{ marginTop: 12, lineHeight: 1.7 }}>
            {feed.attempts.length === 0
              ? 'No call has ever reached this address. A payment alone cannot appear here — the phone has to forward the bank message to the URL above.'
              : feed.attempts.map((a) => (
                <div key={`${a.at}-${a.detail}`}>
                  {a.at} · {a.code === 200 ? 'accepted' : `refused ${a.code} — ${a.detail}`}
                </div>
              ))}
            {feed.lastPayment ? <div>Last payment stored: {feed.lastPayment}</div> : null}
          </div>
        )}
      </Card>

      <Card title="Auto Deposit List" right={
        <div className="search" style={{ width: 280 }}>
          <Search size={15} />
          <input className="input" placeholder="Search UTR, payer number, user..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      }>
        <DataTable rows={list} empty={error || (rows ? 'No auto deposits for these dates.' : 'Loading...')} columns={[
          { h: 'S.No.', r: (_, i) => i + 1 },
          { h: 'Amount', r: (d) => <span className="amount-plus">₹ {d.amount}</span> },
          { h: 'Paid From', r: (d) => d.payer ? <b style={{ fontFamily: 'monospace', letterSpacing: '.03em' }}>{d.payer}</b> : '-' },
          { h: 'Payer Name', r: (d) => d.payerName || '-' },
          { h: 'UTR / Ref', r: (d) => <span style={{ fontFamily: 'monospace' }}>{d.utr}</span> },
          { h: 'User Name', r: (d) => d.userName ? <b>{d.userName} <small style={{ color: 'var(--muted)' }}>{d.userMobile}</small></b> : <i style={{ color: 'var(--muted)', fontSize: '.82rem' }}>not matched</i> },
          { h: 'Date / Time', r: (d) => `${d.date} ${clock(d.time)}` },
          { h: 'Status', r: (d) => <span className={'badge ' + (AUTO_CLASS[d.status] ?? '')}>{d.status}{d.remark ? <small style={{ display: 'block', opacity: .75, fontWeight: 500, whiteSpace: 'normal', maxWidth: 170, lineHeight: 1.3 }}>{d.remark}</small> : null}</span> },
          {
            h: 'Action', r: (d) => (d.status === 'credited' || d.status === 'rejected'
              ? <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}>Resolved</span>
              // The UTR belongs to a claim, which is approved under Fund Request, not here.
              : d.paymentId
                ? <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}>Review in Fund Request</span>
                : <button className="btn success xs" onClick={() => {
                setCredit(d);
                // A payment held because auto credit is off already knows its customer.
                setWho(d.userId && d.userName && d.userMobile ? `${d.userName} · ${d.userMobile}` : '');
              }}>Credit</button>),
          },
        ]} />
      </Card>

      {credit && (
        <Modal title={`Credit auto deposit #${credit.id}`} onClose={() => setCredit(null)}
          footer={<>
            <button className="btn light" onClick={() => setCredit(null)}>Cancel</button>
            <button className="btn success" disabled={busy} onClick={doCredit}>Credit ₹{credit.amount}</button>
          </>}>
          <div className="feed-box" style={{ marginBottom: 18 }}>
            <div><small>AMOUNT</small><code>₹ {credit.amount}</code></div>
            <div><small>PAID FROM</small><code>{credit.payer || 'not given'}</code></div>
            <div><small>UTR</small><code>{credit.utr}</code></div>
          </div>
          <Field label="Credit to customer (search name or phone)">
            <input className="input" list="auto-deposit-users" placeholder="e.g. Ravi 9876543210" value={who} onChange={(e) => setWho(e.target.value)} />
            <datalist id="auto-deposit-users">{users?.map((u) => <option key={u.id} value={label(u)} />)}</datalist>
          </Field>
        </Modal>
      )}
    </>
  );
}

/** Every top-up, manual claim or auto credited, with the date range and status filters. */
export function DepositReport() {
  const [from, setFrom] = useState(todayIso);
  const [to, setTo] = useState(todayIso);
  const [status, setStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [q, setQ] = useState('');
  const [applied, setApplied] = useState({ from: todayIso(), to: todayIso(), status: 'all' as typeof status });
  const [view, setView] = useState<AdminDepositRow | null>(null);
  const path = `/admin/deposits?from=${applied.from}&to=${applied.to}${applied.status === 'all' ? '' : `&status=${applied.status}`}`;
  const { data: rows, error, reload } = useLoad<AdminDepositRow[]>(path, 20000);

  const all = rows ?? [];
  const list = all.filter((r) => `${r.name} ${r.mobile} ${r.utr} ${r.payer ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  const total = list.reduce((s, r) => s + r.amount, 0);

  const reset = () => {
    setFrom(todayIso); setTo(todayIso); setStatus('all'); setQ('');
    setApplied({ from: todayIso(), to: todayIso(), status: 'all' });
  };

  return (
    <>
      <PageHeader title="Deposit Report" trail="Report Management" current="Deposit Report" />
      <Card title="Filter Deposits">
        <div className="row">
          <Field label="From Date"><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To Date"><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Field label="Status">
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </Field>
          <button className="btn info" onClick={() => setApplied({ from, to, status })}>Filter</button>
          <button className="btn secondary" onClick={reset}>Reset</button>
        </div>
        <div className="total-amount">
          <small>Total Amount</small>
          <div>₹ {total.toFixed(2)}</div>
        </div>
      </Card>

      <Card right={
        <div className="search" style={{ width: 280 }}>
          <Search size={15} />
          <input className="input" placeholder="Search name, phone, UTR..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      }>
        <div className="row" style={{ alignItems: 'center', marginBottom: 14 }}>
          <span style={{ color: 'var(--muted)', fontSize: '.85rem' }}>
            Show <b style={{ color: 'var(--heading)' }}>{list.length}</b> entries · approved by the feed appear with <b>auto</b>.
          </span>
          <div style={{ flex: 1 }} />
          <button className="btn light sm" onClick={reload}><RefreshCw size={13} /> Refresh</button>
        </div>
        <DataTable rows={list} empty={error || (rows ? 'No deposit found for these dates.' : 'Loading...')} columns={[
          { h: '#', r: (r) => <span style={{ color: 'var(--primary)' }}>{r.id}</span> },
          { h: 'User Name', r: (r) => <b>{r.name} <small style={{ color: 'var(--muted)' }}>{r.mobile}</small></b> },
          { h: 'Amount', r: (r) => <span className="amount-plus">₹ {r.amount}</span> },
          { h: 'Request No.', r: (r) => <span style={{ fontFamily: 'monospace' }}>{r.utr}</span> },
          { h: 'Paid From', r: (r) => r.payer || '-' },
          { h: 'Date', r: (r) => r.date },
          { h: 'Time', r: (r) => clock(r.time) },
          { h: 'Status', r: (r) => <span className={'badge ' + (DEPOSIT_CLASS[r.status] ?? '')}>{r.status}{r.auto ? ' · auto' : ''}</span> },
          { h: 'Action', r: (r) => <button className="btn light xs" onClick={() => setView(r)}>View</button> },
        ]} />
      </Card>

      {view && (
        <Modal title={`Deposit #${view.id}`} onClose={() => setView(null)}
          footer={<button className="btn light" onClick={() => setView(null)}>Close</button>}>
          <div className="feed-box">
            <div><small>CUSTOMER</small><code>{view.name} · {view.mobile}</code></div>
            <div><small>AMOUNT</small><code>₹ {view.amount}</code></div>
            <div><small>REQUEST NO. / UTR</small><code>{view.utr}</code></div>
            <div><small>PAID FROM</small><code>{view.payer || 'not given'}</code></div>
            <div><small>RECEIVED</small><code>{view.date} {clock(view.time)}</code></div>
            <div><small>STATUS</small><code>{view.status}{view.auto ? ' (auto deposit)' : ''}</code></div>
            <div><small>REMARK</small><code>{view.remark || '-'}</code></div>
          </div>
        </Modal>
      )}
    </>
  );
}

interface AddFund {
  name: string;
  phone: string;
  amount: number;
  date: string;
}

const ADD_FUNDS: AddFund[] = [];

export function AddFundReport() {
  const demo = useDemo();
  return (
    <>
      <PageHeader title="Add Fund Report" trail="Report Management" current="Add Fund Report" />
      <Card>
        <div className="row">
          <Field label="Date" style={{ maxWidth: 320 }}><DateInput empty /></Field>
          <button className="btn teal" onClick={demo('Filtered')}>Submit</button>
        </div>
      </Card>
      <Card title="Add Fund List">
        <DataTable rows={ADD_FUNDS} empty="No Report Found" columns={[
          { h: 'S.No.', r: (_, i) => i + 1 },
          { h: 'User Name', r: (d) => <b>{d.name} <Link2 size={13} color="var(--muted)" style={{ verticalAlign: -2 }} /></b> },
          { h: 'Phone Number', r: (d) => d.phone },
          { h: 'Amount', r: (d) => <span className="amount-plus">₹ +{d.amount}</span> },
          { h: 'Date', r: (d) => d.date },
        ]} />
      </Card>
    </>
  );
}
