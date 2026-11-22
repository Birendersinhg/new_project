import { useState } from 'react';
import { ArrowLeft, User, KeyRound, Coins, Plus, Minus, Landmark, CreditCard, Dices, Trophy, Users as UsersIcon, Check, Ban } from 'lucide-react';
import { PageHeader, Card, DataTable, YesNo, Field, useToast } from '../ui';
import { api, useLoad, type AdminUser, type UserBid, type WalletRow } from '../api';
import type { Go, PageParams } from '../types';

export function UserList({ go }: { go: Go }) {
  const [q, setQ] = useState('');
  const [unapproved, setUnapproved] = useState(false);
  const { data: users, error } = useLoad<AdminUser[]>('/admin/users');
  const rows = (users ?? [])
    .filter((u) => !!u.approved !== unapproved)
    .filter((u) => (u.name + u.mobile).toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader title="User List" trail="Dashboards" current="User List" />
      <Card>
        <div className="card-head">
          <input className="input" style={{ width: 320, maxWidth: '100%' }} placeholder="Search users (name, phone)..." value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn accent" onClick={() => setUnapproved((v) => !v)}>
            {unapproved ? 'All Users List' : 'Un-approved Users List'}
          </button>
        </div>
        <DataTable
          head="dark"
          rows={rows}
          empty={error || (users ? 'No users found.' : 'Loading...')}
          columns={[
            { h: '#', r: (_, i) => i + 1 },
            { h: 'User Name', r: (u) => <span className="link-name" onClick={() => go('user-details', { id: u.id })}>{u.name}</span> },
            { h: 'Mobile', r: (u) => u.mobile },
            { h: 'Registered', r: (u) => u.date },
            { h: 'Balance', r: (u) => <b>{u.balance}</b> },
            { h: 'Betting', r: (u) => <YesNo v={u.betting} /> },
            { h: 'Approved', r: (u) => <YesNo v={u.approved} /> },
            { h: 'Active', r: (u) => <YesNo v={u.active} /> },
            { h: 'View', r: (u) => <button className="btn accent xs" onClick={() => go('user-details', { id: u.id })}>View</button> },
          ]}
        />
      </Card>
    </>
  );
}

interface UserDetail {
  user: AdminUser;
  wallet: WalletRow[];
  bids: UserBid[];
}

export function UserDetails({ go, params }: { go: Go; params: PageParams }) {
  const toast = useToast();
  const { data: users } = useLoad<AdminUser[]>('/admin/users');
  const id = params.id ?? users?.[0]?.id;
  const { data, error, reload } = useLoad<UserDetail>(id ? `/admin/users/${id}` : null);
  const [op, setOp] = useState<'add' | 'deduct'>('add');
  const [amount, setAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState('wallet');

  // Runs a change, shows the result, and reloads the user. Returns true on success.
  const run = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn();
      toast(done);
      reload();
      return true;
    } catch (err) {
      toast((err as Error).message);
      return false;
    }
  };

  if (!data) {
    return (
      <>
        <button className="btn" onClick={() => go('user_management')}><ArrowLeft size={15} /> Back to User List</button>
        <Card style={{ marginTop: 16 }}>{error || (users && !users.length ? 'No users registered yet.' : 'Loading...')}</Card>
      </>
    );
  }
  const { user, wallet, bids } = data;
  const wins = bids.filter((b) => b.status === 'won');
  const toggle = (key: 'active' | 'betting' | 'approved') =>
    run(() => api('PATCH', `/admin/users/${user.id}`, { [key]: !user[key] }), 'User updated');

  const tabs = [
    { k: 'wallet', label: `Wallet History (${wallet.length})`, icon: CreditCard },
    { k: 'bids', label: `Bid History (${bids.length})`, icon: Dices },
    { k: 'wins', label: `Winning Report (${wins.length})`, icon: Trophy },
    { k: 'refs', label: 'Referrals List (0)', icon: UsersIcon },
  ];

  return (
    <>
      <div className="page-head">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => go('user_management')}><ArrowLeft size={15} /> Back to User List</button>
          <select className="select" style={{ width: 200 }} value={user.id} onChange={(e) => go('user-details', { id: Number(e.target.value) })}>
            {users?.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.mobile})</option>)}
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
              <div style={{ fontSize: '.82rem', color: 'var(--muted)' }}>Phone: <b>{user.mobile}</b></div>
            </div>
          </div>
          <div className="ud-info">
            <div><small>Wallet Balance</small><b style={{ color: 'var(--success)', fontSize: '1.15rem' }}>₹{user.balance}</b></div>
            <div><small>Registration Date</small><b>{user.date}</b></div>
          </div>
          <div style={{ fontSize: '.82rem', fontWeight: 500, margin: '12px 0 8px' }}>User Permissions (Click to Toggle)</div>
          <div className="perm-btns">
            <button style={{ background: user.active ? 'var(--success)' : 'var(--danger)' }} onClick={() => toggle('active')}>
              Account: {user.active ? 'Active' : 'Inactive'} {user.active ? <Check size={12} /> : <Ban size={12} />}
            </button>
            <button style={{ background: user.betting ? 'var(--success)' : 'var(--danger)' }} onClick={() => toggle('betting')}>
              Betting: {user.betting ? 'Allowed' : 'Blocked'}
            </button>
            <button style={{ background: user.approved ? 'var(--success)' : 'var(--danger)' }} onClick={() => toggle('approved')}>
              Approved: {user.approved ? 'Yes' : 'No'}
            </button>
          </div>
          <div className="hint" style={{ marginTop: 10 }}>
            Inactive switches only this user&apos;s app to Quiz App Mode. They stay signed in and can log in normally with the same details.
          </div>
        </Card>

        <Card>
          <h5 className="card-title" style={{ display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
            <KeyRound size={18} color="#f7b924" /> Password &amp; Security
          </h5>
          <div className="pw-box">
            <div style={{ fontSize: '.82rem', color: 'var(--muted)' }}>
              Passwords are stored encrypted and cannot be viewed. Setting a new one logs the user out of all devices.
            </div>
          </div>
          <div style={{ fontSize: '.82rem', fontWeight: 500, marginBottom: 6 }}>Change User Password</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input className="input" type="password" placeholder="New password (min 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="btn" onClick={async () => {
              if (await run(() => api('POST', `/admin/users/${user.id}/password`, { password }), 'Password updated')) setPassword('');
            }}>Update Password</button>
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
          <Field label="Amount (₹)" style={{ marginBottom: 10 }}>
            <input className="input" inputMode="numeric" placeholder="Enter amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label="Remark" style={{ marginBottom: 14 }}>
            <input className="input" placeholder="Remark (e.g. Bonus / Correction)" value={remark} onChange={(e) => setRemark(e.target.value)} />
          </Field>
          <button className={'btn block ' + (op === 'add' ? 'success' : 'danger')} onClick={async () => {
            if (await run(() => api('POST', `/admin/users/${user.id}/wallet`, { amount: Number(amount), op, remark }), 'Wallet updated')) {
              setAmount('');
              setRemark('');
            }
          }}>
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
          <DataTable head="dark" rows={wallet} empty="No wallet history found." columns={[
            { h: '#', r: (_, i) => i + 1 },
            { h: 'Date & Time', r: (r) => r.dt },
            { h: 'Amount', r: (r) => <span className={r.amt < 0 ? 'amount-minus' : 'amount-plus'}>{r.amt > 0 ? '+' : ''}{r.amt}</span> },
            { h: 'Updated Balance', r: (r) => `₹${r.bal}` },
            { h: 'Remark', r: (r) => r.remark },
          ]} />
        )}
        {tab === 'bids' && (
          <DataTable head="dark" rows={bids} empty="No bid history found." columns={[
            { h: '#', r: (_, i) => i + 1 },
            { h: 'Date', r: (r) => r.date },
            { h: 'Game Name', r: (r) => r.game },
            { h: 'Game Type', r: (r) => r.type },
            { h: 'Session', r: (r) => r.session ?? '-' },
            { h: 'Digit', r: (r) => r.digit },
            { h: 'Points', r: (r) => r.points },
            { h: 'Status', r: (r) => r.status },
          ]} />
        )}
        {tab === 'wins' && (
          <DataTable head="dark" rows={wins} empty="No winning records found." columns={[
            { h: '#', r: (_, i) => i + 1 },
            { h: 'Date', r: (r) => r.date },
            { h: 'Game Name', r: (r) => r.game },
            { h: 'Game Type', r: (r) => r.type },
            { h: 'Digit', r: (r) => r.digit },
            { h: 'Winning Amount', r: (r) => <span className="amount-plus">₹{r.win}</span> },
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
