import { useState } from 'react';
import { ArrowLeft, User, KeyRound, Eye, EyeOff, Coins, Plus, Minus, Landmark, CreditCard, Dices, Trophy, Users as UsersIcon, Check, Ban, Lock } from 'lucide-react';
import { PageHeader, Card, DataTable, YesNo, useDemo, Field } from '../ui';
import { USERS, WALLET_HISTORY, BID_HISTORY, WIN_HISTORY, type User as UserRecord } from '../data';
import type { Go, PageParams } from '../types';

export function UserList({ go }: { go: Go }) {
  const [q, setQ] = useState('');
  const [unapproved, setUnapproved] = useState(false);
  const rows = USERS
    .filter((u) => u.approved !== unapproved)
    .filter((u) => (u.name + u.mobile + u.email).toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader title="User List" trail="Dashboards" current="User List" />
      <Card>
        <div className="card-head">
          <input className="input" style={{ width: 320, maxWidth: '100%' }} placeholder="Search users (name, phone, email)..." value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn accent" onClick={() => setUnapproved((v) => !v)}>
            {unapproved ? 'All Users List' : 'Un-approved Users List'}
          </button>
        </div>
        <DataTable
          head="dark"
          rows={rows}
          empty="No users found."
          columns={[
            { h: '#', r: (_, i) => i + 1 },
            { h: 'User Name', r: (u) => <span className="link-name" onClick={() => go('user-details', { id: u.id })}>{u.name}</span> },
            { h: 'Mobile', r: (u) => u.mobile },
            { h: 'Email', r: (u) => u.email },
            { h: 'Date', r: (u) => u.date },
            { h: 'Balance', r: (u) => <b>{u.balance}</b> },
            { h: 'Betting', r: (u) => <YesNo v={u.betting} /> },
            { h: 'Transfer', r: (u) => <YesNo v={u.transfer} /> },
            { h: 'Active', r: (u) => <YesNo v={u.active} /> },
            { h: 'Referral (Referred by)', r: (u) => u.ref },
            { h: 'View', r: (u) => <button className="btn accent xs" onClick={() => go('user-details', { id: u.id })}>View</button> },
          ]}
        />
      </Card>
    </>
  );
}

const EMPTY_USER: UserRecord = { id: 0, approved: false, name: '-', mobile: '-', email: '-', date: '-', balance: 0, betting: false, transfer: false, active: false, ref: '-', mpin: '-' };

export function UserDetails({ go, params }: { go: Go; params: PageParams }) {
  const demo = useDemo();
  const [id, setId] = useState<number>(params.id ?? USERS[0]?.id ?? 0);
  const user = USERS.find((u) => u.id === id) || USERS[0] || EMPTY_USER;
  const [showPw, setShowPw] = useState(false);
  const [op, setOp] = useState('add');
  const [perm, setPerm] = useState({ active: user.active, betting: user.betting, transfer: user.transfer });
  const [tab, setTab] = useState('wallet');

  const tabs = [
    { k: 'wallet', label: `Wallet History (${WALLET_HISTORY.length})`, icon: CreditCard },
    { k: 'bids', label: `Bid History (${BID_HISTORY.length})`, icon: Dices },
    { k: 'wins', label: `Winning Report (${WIN_HISTORY.length})`, icon: Trophy },
    { k: 'refs', label: 'Referrals List (0)', icon: UsersIcon },
  ];

  return (
    <>
      <div className="page-head">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => go('user_management')}><ArrowLeft size={15} /> Back to User List</button>
          <select className="select" style={{ width: 200 }} value={user.id} onChange={(e) => setId(Number(e.target.value))}>
            {USERS.length === 0 && <option value="">-- No Users --</option>}
            {USERS.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.mobile})</option>)}
          </select>
          <span style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--heading)' }}>User Details | {user.name} ({user.mobile})</span>
        </div>
        <div className="crumbs">Dashboards / User List / <span>User Details</span></div>
      </div>

      <div className="ud-grid">
        <Card>
          <div className="ud-profile">
            <div className="avatar" style={{ width: 50, height: 50 }}><User size={24} /></div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--heading)' }}>{user.name}</div>
              <div style={{ fontSize: '.82rem', color: 'var(--muted)' }}>Phone: <b>{user.mobile}</b> | Email: {user.email === '-' ? 'N/A' : user.email}</div>
            </div>
          </div>
          <div className="ud-info">
            <div><small>Wallet Balance</small><b style={{ color: 'var(--success)', fontSize: '1.15rem' }}>₹{user.balance}</b></div>
            <div><small>Registration Date</small><b>{user.date}</b></div>
            <div><small>Referred By</small><b style={{ color: 'var(--primary)' }}>{user.ref === '-' ? 'None' : user.ref}</b></div>
            <div><small>M-PIN</small><b>{user.mpin}</b></div>
          </div>
          <div style={{ fontSize: '.82rem', fontWeight: 500, margin: '12px 0 8px' }}>User Permissions (Click to Toggle)</div>
          <div className="perm-btns">
            <button style={{ background: perm.active ? 'var(--success)' : 'var(--danger)' }} onClick={() => setPerm((p) => ({ ...p, active: !p.active }))}>
              Account: {perm.active ? 'Active' : 'Inactive'} {perm.active ? <Check size={12} /> : <Ban size={12} />}
            </button>
            <button style={{ background: perm.betting ? 'var(--success)' : 'var(--danger)' }} onClick={() => setPerm((p) => ({ ...p, betting: !p.betting }))}>
              Betting: {perm.betting ? 'Allowed' : 'Blocked'}
            </button>
            <button style={{ background: perm.transfer ? 'var(--success)' : 'var(--danger)' }} onClick={() => setPerm((p) => ({ ...p, transfer: !p.transfer }))}>
              Transfer: {perm.transfer ? 'Yes' : 'No'} <Lock size={12} />
            </button>
          </div>
        </Card>

        <Card>
          <h5 className="card-title" style={{ display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
            <KeyRound size={18} color="#f7b924" /> Password &amp; Security
          </h5>
          <div className="pw-box">
            <div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>Current User Password</div>
              <div style={{ fontWeight: 700, letterSpacing: '.15em', marginTop: 4 }}>{showPw ? 'demo1234' : '••••••••'}</div>
            </div>
            <span style={{ color: 'var(--primary)', cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center', fontWeight: 600 }} onClick={() => setShowPw((v) => !v)}>
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />} {showPw ? 'Hide' : 'Show'} Password
            </span>
          </div>
          <div style={{ fontSize: '.82rem', fontWeight: 500, marginBottom: 6 }}>Change User Password</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input className="input" placeholder="Enter new password" />
            <button className="btn" onClick={demo('Password updated')}>Update Password</button>
          </div>
        </Card>

        <Card>
          <h5 className="card-title" style={{ display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
            <Coins size={18} color="#d97706" /> Wallet Control (Add / Deduct)
          </h5>
          <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: 6 }}>Operation Type</div>
          <div style={{ display: 'flex', gap: 22, marginBottom: 12 }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--success)', fontWeight: 600, cursor: 'pointer' }}>
              <input type="radio" checked={op === 'add'} onChange={() => setOp('add')} /><Plus size={14} /> Add Amount (+)
            </label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--danger)', fontWeight: 600, cursor: 'pointer' }}>
              <input type="radio" checked={op === 'deduct'} onChange={() => setOp('deduct')} /><Minus size={14} /> Deduct Amount (-)
            </label>
          </div>
          <Field label="Amount (₹)" style={{ marginBottom: 10 }}><input className="input" placeholder="Enter amount" /></Field>
          <Field label="Remark" style={{ marginBottom: 14 }}><input className="input" placeholder="Remark (e.g. Deposit Bonus / Correction)" /></Field>
          <button className={'btn block ' + (op === 'add' ? 'success' : 'danger')} onClick={demo('Wallet updated')}>
            {op === 'add' ? 'Add Amount To Wallet' : 'Deduct Amount From Wallet'}
          </button>
        </Card>
      </div>

      <Card>
        <h5 className="card-title" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Landmark size={18} /> User Bank Account &amp; UPI Payment Details</h5>
        <div className="bank-grid">
          {['Bank Name', 'Account Holder Name', 'Account Number', 'IFSC Code', 'Branch Name', 'Paytm Number', 'PhonePe Number', 'Google Pay Number'].map((l) => (
            <div className="bank-cell" key={l}><small>{l}</small><div>Not Added</div></div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="tabs">
          {tabs.map((t) => (
            <div key={t.k} className={'tab' + (tab === t.k ? ' on' : '')} onClick={() => setTab(t.k)}><t.icon size={15} /> {t.label}</div>
          ))}
        </div>
        {tab === 'wallet' && (
          <DataTable head="dark" rows={WALLET_HISTORY} empty="No wallet history found." columns={[
            { h: '#', r: (_, i) => i + 1 },
            { h: 'Date & Time', r: (r) => r.dt },
            { h: 'Amount', r: (r) => <span className={r.amt.startsWith('-') ? 'amount-minus' : 'amount-plus'}>{r.amt}</span> },
            { h: 'Updated Balance', r: (r) => `₹${r.bal}` },
            { h: 'Remark', r: (r) => r.remark },
          ]} />
        )}
        {tab === 'bids' && (
          <DataTable head="dark" rows={BID_HISTORY} empty="No bid history found." columns={[
            { h: '#', r: (_, i) => i + 1 },
            { h: 'Date', r: (r) => r.date },
            { h: 'Game Name', r: (r) => r.game },
            { h: 'Game Type', r: (r) => r.type },
            { h: 'Session', r: (r) => r.session },
            { h: 'Digit', r: (r) => r.digit },
            { h: 'Points', r: (r) => r.points },
          ]} />
        )}
        {tab === 'wins' && (
          <DataTable head="dark" rows={WIN_HISTORY} empty="No winning records found." columns={[
            { h: '#', r: (_, i) => i + 1 },
            { h: 'Date', r: (r) => r.date },
            { h: 'Game Name', r: (r) => r.game },
            { h: 'Game Type', r: (r) => r.type },
            { h: 'Digit', r: (r) => r.digit },
            { h: 'Winning Amount', r: (r) => <span className="amount-plus">₹{r.amount}</span> },
          ]} />
        )}
        {tab === 'refs' && (
          <DataTable head="dark" rows={[]} empty="No referrals found." columns={[
            { h: '#' }, { h: 'Name' }, { h: 'Phone' }, { h: 'Signup Date' },
          ]} />
        )}
      </Card>
    </>
  );
}

export function ReferralReport() {
  return (
    <>
      <PageHeader title="Referral Report" trail="User Management" current="Referral Report" />
      <Card>
        <div className="card-head">
          <span style={{ color: 'var(--muted)' }}>Referrals List</span>
          <input className="input" style={{ width: 250 }} placeholder="Search..." />
        </div>
        <DataTable head="dark" rows={[]} empty="No referral data found." columns={[
          { h: '#' }, { h: 'Referred User (Name)' }, { h: 'Referred User (Phone)' }, { h: 'Referred By (Phone)' },
          { h: 'Referrer Name' }, { h: 'Signup Date' }, { h: 'View' },
        ]} />
      </Card>
    </>
  );
}
