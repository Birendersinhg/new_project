import { useState } from 'react';
import { BarChart3, BellRing, Check, Landmark, Settings, Trophy, Wallet } from 'lucide-react';
import { PageHeader } from './screens';
import type { LucideIcon } from './types';

type PrefKey = 'win' | 'result' | 'withdraw' | 'deposit';

const PREFS: { key: PrefKey; title: string; desc: string; icon: LucideIcon; bg: string; fg: string }[] = [
  { key: 'win', title: 'Win Notification', desc: 'Celebrate your wins!', icon: Trophy, bg: '#fff3e0', fg: '#f59a0c' },
  { key: 'result', title: 'Result Notification', desc: 'Get game results instantly', icon: BarChart3, bg: '#f1e6f7', fg: '#7b1fa2' },
  { key: 'withdraw', title: 'Withdraw Notification', desc: 'Track withdrawal requests', icon: Landmark, bg: '#e6effb', fg: '#1565c0' },
  { key: 'deposit', title: 'Deposit Notification', desc: 'Know when funds are added', icon: Wallet, bg: '#e6f2e7', fg: '#2e7d32' },
];

const STORE_KEY = 'kalyan_notify_prefs';
const DEFAULTS: Record<PrefKey, boolean> = { win: true, result: true, withdraw: true, deposit: true };

function loadPrefs(): Record<PrefKey, boolean> {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') };
  } catch {
    return DEFAULTS;
  }
}

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [prefs, setPrefs] = useState(loadPrefs);

  const toggle = (key: PrefKey) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* not persisted */ }
  };

  return (
    <div className="phone sub money">
      <PageHeader title="SETTINGS" subtitle="Manage your notifications" onBack={onBack} right={<Settings size={26} />} />
      <div className="hub">
        <h3 className="rate-head"><BellRing size={24} /> Notification Preferences</h3>
        {PREFS.map(({ key, title, desc, icon: Icon, bg, fg }) => (
          <div key={key} className="pref-row">
            <span className="pref-icon" style={{ background: bg, color: fg }}><Icon size={24} /></span>
            <span className="hub-text"><b>{title}</b><small>{desc}</small></span>
            <button
              className={`switch ${prefs[key] ? 'on' : ''}`}
              role="switch"
              aria-checked={prefs[key]}
              aria-label={title}
              onClick={() => toggle(key)}
            >
              <span className="knob">{prefs[key] && <Check size={16} strokeWidth={3} />}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
