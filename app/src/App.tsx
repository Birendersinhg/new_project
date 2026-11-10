import { useEffect, useState } from 'react';
import {
  Menu, Bell, Wallet, PlayCircle, Phone, BarChart3, Play, X,
  Gavel, ScrollText, Home, Headphones,
} from 'lucide-react';
import { MARKETS, isRunning, type Market } from './data';
import type { Go, LucideIcon, View } from './types';
import Auth from './Auth';
import Drawer from './Drawer';
import {
  BidsScreen, FundsScreen, MoneyScreen, NotificationsScreen, PlaceholderScreen, SupportModal,
} from './screens';
import { getUsers, getSession, setSession, clearSession } from './storage';

const NAV: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'bids', label: 'Bids', icon: Gavel },
  { id: 'passbook', label: 'Passbook', icon: ScrollText },
  { id: 'home', label: 'Home', icon: Home },
  { id: 'funds', label: 'Funds', icon: Wallet },
  { id: 'support', label: 'Support', icon: Headphones },
];

const TICKER = 'PLAY FOR FUN - FREE POINTS ONLY, NO REAL MONEY';

function MarketCard({ market, running }: { market: Market; running: boolean }) {
  return (
    <div className="card">
      <div className="card-info">
        <h3>{market.name}</h3>
        <div className="result">{market.result}</div>
        <div className="times">
          <div><span>Open Bids</span><b>{market.open}</b></div>
          <div><span>Close Bids</span><b>{market.close}</b></div>
        </div>
      </div>
      <div className="card-actions">
        <button className="round chart" aria-label="Chart"><BarChart3 size={26} /></button>
        <span className="label chart-label">Chart</span>
      </div>
      <div className="card-actions">
        <button className={`round ${running ? 'run' : 'closed'}`} aria-label={running ? 'Play' : 'Closed'}>
          {running ? <Play size={26} fill="#fff" /> : <X size={30} />}
        </button>
        <span className={`label ${running ? 'run-label' : 'closed-label'}`}>
          {running ? 'Running Now' : 'Closed Now'}
        </span>
      </div>
    </div>
  );
}

interface HomeScreenProps {
  now: Date;
  balance: number;
  go: Go;
  onMenu: () => void;
  onSupport: () => void;
}

function HomeScreen({ now, balance, go, onMenu, onSupport }: HomeScreenProps) {
  return (
    <div className="phone">
      <header className="header">
        <button className="icon-btn" aria-label="Menu" onClick={onMenu}><Menu size={34} /></button>
        <h1>Kalyan</h1>
        <button className="wallet" onClick={() => go('addmoney')}><Wallet size={22} /> ₹{balance.toFixed(1)}</button>
        <button className="icon-btn" aria-label="Notifications" onClick={() => go('notifications')}><Bell size={30} /></button>
      </header>
      <div className="ticker">
        <div className="ticker-track">
          {[0, 1].map((i) => <span key={i}>{TICKER}&nbsp;&nbsp;-&nbsp;&nbsp;</span>)}
        </div>
      </div>

      <div className="top-actions">
        <button className="pill-btn"><PlayCircle size={30} /> STARLINE</button>
        <button className="pill-btn bright"><PlayCircle size={30} /> JACKPOT</button>
      </div>
      <div className="contact">
        <span className="call"><Phone size={20} fill="#fff" /></span>
        <span className="number">+91 00000 00000</span>
        <button className="deposit" onClick={() => go('addmoney')}><Wallet size={22} /> Deposit</button>
      </div>
      <div className="list">
        {MARKETS.map((m) => <MarketCard key={m.id} market={m} running={isRunning(m, now)} />)}
        <div className="list-end" />
      </div>

      <nav className="nav">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${id === 'home' ? 'active' : ''}`}
            onClick={() => (id === 'support' ? onSupport() : go(id))}
          >
            <Icon size={id === 'home' ? 28 : 26} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  const [mobile, setMobile] = useState(() => getSession());
  const [view, setView] = useState<View>('home');
  const [drawer, setDrawer] = useState(false);
  const [support, setSupport] = useState(false);
  const balance = 5;
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const user = mobile && getUsers()[mobile];
  // A session pointing at a user that no longer exists (cleared storage) falls back to the login page.
  if (!user) {
    return <Auth onAuthed={(m) => { setSession(m); setMobile(m); setView('home'); }} />;
  }

  const go: Go = (id) => { setDrawer(false); setView(id); window.scrollTo(0, 0); };
  const back = () => go('home');
  const logout = () => { clearSession(); setMobile(null); setDrawer(false); setView('home'); };

  let screen;
  switch (view) {
    case 'home':
      screen = <HomeScreen now={now} balance={balance} go={go} onMenu={() => setDrawer(true)} onSupport={() => setSupport(true)} />;
      break;
    case 'bids': screen = <BidsScreen onBack={back} onOpen={go} />; break;
    case 'funds': screen = <FundsScreen onBack={back} onOpen={go} />; break;
    case 'addmoney': screen = <MoneyScreen kind="add" balance={balance} onBack={back} />; break;
    case 'withdraw': screen = <MoneyScreen kind="withdraw" balance={balance} onBack={back} />; break;
    case 'notifications': screen = <NotificationsScreen onBack={back} />; break;
    default: screen = <PlaceholderScreen title={view === 'passbook' ? 'Passbook' : view} onBack={back} />;
  }

  return (
    <>
      {screen}
      <Drawer
        open={drawer}
        user={{ name: user.name, mobile }}
        onClose={() => setDrawer(false)}
        onNavigate={go}
        onLogout={logout}
      />
      {support && <SupportModal onClose={() => setSupport(false)} />}
    </>
  );
}
