import { useState } from 'react';
import { FileText, Search, Link2, Eye } from 'lucide-react';
import { PageHeader, Card, Field, DataTable, Modal, useToast } from '../ui';
import { api, todayIso, useLoad, type AdminMarket, type AdminUser, type BidReportRow, type AdminDeposit, type AdminWithdrawal } from '../api';

const STATUS_CLASS: Record<string, string> = { pending: 'pending', approved: 'success', paid: 'success', rejected: 'danger' };
const money = (n: number) => `₹${n}`;

/** UPI top-ups: the customer says they paid; the admin checks the UTR and credits the wallet. */
export function FundRequest() {
  const toast = useToast();
  const [status, setStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(0);
  const { data: rows, error, reload } = useLoad<AdminDeposit[]>(`/admin/payments${status === 'all' ? '' : `?status=${status}`}`);

  const all = rows ?? [];
  const list = all.filter((r) => `${r.name} ${r.mobile} ${r.utr}`.toLowerCase().includes(q.trim().toLowerCase()));
  const total = (s: string) => all.filter((r) => r.status === s).reduce((t, r) => t + r.amount, 0);

  const review = async (row: AdminDeposit, action: 'approve' | 'reject') => {
    const what = action === 'approve' ? `Approve and credit ₹${row.amount} to ${row.name}` : `Reject ₹${row.amount} from ${row.name}`;
    if (!confirm(`${what}?\nUTR: ${row.utr}`)) return;
    setBusy(row.id);
    try {
      const r = await api<{ balance?: number }>('POST', `/admin/payments/${row.id}`, { action });
      toast(action === 'approve'
        ? `Credited ₹${row.amount}. ${row.name}'s balance is now ₹${r.balance}`
        : 'Payment rejected. Nothing was credited.');
      reload();
    } catch (err) {
      toast((err as Error).message);
    }
    setBusy(0);
  };

  return (
    <>
      <PageHeader title="Fund Request & Deposit Management" trail="Wallet Management" current="Fund Request" />
      <Card>
        <div className="card-sub" style={{ margin: '0 0 14px' }}>
          These are UPI payments customers say they made. Open your bank / UPI app, match the UTR and amount, then approve.
          Approving is the only thing that credits a wallet.
        </div>
        <div className="row">
          <Field label="Show" style={{ maxWidth: 200 }}>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="pending">Pending only</option>
              <option value="approved">Approved only</option>
              <option value="rejected">Rejected only</option>
              <option value="all">All requests</option>
            </select>
          </Field>
          <div style={{ flex: 1 }} />
          <button className="btn secondary" onClick={reload}>Refresh</button>
        </div>
      </Card>
      <Card style={{ padding: 0 }}>
        <div className="card-head" style={{ padding: '18px 20px 0' }}>
          <h5 className="card-title" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><FileText size={18} color="var(--primary)" /> Fund Request List</h5>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div className="search" style={{ width: 320 }}><Search size={15} /><input className="input" placeholder="Search by Name, Phone, UTR..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <span className="pill primary">Approved ₹ {total('approved')}</span>
            <span className="pill" style={{ background: '#f1b44c' }}>Pending ₹ {total('pending')}</span>
          </div>
        </div>
        <DataTable upper rows={list} empty={error || (rows ? 'No fund requests found' : 'Loading...')} columns={[
          { h: 'S.No', r: (_, i) => <span style={{ color: 'var(--primary)' }}>{i + 1}</span> },
          { h: 'User Name', r: (r) => <b>{r.name} <Link2 size={13} color="var(--muted)" style={{ verticalAlign: -2 }} /></b> },
          { h: 'Phone Number', r: (r) => r.mobile },
          { h: 'Amount', r: (r) => <span className="amount-plus">{money(r.amount)}</span> },
          { h: 'Wallet', r: (r) => money(r.balance) },
          { h: 'UTR / Reference', r: (r) => <b style={{ letterSpacing: .5 }}>{r.utr}</b> },
          { h: 'Paid From', r: (r) => r.payer || <i style={{ color: 'var(--muted)', fontSize: '.82rem' }}>not given</i> },
          { h: 'Date', r: (r) => r.date },
          { h: 'Status', r: (r) => <span className={'badge ' + (STATUS_CLASS[r.status] ?? '')}>{r.status}{r.remark ? <small style={{ display: 'block', opacity: .75, fontWeight: 500 }}>{r.remark}</small> : null}</span> },
          {
            h: 'Action', r: (r) => (r.status === 'pending' ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn success xs" disabled={busy === r.id} onClick={() => review(r, 'approve')}>Approve</button>
                <button className="btn danger xs" disabled={busy === r.id} onClick={() => review(r, 'reject')}>Reject</button>
              </div>
            ) : <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}>Reviewed</span>),
          },
        ]} />
      </Card>
    </>
  );
}

/** Withdrawal requests: the points were held already, so paying sends them for real. */
export function WithdrawRequest() {
  const toast = useToast();
  const [status, setStatus] = useState<'all' | 'pending' | 'paid' | 'rejected'>('pending');
  const [view, setView] = useState<AdminWithdrawal | null>(null);
  const [busy, setBusy] = useState(0);
  const { data: rows, error, reload } = useLoad<AdminWithdrawal[]>(`/admin/withdrawals${status === 'all' ? '' : `?status=${status}`}`);

  const all = rows ?? [];
  const total = (s: string) => all.filter((r) => r.status === s).reduce((t, r) => t + r.amount, 0);

  const review = async (row: AdminWithdrawal, action: 'pay' | 'reject') => {
    const what = action === 'pay' ? `Mark ₹${row.amount} to ${row.name} as PAID (money sent)` : `Reject and refund ₹${row.amount} to ${row.name}`;
    if (!confirm(`${what}?`)) return;
    setBusy(row.id);
    try {
      const r = await api<{ balance?: number }>('POST', `/admin/withdrawals/${row.id}`, { action });
      toast(action === 'pay'
        ? 'Marked as paid.'
        : `Rejected. ₹${row.amount} refunded — balance is now ₹${r.balance}`);
      setView(null);
      reload();
    } catch (err) {
      toast((err as Error).message);
    }
    setBusy(0);
  };

  return (
    <>
      <PageHeader title="Withdraw Request Management" trail="Wallet Management" current="Withdraw Request" />
      <Card>
        <div className="card-sub" style={{ margin: '0 0 14px' }}>
          The customer's points are already on hold. Send the money to the UPI ID / bank account below, then mark it paid.
          Rejecting gives the points back to the customer.
        </div>
        <div className="row">
          <Field label="Show" style={{ maxWidth: 200 }}>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="pending">Pending only</option>
              <option value="paid">Paid only</option>
              <option value="rejected">Rejected only</option>
              <option value="all">All requests</option>
            </select>
          </Field>
          <div style={{ flex: 1 }} />
          <button className="btn secondary" onClick={reload}>Refresh</button>
        </div>
      </Card>
      <Card
        title="Withdraw Request List"
        right={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="pill primary">Paid ₹ {total('paid')}</span>
            <span className="pill" style={{ background: '#f1b44c' }}>Pending ₹ {total('pending')}</span>
            <span className="pill" style={{ background: '#f46a6a' }}>Rejected ₹ {total('rejected')}</span>
          </div>
        }
      >
        <DataTable rows={all} empty={error || (rows ? 'No withdraw requests found' : 'Loading...')} columns={[
          { h: '#', r: (r) => r.id },
          { h: 'User Name', r: (r) => <b>{r.name} <Link2 size={13} color="var(--muted)" style={{ verticalAlign: -2 }} /></b> },
          { h: 'Mobile', r: (r) => r.mobile },
          { h: 'Payout Details', r: (r) => (r.method === 'upi' ? `UPI: ${r.upi}` : `Bank: ${r.accountName} · ${r.accountNo} · ${r.ifsc}`) },
          { h: 'Amount', r: (r) => <span className="amount-minus">₹ {r.amount}</span> },
          { h: 'Date', r: (r) => r.date },
          { h: 'Status', r: (r) => <span className={'badge ' + (STATUS_CLASS[r.status] ?? '')}>{r.status}</span> },
          {
            h: 'Action', r: (r) => (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn xs" onClick={() => setView(r)}><Eye size={13} /></button>
                {r.status === 'pending' && (
                  <>
                    <button className="btn success xs" disabled={busy === r.id} onClick={() => review(r, 'pay')}>Paid</button>
                    <button className="btn danger xs" disabled={busy === r.id} onClick={() => review(r, 'reject')}>Reject</button>
                  </>
                )}
              </div>
            ),
          },
        ]} />
      </Card>
      {view && (
        <Modal title={`Withdraw request #${view.id}`} onClose={() => setView(null)}>
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: 16, display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: 8, marginBottom: 20 }}>
            <b>Name:</b><span>{view.name}</span>
            <b>Mobile:</b><span>{view.mobile}</span>
            <b>Amount:</b><span className="amount-minus">{money(view.amount)}</span>
            <b>Method:</b><span>{view.method === 'upi' ? 'UPI' : 'Bank transfer'}</span>
            {view.method === 'upi'
              ? <><b>UPI ID:</b><span>{view.upi}</span></>
              : <>
                  <b>Account holder:</b><span>{view.accountName}</span>
                  <b>Account number:</b><span>{view.accountNo}</span>
                  <b>IFSC:</b><span>{view.ifsc}</span>
                </>}
            <b>Requested:</b><span>{view.date}</span>
            <b>Status:</b><span className={'badge ' + (STATUS_CLASS[view.status] ?? '')}>{view.status}</span>
            <b>Wallet now:</b><span>{money(view.balance)}</span>
          </div>
          {view.status === 'pending' ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn success" disabled={busy === view.id} onClick={() => review(view, 'pay')}>Mark as Paid</button>
              <button className="btn danger" disabled={busy === view.id} onClick={() => review(view, 'reject')}>Reject &amp; Refund</button>
            </div>
          ) : <div className="hint">This request was already reviewed.</div>}
        </Modal>
      )}
    </>
  );
}

export function AddFund() {
  const toast = useToast();
  const { data: users } = useLoad<AdminUser[]>('/admin/users');
  const [who, setWho] = useState('');
  const [amount, setAmount] = useState('');
  const label = (u: AdminUser) => `${u.name} ${u.mobile}`;

  const submit = async () => {
    const user = users?.find((u) => label(u) === who.trim() || u.mobile === who.trim());
    if (!user) return toast('Select a user from the list');
    try {
      const r = await api<{ balance: number }>('POST', `/admin/users/${user.id}/wallet`, { amount: Number(amount), op: 'add', remark: 'Added by admin' });
      toast(`Added. ${user.name}'s balance is now ₹${r.balance}`);
      setAmount('');
    } catch (err) {
      toast((err as Error).message);
    }
  };

  return (
    <>
      <PageHeader title="Add Fund (User Wallet)" trail="Wallet Management" current="Add Fund" />
      <Card style={{ maxWidth: 600, margin: '0 auto 24px' }}>
        <h5 className="card-title">Add Balance In User Wallet</h5>
        <Field label="Select User (Search Name / Phone) *" style={{ marginBottom: 18 }}>
          <input className="input" list="user-list" placeholder="Search or Select User (e.g. Rahul 9876543210)" value={who} onChange={(e) => setWho(e.target.value)} />
          <datalist id="user-list">{users?.map((u) => <option key={u.id} value={label(u)} />)}</datalist>
        </Field>
        <Field label="Amount *" style={{ marginBottom: 20 }}>
          <input className="input" inputMode="numeric" placeholder="Enter Amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <button className="btn block" style={{ padding: 11 }} onClick={submit}>Submit</button>
      </Card>
    </>
  );
}

/** Cancel pending bids for a market/date and give the points back to each user. */
export function BidRevert() {
  const toast = useToast();
  const { data: markets } = useLoad<AdminMarket[]>('/admin/markets');
  const [date, setDate] = useState(todayIso);
  // One dropdown for every kind of game: "market:<id>", "starline:<time>" or "jackpot:<time>".
  const [marketId, setMarketId] = useState('');
  const { data: starline } = useLoad<{ slots: string[] }>(`/admin/starline?date=${date}`);
  const { data: jackpot } = useLoad<{ slots: string[] }>(`/admin/disawar?date=${date}`);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [type, ...rest] = marketId.split(':');
  const target = type === 'market' ? { marketId: Number(rest[0]) } : type === 'starline' || type === 'jackpot' ? { kind: type, slot: rest.join(':') } : null;
  const listPath = !marketId ? null
    : type === 'market' ? `/admin/bids?date=${date}&marketId=${rest[0]}`
      : `/admin/slot-bids?date=${date}&kind=${type}&slot=${encodeURIComponent(rest.join(':'))}`;
  const { data: bids, error, reload } = useLoad<BidReportRow[]>(listPath);
  const pending = (bids ?? []).filter((b) => b.status === 'pending');
  const pendingPoints = pending.reduce((s, b) => s + b.points, 0);
  const pickedPoints = pending.filter((b) => picked.has(b.id)).reduce((s, b) => s + b.points, 0);

  const toggle = (id: number) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allPicked = pending.length > 0 && pending.every((b) => picked.has(b.id));
  const revert = async (ids: number[] | null) => {
    const count = ids ? ids.length : pending.length;
    const points = ids ? pickedPoints : pendingPoints;
    if (!confirm(`Revert ${count} bid(s) and refund ₹${points} to the users?`)) return;
    setBusy(true);
    try {
      const r = await api<{ reverted: number; points: number; users: number }>('POST', '/admin/bids/revert',
        { ...target, date, ...(ids ? { ids } : {}) });
      toast(`Reverted ${r.reverted} bid(s). ₹${r.points} refunded to ${r.users} user(s).`);
      setPicked(new Set());
      reload();
    } catch (err) {
      toast((err as Error).message);
    }
    setBusy(false);
  };

  return (
    <>
      <PageHeader title="Bid Revert Management" trail="Wallet Management" current="Bid Revert" />
      <Card>
        <div className="card-sub" style={{ margin: '0 0 14px' }}>
          Cancels pending bids (for example, when a market is closed for the day) and refunds the points to each user.
          Bids that already won or lost can't be reverted; delete the result first.
        </div>
        <div className="row">
          <Field label="Date"><input type="date" className="input" value={date} onChange={(e) => { setDate(e.target.value); setPicked(new Set()); }} /></Field>
          <Field label="Game Name">
            <select className="select" value={marketId} onChange={(e) => { setMarketId(e.target.value); setPicked(new Set()); }}>
              <option value="">-- Select Game --</option>
              <optgroup label="Markets">
                {markets?.map((m) => <option key={m.id} value={`market:${m.id}`}>{m.name}</option>)}
              </optgroup>
              <optgroup label="Starline">
                {starline?.slots.map((s) => <option key={s} value={`starline:${s}`}>Starline {s}</option>)}
              </optgroup>
              <optgroup label="Jackpot">
                {jackpot?.slots.map((s) => <option key={s} value={`jackpot:${s}`}>Jackpot {s}</option>)}
              </optgroup>
            </select>
          </Field>
        </div>
      </Card>
      <Card
        title="Bid History List"
        right={marketId && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn light" disabled={busy || !picked.size} onClick={() => revert([...picked])}>Revert Selected ({picked.size}) · ₹{pickedPoints}</button>
            <button className="btn danger" disabled={busy || !pending.length} onClick={() => revert(null)}>Revert All Pending ({pending.length}) · ₹{pendingPoints}</button>
          </div>
        )}
      >
        <DataTable rows={bids ?? []} empty={!marketId ? 'Select a game to see its bids.' : error || (bids ? 'No Bid Found' : 'Loading...')} columns={[
          {
            h: <input type="checkbox" checked={allPicked} disabled={!pending.length}
              onChange={() => setPicked(allPicked ? new Set() : new Set(pending.map((b) => b.id)))} />,
            r: (b) => <input type="checkbox" disabled={b.status !== 'pending'} checked={picked.has(b.id)} onChange={() => toggle(b.id)} />,
          },
          { h: 'Time', r: (b) => b.time },
          { h: 'Username', r: (b) => <b>{b.user} <small style={{ color: 'var(--muted)' }}>{b.mobile}</small></b> },
          { h: 'Game Type', r: (b) => b.game },
          { h: 'Session', r: (b) => b.session ?? '-' },
          { h: 'Number', r: (b) => <b>{b.number}</b> },
          { h: 'Points', r: (b) => b.points },
          { h: 'Status', r: (b) => <span className={'badge ' + (b.status === 'won' ? 'success' : b.status === 'lost' || b.status === 'reverted' ? 'danger' : '')}>{b.status}</span> },
        ]} />
      </Card>
    </>
  );
}
