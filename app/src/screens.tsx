import { useEffect, useState, type ReactNode } from 'react';
import {
  ChevronLeft, ChevronRight, RotateCw, Bell, Wallet, Gavel, Receipt,
  Sparkles, Award, History, Headphones, MessageSquareText, X, Hammer, Banknote, CreditCard,
} from 'lucide-react';
import type { Go, LucideIcon } from './types';
import { useAppData } from './appdata';
import { api, type AppNotification } from './api';
import { whatsappLink } from './content';

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
    [Sparkles, 'Starline Bid History', 'Your starline game bids and details', '#9c27b0', '#6a1b9a', '#f3e5f5'],
    [Award, 'Disawar Bid History', 'All your Disawar plays in one place', '#ffa726', '#ef6c00', '#fff3e0'],
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

// Add money (addmoney) and withdraw live in ./payments.tsx; they talk to the server.

export function NotificationsScreen({ onBack }: { onBack: () => void }) {
  const [list, setList] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState('');
  const load = () => {
    setError('');
    api<AppNotification[]>('GET', '/notifications').then(setList).catch((err: Error) => setError(err.message));
  };
  useEffect(load, []);

  return (
    <div className="phone sub">
      <PageHeader title="NOTIFICATIONS" subtitle="Stay updated with latest alerts" onBack={onBack}
        right={<button className="icon-btn" aria-label="Refresh" onClick={load}><RotateCw size={22} /></button>} />
      {list?.length ? (
        <div className="hub">
          {list.map((n) => (
            <div key={n.id} className="bh-row">
              <div className="bh-top"><b className="pb-remark">{n.title}</b></div>
              {n.message && <div className="nt-msg">{n.message}</div>}
              <div className="bh-bot"><span>{n.at.slice(0, 10).split('-').reverse().join('-')} {n.at.slice(11, 16)}</span></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">
          <span className="empty-icon"><Bell size={56} /></span>
          <h3>{error || (list ? 'No Messages Yet' : 'Loading...')}</h3>
        </div>
      )}
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

/** Opens the admin's phone/WhatsApp; shows "Not available" when the admin hasn't set that number. */
function ContactRow({ href, className, label, onClick }: { href?: string; className: string; label: string; onClick?: () => void }) {
  const inner = <>
    <span className={`modal-icon ${className}`}><MessageSquareText size={28} /></span>
    <b>{label}{!href && !onClick && <small className="na">Not available</small>}</b><ChevronRight size={22} />
  </>;
  if (onClick) return <button className="modal-row" onClick={onClick}>{inner}</button>;
  return href
    ? <a className="modal-row" href={href} target="_blank" rel="noreferrer">{inner}</a>
    : <button className="modal-row" disabled>{inner}</button>;
}

export function SupportModal({ onClose, onChat }: { onClose: () => void; onChat: () => void }) {
  const { settings } = useAppData();
  return (
    <div className="overlay center" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <Headphones size={30} />
          <h3>Support Center</h3>
          <button className="modal-x" onClick={onClose} aria-label="Close"><X size={22} /></button>
        </div>
        {settings.texts.support && <p className="modal-note">{settings.texts.support}</p>}
        <ContactRow onClick={onChat} className="live" label="Live Chat" />
        <ContactRow href={whatsappLink(settings.whatsapp)} className="wa" label="WhatsApp Support" />
      </div>
    </div>
  );
}
