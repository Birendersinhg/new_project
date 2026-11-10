import {
  X, Phone, ChevronRight, CreditCard, Banknote, Dice5, BookOpen, Wallet, Bell, LineChart, Percent,
  Clock, Megaphone, PlayCircle, Settings, Share2, LogOut,
} from 'lucide-react';
import type { Go, LucideIcon } from './types';

const ITEMS: { id: string; label: string; icon: LucideIcon; bg: string; fg: string }[] = [
  { id: 'addmoney', label: 'Add Money', icon: CreditCard, bg: '#e6f4ea', fg: '#2e9e4f' },
  { id: 'withdraw', label: 'Withdrawal', icon: Banknote, bg: '#f4e3e3', fg: '#d32f2f' },
  { id: 'bids', label: 'My Bids', icon: Dice5, bg: '#ece6f7', fg: '#7c4dff' },
  { id: 'passbook', label: 'Passbook', icon: BookOpen, bg: '#e3ebf6', fg: '#2f7de0' },
  { id: 'funds', label: 'Funds', icon: Wallet, bg: '#f8eedd', fg: '#f59a0c' },
  { id: 'notifications', label: 'Notification', icon: Bell, bg: '#f9e3e8', fg: '#e91e63' },
  { id: 'Game Chart', label: 'Game Chart', icon: LineChart, bg: '#e0efec', fg: '#1ba88a' },
  { id: 'Game Rate', label: 'Game Rate', icon: Percent, bg: '#e9e4f4', fg: '#6a4fc4' },
  { id: 'Time Table', label: 'Time Table', icon: Clock, bg: '#e1f1f4', fg: '#13a7c4' },
  { id: 'Notice board / Rules', label: 'Notice board/ Rules', icon: Megaphone, bg: '#eaeee1', fg: '#7cb342' },
  { id: 'How To Play', label: 'How To Play', icon: PlayCircle, bg: '#f8e4e0', fg: '#f4511e' },
  { id: 'Settings', label: 'Settings', icon: Settings, bg: '#e8e9ec', fg: '#607d8b' },
  { id: 'Share App', label: 'Share App', icon: Share2, bg: '#f8eee0', fg: '#fb8c00' },
];

interface DrawerProps {
  open: boolean;
  user: { name: string; mobile: string };
  onClose: () => void;
  onNavigate: Go;
  onLogout: () => void;
}

export default function Drawer({ open, user, onClose, onNavigate, onLogout }: DrawerProps) {
  return (
    <div className={`overlay drawer-wrap ${open ? 'open' : ''}`} onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <button className="drawer-x" onClick={onClose} aria-label="Close"><X size={22} /></button>
          <span className="avatar">{user.name.trim().charAt(0).toUpperCase()}</span>
          <div className="drawer-user">
            <b>{user.name}</b>
            <span><Phone size={14} /> {user.mobile}</span>
          </div>
        </div>
        <div className="drawer-list">
          {ITEMS.map(({ id, label, icon: Icon, bg, fg }) => (
            <button key={id} className="drawer-item" style={{ background: bg }} onClick={() => onNavigate(id)}>
              <span className="di-icon" style={{ color: fg }}><Icon size={24} /></span>
              <b>{label}</b>
              <ChevronRight size={20} style={{ color: fg }} />
            </button>
          ))}
          <button className="drawer-item logout" onClick={onLogout}>
            <span className="di-icon"><LogOut size={26} /></span>
            <b>Log Out</b>
            <ChevronRight size={20} />
          </button>
        </div>
      </aside>
    </div>
  );
}
