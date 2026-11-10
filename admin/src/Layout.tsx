import { useEffect, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Go } from './types';
import {
  Home, Users, Share2, Target, FileText, Wallet, Gamepad2, Sparkles, Zap, Settings,
  ChevronRight, ChevronDown, Menu, Maximize, Minimize, User, Lock, LogOut, Dices,
} from 'lucide-react';
import { APP_NAME } from './data';

export interface MenuChild {
  label: string;
  tab: string;
}

export interface MenuItem {
  label: string;
  icon: LucideIcon;
  tab?: string;
  children?: MenuChild[];
}

export const MENU: MenuItem[] = [
  { label: 'Dashboards', icon: Home, tab: 'dashboards' },
  { label: 'User Management', icon: Users, tab: 'user_management' },
  { label: 'Referral Report', icon: Share2, tab: 'referrals' },
  { label: 'Declare Result', icon: Target, tab: 'declare_result' },
  {
    label: 'Report Management', icon: FileText, children: [
      { label: 'Users Bid History', tab: 'report_bid_history' },
      { label: 'Customer Sell Report', tab: 'report_sell' },
      { label: 'Winning Report', tab: 'report_winning' },
      { label: 'Bid Win Report', tab: 'report_bid_win' },
      { label: 'Withdraw Report', tab: 'report_withdraw' },
      { label: 'Auto Deposit History', tab: 'report_auto_deposit' },
      { label: 'Add Fund Report', tab: 'report_add_fund' },
    ],
  },
  {
    label: 'Wallet Management', icon: Wallet, children: [
      { label: 'Fund Request', tab: 'deposits' },
      { label: 'Withdraw Request', tab: 'withdrawals' },
      { label: 'Add Fund (User Wallet)', tab: 'add_fund_wallet' },
      { label: 'Bid Revert', tab: 'bid_revert' },
    ],
  },
  {
    label: 'Games Management', icon: Gamepad2, children: [
      { label: 'Game Name', tab: 'game_names' },
      { label: 'Game Rates', tab: 'rates' },
    ],
  },
  {
    label: 'Game & Numbers', icon: Sparkles, children: [
      { label: 'Single Digit', tab: 'num_single' },
      { label: 'Jodi Digit', tab: 'num_jodi' },
      { label: 'Single Pana', tab: 'num_single_pana' },
      { label: 'Double Pana', tab: 'num_double_pana' },
      { label: 'Tripple Pana', tab: 'num_triple_pana' },
      { label: 'Half Sangam', tab: 'num_half_sangam' },
      { label: 'Full Sangam', tab: 'num_full_sangam' },
    ],
  },
  { label: 'Auto Active', icon: Zap, tab: 'auto_active' },
  {
    label: 'Settings', icon: Settings, children: [
      { label: 'Auto Active Mode', tab: 'auto_active' },
      { label: 'Main Settings', tab: 'settings' },
      { label: 'Contact Settings', tab: 'contact_settings' },
      { label: 'Slider Images', tab: 'sliders' },
      { label: 'How To Play', tab: 'how_to_play' },
    ],
  },
];

const groupOf = (tab: string) => MENU.find((m) => m.children?.some((c) => c.tab === tab))?.label;

interface LayoutProps {
  tab: string;
  go: Go;
  onLogout: () => void;
  children?: ReactNode;
}

export default function Layout({ tab, go, onLogout, children }: LayoutProps) {
  const [open, setOpen] = useState(() => new Set([groupOf(tab)].filter((g): g is string => !!g)));
  const [mini, setMini] = useState(window.innerWidth < 900);
  const [menu, setMenu] = useState(false);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const g = groupOf(tab);
    if (g) setOpen((s) => new Set(s).add(g));
  }, [tab]);
  useEffect(() => {
    const f = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);

  const toggle = (label: string) => setOpen((s) => {
    const n = new Set(s);
    n.has(label) ? n.delete(label) : n.add(label);
    return n;
  });
  const nav = (t: string) => { go(t); if (window.innerWidth < 900) setMini(true); };
  // In mini mode a group icon expands the sidebar so its sub-menu is visible.
  const clickGroup = (label: string) => {
    if (mini) { setMini(false); setOpen((s) => new Set(s).add(label)); } else toggle(label);
  };
  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());

  return (
    <div className={'app' + (mini ? ' mini' : '')}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Dices size={22} /></div>
          <h3>Admin</h3>
        </div>
        <nav className="nav">
          {MENU.map((m) => {
            const Icon = m.icon;
            const isOpen = open.has(m.label);
            const active = m.tab ? m.tab === tab : !!m.children?.some((c) => c.tab === tab);
            return (
              <div key={m.label}>
                <div className={'nav-item' + (active ? ' active' : '')} title={mini ? m.label : undefined} onClick={() => (m.children ? clickGroup(m.label) : nav(m.tab as string))}>
                  <div className="left"><Icon size={18} /><span className="label">{m.label}</span></div>
                  {m.children && (isOpen ? <ChevronDown size={16} className="chev" /> : <ChevronRight size={16} className="chev" />)}
                </div>
                {m.children && isOpen && (
                  <div className="sub-nav">
                    {m.children.map((c) => (
                      <div key={c.label} className={'sub-item' + (c.tab === tab ? ' active' : '')} onClick={() => nav(c.tab)}>{c.label}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <button className="btn-logout" onClick={onLogout} title="Logout"><LogOut size={18} className="ic" /><span className="label">Logout</span></button>
        </div>
      </aside>

      {/* Clicking anywhere outside the sidebar shrinks it to icons. */}
      <div className="main" onClick={() => setMini(true)}>
        <header className="topbar">
          <div className="left">
            <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setMini((c) => !c); }}><Menu size={20} /></button>
            <span className="topbar-title">{APP_NAME}</span>
          </div>
          <div className="right">
            <button className="icon-btn ghost" onClick={fullscreen} title="Fullscreen">
              {full ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
            <div className="profile" onClick={() => setMenu((v) => !v)}>
              <div className="avatar">A</div>
              <span style={{ fontWeight: 600 }}>Admin</span>
              <ChevronDown size={14} color="#a6b0cf" />
            </div>
            {menu && (
              <div className="dropdown" onMouseLeave={() => setMenu(false)}>
                <div onClick={() => { setMenu(false); nav('dashboards'); }}><User size={16} /> Profile</div>
                <div onClick={() => { setMenu(false); nav('settings'); }}><Settings size={16} /> Settings</div>
                <div onClick={() => setMenu(false)}><Lock size={16} /> Lock screen</div>
                <hr />
                <div style={{ color: '#e53946' }} onClick={onLogout}><LogOut size={16} /> Logout</div>
              </div>
            )}
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
