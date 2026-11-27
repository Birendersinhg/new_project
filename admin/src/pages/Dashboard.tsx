import { useState } from 'react';
import {
  Calendar, RefreshCw, Sparkles, Crown, UserX, UserCheck, Users, Gamepad2, TrendingUp,
  Filter, Trophy, Wallet, Search, CheckCircle2, UserPlus, Landmark, Banknote, Zap,
} from 'lucide-react';
import { Field, DateInput, GameSelect, DataTable, Modal, YesNo, useDemo } from '../ui';
import { prettyDate, inr } from '../data';
import { todayIso, useLoad, type AdminAutoDeposit, type AdminMarket, type DailyUsers, type Stats } from '../api';
import type { Go } from '../types';

const ANK_COLORS = ['#556ee6', '#34c38f', '#50a5f1', '#f7b924', '#a855f7', '#f1673e', '#e83e8c', '#6f42c1', '#e53946', '#20c997'];

const AUTO_STATUS: Record<string, string> = { credited: 'success', unmatched: 'danger', pending: 'warning', rejected: 'danger' };

/** Users registered or logged in on a chosen day; the admin can change the date to look at earlier days. */
function DailyUsersModal({ go, onClose }: { go: Go; onClose: () => void }) {
  const [date, setDate] = useState(todayIso);
  const [tab, setTab] = useState<'registered' | 'loggedIn'>('registered');
  const [q, setQ] = useState('');
  const { data, error } = useLoad<DailyUsers>(`/admin/users-daily?date=${date}`);
  const list = (data?.[tab] ?? []).filter((u) => `${u.name} ${u.mobile}`.toLowerCase().includes(q.toLowerCase()));
  const shown = (iso: string) => iso.split('-').reverse().join('-');

  return (
    <Modal title={`Users on ${shown(date)}`} onClose={onClose} width={760}>
      <div className="row" style={{ marginBottom: 12 }}>
        <Field label="Date"><input type="date" className="input" value={date} max={todayIso()} onChange={(e) => e.target.value && setDate(e.target.value)} /></Field>
        <Field label="Search"><input className="input" placeholder="Name or mobile..." value={q} onChange={(e) => setQ(e.target.value)} /></Field>
      </div>
      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={'tab' + (tab === 'registered' ? ' on' : '')} onClick={() => setTab('registered')}>Registered ({data?.registered.length ?? 0})</button>
        <button className={'tab' + (tab === 'loggedIn' ? ' on' : '')} onClick={() => setTab('loggedIn')}>Logged in ({data?.loggedIn.length ?? 0})</button>
      </div>
      <DataTable rows={list} empty={error || (data ? 'No users found for this day.' : 'Loading...')} columns={[
        { h: '#', r: (_, i) => i + 1 },
        { h: 'Name', r: (u) => <span className="link-name" onClick={() => { onClose(); go('user-details', { id: u.id }); }}>{u.name}</span> },
        { h: 'Mobile', r: (u) => u.mobile },
        { h: tab === 'registered' ? 'Registered At' : 'Last Login', r: (u) => u.time.slice(11, 16) },
        ...(tab === 'loggedIn' ? [{ h: 'Logins', r: (u: { logins?: number }) => u.logins }] : []),
        { h: 'Points', r: (u) => u.balance },
        { h: 'Active', r: (u) => <YesNo v={u.active} /> },
      ]} />
      {tab === 'loggedIn' && <div className="hint">Logins are recorded from the day this feature was added.</div>}
    </Modal>
  );
}

export default function Dashboard({ go }: { go: Go }) {
  const demo = useDemo();
  const [q, setQ] = useState('');
  const [daily, setDaily] = useState(false);
  // Auto deposits arrive from the UPI feed without a click, so this screen refreshes itself.
  const { data: stats, reload } = useLoad<Stats>('/admin/stats', 15000);
  const { data: markets } = useLoad<AdminMarket[]>('/admin/markets');
  const { data: autoDeposits } = useLoad<AdminAutoDeposit[]>('/admin/auto-deposits', 15000);
  const rows = (autoDeposits ?? []).filter((d) =>
    `${d.userName ?? ''} ${d.payer ?? ''} ${d.utr} ${d.amount}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <div className="card dash-head">
        <div>
          <h2>Dashboard Overview <span className="live">Live Updates</span></h2>
          <div style={{ color: 'var(--muted)', fontSize: '.85rem', marginTop: 4 }}>
            Real-time platform metrics, user statistics, bid analytics &amp; auto deposit history.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <span className="date-chip"><Calendar size={15} /> {prettyDate()}</span>
          <button className="btn" onClick={reload}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>

      <div className="dash-grid">
        {/* Left column */}
        <div>
          <div className="welcome">
            <div className="welcome-top">
              <div>
                <span className="tag"><Sparkles size={11} /> Console</span>
                <h3>Welcome Back!</h3>
                <p>Admin Console</p>
              </div>
              <div className="crown"><Crown size={28} fill="#ffc107" /></div>
            </div>
            <div className="welcome-body">
              <div className="admin-row">
                <div className="admin-circle">A</div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--heading)', fontSize: '1rem' }}>Admin</div>
                  <span className="online">Super Admin</span>
                </div>
              </div>
              <div className="mini-stats">
                <div className="mini-stat red" style={{ cursor: 'pointer' }} onClick={() => go('user_management')}>
                  <b><UserX size={16} /> {stats?.unapproved ?? '-'}</b>Unapproved Users
                </div>
                <div className="mini-stat green" style={{ cursor: 'pointer' }} onClick={() => go('user_management')}>
                  <b><UserCheck size={16} /> {stats?.approved ?? '-'}</b>Approved Users
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-title">
              <div className="ic" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}><TrendingUp size={18} /></div>
              <h5>Market Bid Details</h5>
            </div>
            <Field label="Select Game Market">
              <select className="select" defaultValue="">
                <option value="">-- Select Game --</option>
                <option>⭐ All Games Combined</option>
                {markets?.map((m) => <option key={m.id}>{m.name}</option>)}
              </select>
            </Field>
            <div className="volume-box">
              <small>TOTAL MARKET BID VOLUME</small>
              <div>₹ N/A</div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div>
          <div className="stat-cards">
            <div className="stat-card blue"><div><h6>Total Users</h6><div className="val">{stats?.users ?? '-'}</div></div><div className="ic"><Users size={22} /></div></div>
            <div className="stat-card pink"><div><h6>Total Games</h6><div className="val">{stats?.games ?? '-'}</div></div><div className="ic"><Gamepad2 size={22} /></div></div>
            <div className="stat-card amber"><div><h6>Today Bid Amount</h6><div className="val">{inr(stats?.pointsToday ?? 0)}</div></div><div className="ic"><TrendingUp size={22} /></div></div>
            <div className="stat-card teal clickable" onClick={() => setDaily(true)} title="Click to see the list">
              <div><h6>Today Registered</h6><div className="val">{stats?.registeredToday ?? '-'}</div><small>{stats?.loggedInToday ?? 0} logged in today</small></div>
              <div className="ic"><UserPlus size={22} /></div>
            </div>
            <div className="stat-card teal"><div><h6>Today Deposit</h6><div className="val">{inr(stats?.depositToday ?? 0)}</div></div><div className="ic"><Banknote size={22} /></div></div>
          </div>

          {/* Auto Deposit: fed by the UPI payment feed, opens its own history page. */}
          <div
            className="auto-card"
            role="button"
            tabIndex={0}
            title="View every auto deposit and who paid it"
            onClick={() => go('report_auto_deposit')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') go('report_auto_deposit'); }}
          >
            <div>
              <h6>Auto Deposit</h6>
              <div className="amt">{inr(stats?.autoDepositToday ?? 0)}</div>
              <span className="chip"><Zap size={12} /> System Integrated</span>
              <div className="sub">{(stats?.autoDepositCountToday ?? 0)} payment(s) credited today · tap to see who paid</div>
            </div>
            <div className="ic"><Landmark size={26} /></div>
          </div>
          {daily && <DailyUsersModal go={go} onClose={() => setDaily(false)} />}

          <div className="card">
            <div className="section-title">
              <div className="ic" style={{ background: '#e6f8f0', color: '#1e9e57' }}><Filter size={18} /></div>
              <div><h5>Single Ank Bid Analytics</h5><small>Selected Date: {prettyDate()}</small></div>
            </div>
            <div className="filter-box">
              <div className="row">
                <Field label="Date"><DateInput /></Field>
                <Field label="Game Name"><GameSelect allLabel="-- All Games --" /></Field>
                <Field label="Market Session">
                  <select className="select"><option>Open Market</option><option>Close Market</option></select>
                </Field>
                <button className="btn accent" onClick={demo('Fetched')}>Fetch</button>
              </div>
            </div>
            <div className="ank-cards">
              {ANK_COLORS.map((c, i) => (
                <div className="ank-card" key={i} style={{ borderColor: c }}>
                  <div className="top" style={{ background: c + '14' }}>
                    <span className="tag" style={{ background: c }}>Ank {i}</span>0 Bids
                  </div>
                  <div className="body"><b>₹ 0</b><small>Total Amount</small></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">
          <div className="ic" style={{ background: '#fff3cd', color: '#d97706' }}><Trophy size={18} /></div>
          <h5>Bid Winning &amp; Profit Analytics</h5>
        </div>
        <div className="row">
          <Field label="Date"><DateInput /></Field>
          <Field label="Game Name"><GameSelect allLabel="⭐ All Games" /></Field>
          <button className="btn" style={{ minWidth: 200 }} onClick={demo('Report generated')}>Submit Report</button>
        </div>
        <div className="profit-grid">
          <div className="profit-card"><div><small>Today Bid Amount</small><b>{inr(stats?.pointsToday ?? 0)}</b></div><button className="btn light sm" onClick={() => go('report_bid_history')}>View</button></div>
          <div className="profit-card"><div><small>Today Win Amount</small><b>{inr(stats?.winsToday ?? 0)}</b></div><button className="btn light sm" onClick={() => go('report_winning')}>View</button></div>
          <div className="profit-card green"><div><small>Today Net</small><b>{inr((stats?.pointsToday ?? 0) - (stats?.winsToday ?? 0))}</b></div><Sparkles size={22} /></div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="section-title" style={{ margin: 0 }}>
            <div className="ic" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}><Wallet size={18} /></div>
            <h5>Fund Request Auto Deposit History</h5>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="search" style={{ width: 260 }}>
              <Search size={15} />
              <input className="input" placeholder="Search UTR, payer number, user..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button className="btn light sm" onClick={() => go('report_auto_deposit')}>View all</button>
          </div>
        </div>
        <DataTable
          head="dark"
          rows={rows.slice(0, 10)}
          empty="No auto deposit yet. Payments sent to the UPI ID show up here by themselves."
          columns={[
            { h: '#', r: (_, i) => i + 1 },
            { h: 'Amount', r: (d) => <span className="amount-plus">₹{d.amount}</span> },
            { h: 'Paid From', r: (d) => d.payer ? <span style={{ fontFamily: 'monospace', letterSpacing: '.03em' }}>{d.payer}</span> : '-' },
            { h: 'UTR / Txn ID', r: (d) => <span style={{ fontFamily: 'monospace', letterSpacing: '.05em' }}>{d.utr}</span> },
            { h: 'User Name', r: (d) => d.userName ? <b>{d.userName} <small style={{ color: 'var(--muted)' }}>{d.userMobile}</small></b> : '-' },
            { h: 'Date', r: (d) => `${d.date} ${d.time.slice(0, 5)}` },
            { h: 'Status', r: (d) => <span className={'badge ' + (AUTO_STATUS[d.status] ?? '')} style={{ borderRadius: 12 }}><CheckCircle2 size={11} style={{ verticalAlign: -1 }} /> {d.status}</span> },
          ]}
        />
      </div>
    </>
  );
}
