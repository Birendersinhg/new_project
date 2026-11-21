import { Gamepad2, X } from 'lucide-react';
import type { Market } from './data';
import { PageHeader } from './screens';

type IconKind = 'dot' | 'jodi' | 'card' | 'cards2' | 'cards3' | 'chip' | 'fan' | 'spread' | 'ring';

export const GAME_TYPES: { name: string; icon: IconKind }[] = [
  { name: 'Single Digit', icon: 'dot' },
  { name: 'Jodi', icon: 'jodi' },
  { name: 'Single Pana', icon: 'card' },
  { name: 'Double Pana', icon: 'cards2' },
  { name: 'Triple Pana', icon: 'cards3' },
  { name: 'Half Sangam', icon: 'chip' },
  { name: 'Full Sangam', icon: 'fan' },
  { name: 'SP DP TP', icon: 'spread' },
  { name: 'SP MOTER', icon: 'ring' },
  { name: 'DP MOTER', icon: 'ring' },
];

function GameIcon({ kind }: { kind: IconKind }) {
  const common = { width: 46, height: 46, viewBox: '0 0 48 48', fill: 'none', stroke: '#fff', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  switch (kind) {
    case 'dot':
      return <svg {...common}><circle cx="24" cy="24" r="16" /><circle cx="24" cy="24" r="4.5" fill="#fff" stroke="none" /></svg>;
    case 'jodi':
      return <svg {...common}><circle cx="24" cy="24" r="17" /><circle cx="17.5" cy="24" r="4.2" fill="#fff" stroke="none" /><circle cx="30.5" cy="24" r="4.2" fill="#fff" stroke="none" /></svg>;
    case 'card':
      return <svg {...common}><rect x="14" y="8" width="20" height="32" rx="2.5" /><path d="M24 18l5 6-5 6-5-6z" fill="#fff" stroke="none" /></svg>;
    case 'cards2':
      return <svg {...common}><rect x="10" y="12" width="17" height="27" rx="2.5" /><path d="M27 14l9 2.2-6 24-6.5-1.6" /><path d="M18.5 21a3 3 0 1 1 0 .1M16 27a2.8 2.8 0 1 0 5 0" /></svg>;
    case 'cards3':
      return <svg {...common}><path d="M12 14l-4 22 10 2" /><path d="M36 14l4 22-10 2" /><rect x="15" y="8" width="18" height="29" rx="2.5" /><circle cx="24" cy="20" r="3" /><circle cx="21" cy="25" r="3" /><circle cx="27" cy="25" r="3" /><path d="M24 26v5" /></svg>;
    case 'chip':
      return <svg {...common}><rect x="9" y="8" width="20" height="28" rx="2.5" /><path d="M19 17c-2-3-6-1-4 2l4 4 4-4c2-3-2-5-4-2z" fill="#fff" stroke="none" /><circle cx="32" cy="32" r="8" fill="#c62828" /><circle cx="32" cy="32" r="3.5" /></svg>;
    case 'fan':
      return <svg {...common}><rect x="8" y="16" width="13" height="19" rx="2" transform="rotate(-20 14 25)" /><rect x="17.5" y="13" width="13" height="19" rx="2" /><rect x="27" y="16" width="13" height="19" rx="2" transform="rotate(20 33 25)" /><path d="M10 9l1 2M38 9l-1 2M24 6v2M14 42l2-1M34 42l-2-1" /></svg>;
    case 'spread':
      return <svg {...common}><rect x="9" y="12" width="16" height="23" rx="2" transform="rotate(-18 17 23)" /><rect x="18" y="11" width="16" height="23" rx="2" fill="#c62828" /><path d="M30 40c4 0 8-3 8-8v-9l-3-2-1 8" /></svg>;
    case 'ring':
      return <svg {...common}><circle cx="24" cy="24" r="16" /><circle cx="24" cy="24" r="10.5" /><path d="M15 15l4 4M33 15l-4 4M33 33l-4-4" /></svg>;
  }
}

interface GameTypesProps {
  market: Market;
  onBack: () => void;
  onPick: (game: string) => void;
}

export function GameTypesScreen({ market, onBack, onPick }: GameTypesProps) {
  return (
    <div className="phone sub">
      <PageHeader title={market.name.toUpperCase()} subtitle="Select Game Type" onBack={onBack} right={<Gamepad2 size={26} />} />
      <div className="game-grid">
        {GAME_TYPES.map((g) => (
          <button key={g.name} className="game-tile" onClick={() => onPick(g.name)}>
            <span className="game-icon"><GameIcon kind={g.icon} /></span>
            <b>{g.name}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ClosedModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay center" onClick={onClose}>
      <div className="closed-modal" onClick={(e) => e.stopPropagation()}>
        <span className="closed-x"><X size={46} strokeWidth={2.6} /></span>
        <h3>Sorry !</h3>
        <p>Market is Closed for today. Please come next day to play.</p>
        <button className="auth-btn" onClick={onClose}>OK</button>
      </div>
    </div>
  );
}
