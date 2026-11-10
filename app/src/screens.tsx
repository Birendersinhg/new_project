import { useState, type ReactNode, type FormEvent } from 'react';
import {
  ChevronLeft, ChevronRight, RotateCw, Bell, Wallet, Gavel, Receipt, Trophy,
  Sparkles, Award, Wine, History, Headphones, MessageSquareText, X, Hammer, Banknote, CreditCard, Phone, IndianRupee,
} from 'lucide-react';
import type { Go, LucideIcon } from './types';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: ReactNode;
}

export function PageHeader({ title, subtitle, onBack, right }: PageHeaderProps) {
  return (
    <header className="page-header">
      <button className="ph-btn" onClick={onBack} aria-label="Back"><ChevronLeft size={30} /></button>
      <div className="ph-title">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="ph-btn ph-right">{right}</div>
    </header>
  );
}

interface HubItemProps {
  icon: LucideIcon;
  title: string;
  desc: string;
  from: string;
  to: string;
  tint: string;
  onClick: () => void;
}

function HubItem({ icon: Icon, title, desc, from, to, tint, onClick }: HubItemProps) {
  return (
    <button className="hub-item" onClick={onClick}>
      <span className="hub-icon" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}><Icon size={32} /></span>
      <span className="hub-text"><b>{title}</b><small>{desc}</small></span>
      <span className="hub-chev" style={{ background: tint, color: to }}><ChevronRight size={22} /></span>
    </button>
  );
}

interface ScreenNavProps {
  onBack: () => void;
  onOpen: Go;
}

export function BidsScreen({ onBack, onOpen }: ScreenNavProps) {
  const items: [LucideIcon, string, string, string, string, string][] = [
    [Receipt, 'Bid History', 'Complete record of all your placed bids', '#2f8be6', '#1565c0', '#e8f1fc'],
    [Trophy, 'Game Results', 'Latest market results and winning numbers', '#43a047', '#2e7d32', '#e8f5e9'],
    [Sparkles, 'Starline Bid History', 'Your starline game bids and details', '#9c27b0', '#6a1b9a', '#f3e5f5'],
    [Sparkles, 'Starline Result History', 'Past starline game results over time', '#00897b', '#00695c', '#e0f2f1'],
    [Award, 'Disawar Bid History', 'All your Disawar plays in one place', '#ffa726', '#ef6c00', '#fff3e0'],
    [Wine, 'Disawar Result History', 'Past Disawar results and winners', '#ef5350', '#c62828', '#fdecea'],
  ];
  return (
    <div className="phone sub">
      <PageHeader title="MY BIDS" subtitle="Your Bidding Activity" onBack={onBack} right={<Gavel size={24} />} />
      <div className="hub">
        {items.map(([icon, title, desc, from, to, tint]) => (
          <HubItem key={title} icon={icon} title={title} desc={desc} from={from} to={to} tint={tint} onClick={() => onOpen(title)} />
        ))}
      </div>
    </div>
  );
}

export function FundsScreen({ onBack, onOpen }: ScreenNavProps) {
  return (
    <div className="phone sub">
      <PageHeader title="WALLET" subtitle="Manage Your Funds" onBack={onBack} right={<Wallet size={24} />} />
      <div className="hub">
        <HubItem icon={Wallet} title="Add Fund" desc="Instantly top up your wallet" from="#43a047" to="#2e7d32" tint="#e8f5e9" onClick={() => onOpen('addmoney')} />
        <HubItem icon={Banknote} title="Withdraw Fund" desc="Transfer your winnings" from="#ef5350" to="#c62828" tint="#fdecea" onClick={() => onOpen('withdraw')} />
        <HubItem icon={CreditCard} title="Bank Detail" desc="Manage your bank/upi account" from="#2f8be6" to="#1565c0" tint="#e8f1fc" onClick={() => onOpen('Bank Detail')} />
        <HubItem icon={Receipt} title="Add Fund History" desc="All your wallet top-ups" from="#1e63c4" to="#0d47a1" tint="#e8f1fc" onClick={() => onOpen('Add Fund History')} />
        <HubItem icon={History} title="Withdraw Fund History" desc="View record of withdrawals" from="#ffa726" to="#ef6c00" tint="#fff3e0" onClick={() => onOpen('Withdraw Fund History')} />
      </div>
    </div>
  );
}

// Showcase-only screens: nothing is charged, sent or stored.
interface MoneyScreenProps {
  kind: 'add' | 'withdraw';
  balance: number;
  onBack: () => void;
}

export function MoneyScreen({ kind, balance, onBack }: MoneyScreenProps) {
  const isAdd = kind === 'add';
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState('');
  const quick = [300, 500, 1000, 2000];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setMsg('Demo screen only - no payment is processed.');
  };

  return (
    <div className="phone sub money">
      <PageHeader
        title={isAdd ? 'ADD MONEY' : 'WITHDRAW'}
        onBack={onBack}
        right={<span className="ph-pill"><Wallet size={16} /> ₹{balance.toFixed(2)}</span>}
      />
      <div className="hub">
        <div className="balance-card">
          <span>Available Balance</span>
          <b>₹{balance.toFixed(2)} <small>INR</small></b>
        </div>
        <div className="query-card">
          <Headphones size={26} />
          <span>For Query&apos;s please contact</span>
          <button className="q-call"><Phone size={16} /> Call</button>
          <button className="q-wa"><MessageSquareText size={16} /> WhatsApp</button>
        </div>
        <div className="quick-row">
          {quick.map((q) => <button key={q} onClick={() => { setMsg(''); setAmount(String(q)); }}>₹{q}</button>)}
        </div>
        <form onSubmit={submit}>
          <label className="field amount-field">
            <IndianRupee size={22} />
            <input type="number" inputMode="numeric" min="1" placeholder="Enter Amount" value={amount} onChange={(e) => { setMsg(''); setAmount(e.target.value); }} />
          </label>
          <button className="auth-btn">{isAdd ? 'PAY NOW' : 'WITHDRAW NOW'}</button>
        </form>
        {msg && <div className="info-box">{msg}</div>}
      </div>
    </div>
  );
}

export function NotificationsScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="phone sub">
      <PageHeader title="NOTIFICATIONS" subtitle="Stay updated with latest alerts" onBack={onBack} right={<RotateCw size={22} />} />
      <div className="empty">
        <span className="empty-icon"><Bell size={56} /></span>
        <h3>No Messages Yet</h3>
        <p>Pull down to refresh</p>
      </div>
    </div>
  );
}

export function PlaceholderScreen({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="phone sub">
      <PageHeader title={title.toUpperCase()} onBack={onBack} right={<Hammer size={22} />} />
      <div className="empty"><h3>Coming soon</h3></div>
    </div>
  );
}

export function SupportModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay center" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <Headphones size={30} />
          <h3>Support Center</h3>
          <button className="modal-x" onClick={onClose} aria-label="Close"><X size={22} /></button>
        </div>
        <button className="modal-row">
          <span className="modal-icon live"><MessageSquareText size={28} /></span>
          <b>Live Chat</b><ChevronRight size={22} />
        </button>
        <button className="modal-row">
          <span className="modal-icon wa"><MessageSquareText size={28} /></span>
          <b>WhatsApp Support</b><ChevronRight size={22} />
        </button>
      </div>
    </div>
  );
}
