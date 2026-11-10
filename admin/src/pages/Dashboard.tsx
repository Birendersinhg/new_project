import { useState } from 'react';
import {
  Calendar, RefreshCw, Sparkles, Crown, UserX, UserCheck, Users, Gamepad2, TrendingUp,
  Filter, Trophy, Wallet, Search, CheckCircle2,
} from 'lucide-react';
import { Field, DateInput, GameSelect, DataTable, useDemo } from '../ui';
import { GAMES, MARKETS, USERS, prettyDate, inr } from '../data';
import type { Go } from '../types';

const ANK_COLORS = ['#556ee6', '#34c38f', '#50a5f1', '#f7b924', '#a855f7', '#f1673e', '#e83e8c', '#6f42c1', '#e53946', '#20c997'];

interface Deposit {
  user: string;
  amount: number;
  utr: string;
  req: string;
  date: string;
  status: string;
}

const DEPOSITS: Deposit[] = [];

export default function Dashboard({ go }: { go: Go }) {
  const demo = useDemo();
  const [q, setQ] = useState('');
  const approved = USERS.filter((u) => u.approved).length;
  const rows = DEPOSITS.filter((d) => (d.user + d.utr + d.req).toLowerCase().includes(q.toLowerCase()));

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
          <button className="btn" onClick={demo('Refreshed')}><RefreshCw size={15} /> Refresh</button>
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
                  <b><UserX size={16} /> {USERS.length - approved}</b>Unapproved Users
                </div>
                <div className="mini-stat green" style={{ cursor: 'pointer' }} onClick={() => go('user_management')}>
                  <b><UserCheck size={16} /> {approved}</b>Approved Users
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
                {MARKETS.map((m) => <option key={m}>{m}</option>)}
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
            <div className="stat-card blue"><div><h6>Total Users</h6><div className="val">{USERS.length}</div></div><div className="ic"><Users size={22} /></div></div>
            <div className="stat-card pink"><div><h6>Total Games</h6><div className="val">{GAMES.length}</div></div><div className="ic"><Gamepad2 size={22} /></div></div>
            <div className="stat-card amber"><div><h6>Today Bid Amount</h6><div className="val">{inr(0)}</div></div><div className="ic"><TrendingUp size={22} /></div></div>
          </div>

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
          <div className="profit-card"><div><small>Total Bid Amount</small><b>₹ 0</b></div><button className="btn light sm" onClick={() => go('report_bid_history')}>View</button></div>
          <div className="profit-card"><div><small>Total Win Amount</small><b>₹ 0</b></div><button className="btn light sm" onClick={() => go('report_winning')}>View</button></div>
          <div className="profit-card green"><div><small>Total Net Profit</small><b>₹ 0</b></div><Sparkles size={22} /></div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="section-title" style={{ margin: 0 }}>
            <div className="ic" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}><Wallet size={18} /></div>
            <h5>Fund Request Auto Deposit History</h5>
          </div>
          <div className="search" style={{ width: 280 }}>
            <Search size={15} />
            <input className="input" placeholder="Search UTR, Username, Request..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <DataTable
          head="dark"
          rows={rows}
          empty="No deposit history found."
          columns={[
            { h: '#', r: (_, i) => i + 1 },
            { h: 'User Name', r: (d) => <b>{d.user}</b> },
            { h: 'Amount', r: (d) => <span className="amount-plus">₹{d.amount}</span> },
            { h: 'UTR / Txn ID', r: (d) => <span style={{ fontFamily: 'monospace', letterSpacing: '.05em' }}>{d.utr}</span> },
            { h: 'Req ID', r: (d) => d.req },
            { h: 'Date', r: (d) => d.date },
            { h: 'Status', r: (d) => <span className="badge success" style={{ borderRadius: 12 }}><CheckCircle2 size={11} style={{ verticalAlign: -1 }} /> {d.status}</span> },
            { h: 'Action', r: () => '--' },
          ]}
        />
      </div>
    </>
  );
}
