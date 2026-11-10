import { Link2 } from 'lucide-react';
import { PageHeader, Card, Field, DateInput, GameSelect, DataTable, useDemo } from '../ui';
import { SINGLE_DIGITS, JODI_DIGITS, SINGLE_PANA, DOUBLE_PANA, TRIPLE_PANA, GAME_TYPES } from '../data';
import type { Go } from '../types';

const TypeSelect = () => (
  <select className="select"><option>All</option>{GAME_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
);

export function BidHistory() {
  const demo = useDemo();
  return (
    <>
      <PageHeader title="Bid History Report" trail="Report Management" current="Bid History" />
      <Card title="Filter Bids">
        <div className="row">
          <Field label="Date"><DateInput /></Field>
          <Field label="Game Name"><GameSelect /></Field>
          <Field label="Game Type"><TypeSelect /></Field>
          <div style={{ flex: 1, minWidth: 180 }}><button className="btn block" onClick={demo('Filtered')}>Submit</button></div>
        </div>
      </Card>
      <Card title="Bid History List" right={<span style={{ fontSize: '.85rem', color: 'var(--muted)' }}>Total Bids: <b style={{ color: 'var(--heading)' }}>0</b></span>}>
        <DataTable rows={[]} empty="No Bids Found for selected filters." columns={
          ['Date', 'Username', 'Game Name', 'Game Type', 'Session', 'Open Pana', 'Open Result', 'Close Pana', 'Close Result', 'Points', 'Action'].map((h) => ({ h }))
        } />
      </Card>
    </>
  );
}

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

interface AutoDeposit {
  name: string;
  phone: string;
  amount: number;
  date: string;
  status: string;
}

const AUTO_DEPOSITS: AutoDeposit[] = [];

export function AutoDepositHistory() {
  const demo = useDemo();
  return (
    <>
      <PageHeader title="Auto Deposit History" trail="Report Management" current="Auto Deposit" />
      <Card title="Filter Auto Deposits">
        <div className="row">
          <Field label="Date" style={{ maxWidth: 300 }}><DateInput empty /></Field>
          <button className="btn" onClick={demo('Filtered')}>Search</button>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <span className="pill primary">Total Transfer: ₹ 0</span>
          <span className="pill success">Total Approved: ₹ 0</span>
          <span className="pill danger">Total Rejected: ₹ 0</span>
          <span className="pill warning">Total Pending: ₹ 0</span>
        </div>
      </Card>
      <Card title="Auto Deposit List">
        <DataTable rows={AUTO_DEPOSITS} empty="No Auto Deposits Found" columns={[
          { h: 'S.No.', r: (_, i) => i + 1 },
          { h: 'User Name', r: (d) => <b>{d.name}</b> },
          { h: 'Phone Number', r: (d) => d.phone },
          { h: 'Amount', r: (d) => <span className="amount-plus">₹{d.amount}</span> },
          { h: 'Date', r: (d) => d.date },
          { h: 'Status', r: (d) => <span className="badge success">{d.status}</span> },
          { h: 'Action', r: () => <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}>Resolved</span> },
        ]} />
      </Card>
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
