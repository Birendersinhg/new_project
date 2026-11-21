import { useState } from 'react';
import { FileText, Search, Link2, Eye } from 'lucide-react';
import { PageHeader, Card, Field, DateInput, DataTable, Pager, Modal, useDemo, useToast } from '../ui';
import { api, todayIso, useLoad, type AdminMarket, type AdminUser, type BidReportRow } from '../api';

interface FundRequestRow {
  name: string;
  phone: string;
  amount: number;
  points: number;
  receipt: string;
  date: string;
  status: string;
}

const FUND_REQUESTS: FundRequestRow[] = [];

export function FundRequest() {
  const demo = useDemo();
  const [q, setQ] = useState('');
  const rows = FUND_REQUESTS.filter((r) => (r.name + r.phone + r.amount).toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="Fund Request & Deposit Management" trail="Wallet Management" current="Fund Request" />
      <Card>
        <div className="row">
          <Field label="Filter Date (Optional)" style={{ maxWidth: 320 }}><DateInput empty /></Field>
          <button className="btn teal" onClick={demo('Filtered')}>Filter Date</button>
          <button className="btn secondary" onClick={demo('Showing all')}>Show All</button>
        </div>
      </Card>
      <Card style={{ padding: 0 }}>
        <div className="card-head" style={{ padding: '18px 20px 0' }}>
          <h5 className="card-title" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><FileText size={18} color="var(--primary)" /> Fund Request List</h5>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="search" style={{ width: 320 }}><Search size={15} /><input className="input" placeholder="Search by Name, Phone, Amount..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <span className="pill primary">Total Amount is ₹ 0</span>
          </div>
        </div>
        <DataTable upper rows={rows} empty="No Fund Requests Found" columns={[
          { h: 'S.No', r: (_, i) => <span style={{ color: 'var(--primary)' }}>{i + 1}</span> },
          { h: 'User Name', r: (r) => <b>{r.name} <Link2 size={13} color="var(--muted)" style={{ verticalAlign: -2 }} /></b> },
          { h: 'Phone Number', r: (r) => r.phone },
          { h: 'Amount', r: (r) => <span className="amount-plus">₹{r.amount}</span> },
          { h: 'Points', r: (r) => r.points },
          { h: 'Receipt Image', r: (r) => r.receipt },
          { h: 'Date', r: (r) => r.date },
          { h: 'Status', r: (r) => <span className="badge pending">{r.status}</span> },
          {
            h: 'Action', r: () => (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn success xs" onClick={demo('Approved')}>Approve</button>
                <button className="btn danger xs" onClick={demo('Rejected')}>Reject</button>
              </div>
            ),
          },
        ]} />
        <div style={{ padding: '0 20px 16px' }}><Pager total={rows.length} /></div>
      </Card>
    </>
  );
}

interface WithdrawalRow {
  name: string;
  phone: string;
  bank: string;
  amount: number;
  req: string;
  date: string;
  status: string;
}

const WITHDRAWALS: WithdrawalRow[] = [];

export function WithdrawRequest() {
  const demo = useDemo();
  const [view, setView] = useState<WithdrawalRow | null>(null);
  return (
    <>
      <PageHeader title="Withdraw Request Management" trail="Wallet Management" current="Withdraw Request" />
      <Card>
        <div className="row">
          <Field label="Date" style={{ maxWidth: 320 }}><DateInput empty /></Field>
          <button className="btn teal" onClick={demo('Filtered')}>Submit</button>
        </div>
      </Card>
      <Card
        title="Withdraw Request List"
        right={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="pill primary">Total Amount is ₹ 0</span>
            <span className="pill" style={{ background: 'var(--teal)' }}>Total Approved is ₹ 0</span>
            <span className="pill" style={{ background: '#f46a6a' }}>Total Rejected is ₹ 0</span>
            <span className="pill" style={{ background: '#f1b44c' }}>Total Pending is ₹ 0</span>
          </div>
        }
      >
        <DataTable rows={WITHDRAWALS} empty="No Withdraw Requests Found" columns={[
          { h: '#', r: (_, i) => i + 1 },
          { h: 'User Name', r: (r) => <b>{r.name} <Link2 size={13} color="var(--muted)" style={{ verticalAlign: -2 }} /></b> },
          { h: 'Mobile', r: (r) => r.phone },
          { h: 'Bank & Payout Details', r: (r) => r.bank || <i style={{ color: 'var(--muted)', fontSize: '.82rem' }}>No bank details</i> },
          { h: 'Amount', r: (r) => <span className="amount-minus">₹ {r.amount}</span> },
          { h: 'Request No.', r: (r) => r.req },
          { h: 'Date', r: (r) => r.date },
          { h: 'Status', r: (r) => <span className="badge success">{r.status}</span> },
          { h: 'Action', r: (r) => <button className="btn xs" onClick={() => setView(r)}><Eye size={13} /></button> },
        ]} />
      </Card>
      {view && (
        <Modal title="User Profile & Wallet Points" onClose={() => setView(null)}>
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: 16, display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 8, marginBottom: 20 }}>
            <b>Name:</b><span>{view.name}</span>
            <b>Phone:</b><span>{view.phone}</span>
            <b>Email:</b><span>N/A</span>
            <b>Current Wallet:</b><span className="amount-plus" style={{ fontSize: '1.1rem' }}>₹0</span>
          </div>
          <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--heading)' }}>Adjust Wallet Balance</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <select className="select" style={{ width: 120 }}><option>Add (+)</option><option>Deduct (-)</option></select>
            <input className="input" placeholder="Enter points" />
          </div>
          <button className="btn block" style={{ padding: 11 }} onClick={() => { setView(null); demo('Wallet updated')(); }}>Update Wallet</button>
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
  const [marketId, setMarketId] = useState('');
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const { data: bids, error, reload } = useLoad<BidReportRow[]>(marketId ? `/admin/bids?date=${date}&marketId=${marketId}` : null);
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
        { marketId: Number(marketId), date, ...(ids ? { ids } : {}) });
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
              {markets?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
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
