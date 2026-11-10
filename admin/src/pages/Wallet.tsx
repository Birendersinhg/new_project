import { useState } from 'react';
import { FileText, Search, Link2, Eye } from 'lucide-react';
import { PageHeader, Card, Field, DateInput, DataTable, Pager, Modal, useDemo } from '../ui';
import { MARKETS, USERS } from '../data';

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
  const demo = useDemo();
  return (
    <>
      <PageHeader title="Add Fund (User Wallet)" trail="Wallet Management" current="Add Fund" />
      <Card style={{ maxWidth: 600, margin: '0 auto 24px' }}>
        <h5 className="card-title">Add Balance In User Wallet</h5>
        <Field label="Select User (Search Name / Phone) *" style={{ marginBottom: 18 }}>
          <input className="input" list="user-list" placeholder="Search or Select User (e.g. Rahul 9876543210)" />
          <datalist id="user-list">{USERS.map((u) => <option key={u.id} value={`${u.name} ${u.mobile}`} />)}</datalist>
        </Field>
        <Field label="Amount *" style={{ marginBottom: 20 }}><input className="input" placeholder="Enter Amount" /></Field>
        <button className="btn block" style={{ padding: 11 }} onClick={demo('Fund added')}>Submit</button>
      </Card>
    </>
  );
}

export function BidRevert() {
  const demo = useDemo();
  return (
    <>
      <PageHeader title="Bid Revert Management" trail="Wallet Management" current="Bid Revert" />
      <Card>
        <div className="row">
          <Field label="Date"><DateInput /></Field>
          <Field label="Game Name"><select className="select"><option value="">-- Select Game --</option>{MARKETS.map((m) => <option key={m}>{m}</option>)}</select></Field>
          <button className="btn" onClick={demo('Loaded')}>Submit</button>
        </div>
      </Card>
      <Card title="Bid History List">
        <DataTable rows={[]} empty="No Bid Found" columns={['#', 'Date', 'Username', 'Game Type', 'Points'].map((h) => ({ h }))} />
      </Card>
    </>
  );
}
