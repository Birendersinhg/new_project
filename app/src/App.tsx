import { useCallback, useEffect, useState } from 'react';
import {
  Menu, Bell, Wallet, PlayCircle, Phone, BarChart3, Play, X,
  Gavel, ScrollText, Home, Headphones,
} from 'lucide-react';
import { isRunning, resultText, type Market } from './data';
import { api, getToken, setToken, setUnauthorizedHandler, type Me, type PublicSettings, type SlotKind } from './api';
import { AppDataContext, useAppData, type AppData } from './appdata';
import type { Go, LucideIcon, View } from './types';
import Auth from './Auth';
import Drawer from './Drawer';
import {
  BidsScreen, FundsScreen, NotificationsScreen, PlaceholderScreen, SupportModal,
} from './screens';
import { AddMoneyScreen, FundHistoryScreen, WithdrawScreen } from './payments';
import { GameTypesScreen, ClosedModal } from './games';
import { GameRateScreen, TimeTableScreen } from './rates';
import { SettingsScreen } from './settings';
import { GamePlayScreen } from './play';
import { BidHistoryScreen, PassbookScreen } from './history';
import { SlotGamesScreen, SlotPlayScreen, SlotsScreen } from './slots';
import { LiveChatScreen } from './livechat';
import QuizApp from './quiz';
import { useT } from './i18n';
import { LanguageButton } from './langpicker';
import { setTheme } from './theme';
import { MaintenanceScreen } from './maintenance';
import { Banner, HowToPlayScreen, NoticeScreen } from './content';
import {
  ChartHubScreen, ChartMarketsScreen, JodiChartScreen, PanelChartScreen, StarlineChartScreen, DisawarChartScreen,
} from './charts';

const NAV: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'bids', label: 'Bids', icon: Gavel },
  { id: 'passbook', label: 'Passbook', icon: ScrollText },
  { id: 'home', label: 'Home', icon: Home },
  { id: 'funds', label: 'Funds', icon: Wallet },
  { id: 'support', label: 'Support', icon: Headphones },
];

interface MarketCardProps {
  market: Market;
  running: boolean;
  onOpen: () => void;
  onChart: () => void;
}

function MarketCard({ market, running, onOpen, onChart }: MarketCardProps) {
  const t = useT();
  return (
    <div className="card" onClick={onOpen}>
      <div className="card-info">
        <h3>{market.name}</h3>
        <div className="result">{resultText(market)}</div>
        <div className="times">
          <div><span>{t('Open Bids')}</span><b>{market.open}</b></div>
          <div><span>{t('Close Bids')}</span><b>{market.close}</b></div>
        </div>
      </div>
      <div className="card-actions">
        <button className="round chart" aria-label="Chart" onClick={(e) => { e.stopPropagation(); onChart(); }}><BarChart3 size={26} /></button>
        <span className="label chart-label">{t('Chart')}</span>
      </div>
      <div className="card-actions">
        <button className={`round ${running ? 'run' : 'closed'}`} aria-label={running ? 'Play' : 'Closed'}>
          {running ? <Play size={26} fill="#fff" /> : <X size={30} />}
        </button>
        <span className={`label ${running ? 'run-label' : 'closed-label'}`}>
          {t(running ? 'Running Now' : 'Closed Now')}
        </span>
      </div>
    </div>
  );
}

interface HomeScreenProps {
  now: Date;
  balance: number;
  mobile: string;
  go: Go;
  onMenu: () => void;
  onSupport: () => void;
  onMarket: (market: Market) => void;
  onChart: (market: Market) => void;
}

function HomeScreen({ now, balance, mobile, go, onMenu, onSupport, onMarket, onChart }: HomeScreenProps) {
  const { markets, settings } = useAppData();
  const t = useT();
  return (
    <div className="phone">
      <header className="header">
        <button className="icon-btn" aria-label="Menu" onClick={onMenu}><Menu size={34} /></button>
        <h1>{settings.appName}</h1>
        <button className="wallet" onClick={() => go('addmoney')}><Wallet size={22} /> ₹{balance.toFixed(1)}</button>
        <LanguageButton />
        <button className="icon-btn" aria-label="Notifications" onClick={() => go('notifications')}><Bell size={30} /></button>
      </header>
      <div className="ticker">
        <div className="ticker-track">
          {[0, 1].map((i) => <span key={i}>{settings.ticker}&nbsp;&nbsp;-&nbsp;&nbsp;</span>)}
        </div>
      </div>

      <Banner />
      {settings.texts.home && <div className="info-box home-info">{settings.texts.home}</div>}
      <div className="top-actions">
        <button className="pill-btn" onClick={() => go('starline')}><PlayCircle size={30} /> {t('STARLINE')}</button>
        <button className="pill-btn bright" onClick={() => go('jackpot')}><PlayCircle size={30} /> {t('JACKPOT')}</button>
      </div>
      <div className="contact">
        <span className="call"><Phone size={20} fill="#fff" /></span>
        <span className="number">+91 {mobile.slice(0, 5)} {mobile.slice(5)}</span>
        <button className="deposit" onClick={() => go('addmoney')}><Wallet size={22} /> {t('Deposit')}</button>
      </div>
      <div className="list">
        {markets.map((m) => <MarketCard key={m.id} market={m} running={isRunning(m, now)} onOpen={() => onMarket(m)} onChart={() => onChart(m)} />)}
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
            <span>{t(label)}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  const t = useT();
  const [token, setTokenState] = useState(getToken);
  const [me, setMe] = useState<Me | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<View>('home');
  const [drawer, setDrawer] = useState(false);
  const [support, setSupport] = useState(false);
  const [market, setMarket] = useState<Market | null>(null);
  const [closed, setClosed] = useState(false);
  const [game, setGame] = useState('');
  const [chartMarket, setChartMarket] = useState<Market | null>(null);
  const [chartFrom, setChartFrom] = useState<'home' | 'chartmarkets'>('chartmarkets');
  const [now, setNow] = useState(new Date());
  const [slotKind, setSlotKind] = useState<SlotKind>('starline');
  const [slot, setSlot] = useState('');
  const [slotGames, setSlotGames] = useState<string[]>([]);
  const [slotGame, setSlotGame] = useState('');

  const signOut = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setMe(null);
    setDrawer(false);
    setView('home');
  }, []);
  useEffect(() => setUnauthorizedHandler(signOut), [signOut]);

  const refreshMe = useCallback(async () => setMe(await api<Me>('GET', '/me')), []);
  // Markets, settings and balance come from the server; refreshed every 30s so admin changes show up.
  const load = useCallback(async () => {
    try {
      const [m, s, u] = await Promise.all([
        api<Market[]>('GET', '/markets'),
        api<PublicSettings>('GET', '/settings'),
        api<Me>('GET', '/me'),
      ]);
      setMarkets(m);
      setSettings(s);
      setMe(u);
      setLoadError('');
    } catch (err) {
      setLoadError((err as Error).message);
    }
  }, []);

  // The colours the admin picked.
  useEffect(() => { if (settings?.theme) setTheme(settings.theme); }, [settings?.theme.start, settings?.theme.end, settings?.theme.accent, settings?.theme.bg]);

  // The browser tab title and the login screen use the name the admin set.
  useEffect(() => {
    if (!settings?.appName) return;
    document.title = settings.appName;
    try { localStorage.setItem('kalyan_app_name', settings.appName); } catch { /* not persisted */ }
  }, [settings?.appName]);

  useEffect(() => {
    if (!token) return;
    load();
    // Refreshed often so an admin's active/inactive and Auto Active changes show up quickly.
    const t = setInterval(() => { setNow(new Date()); load(); }, 10000);
    return () => clearInterval(t);
  }, [token, load]);

  if (!token) {
    return <Auth onAuthed={(t) => { setToken(t); setTokenState(t); setView('home'); }} />;
  }
  if (!me || !settings) {
    return (
      <div className="phone"><div className="empty">
        {loadError ? <><h3>{t('Could not load')}</h3><p>{loadError}</p><button className="auth-btn" style={{ maxWidth: 220 }} onClick={load}>{t('TRY AGAIN')}</button></> : <h3>{t('Loading...')}</h3>}
      </div></div>
    );
  }
  if (settings.maintenance.on) return <MaintenanceScreen message={settings.maintenance.message} onRetry={load} />;
  const balance = me.balance;
  const data: AppData = { me, markets, settings, refreshMe };

  const go: Go = (id) => { setDrawer(false); setView(id); window.scrollTo(0, 0); };
  const back = () => go('home');
  // Game types only open while the market is running; otherwise show the closed popup.
  const openMarket = (m: Market) => {
    if (!isRunning(m)) return setClosed(true);
    setMarket(m);
    go('games');
  };
  const logout = () => { api('POST', '/auth/logout').catch(() => {}); signOut(); };

  // Auto Active (set by the admin) decides which app the user sees after login; the server
  // also returns 'quiz' for this user alone when the admin marks the account inactive.
  if (me.mode === 'quiz') {
    return <QuizApp name={me.name} timerSeconds={settings.quizTimer} onLogout={logout} />;
  }

  let screen;
  switch (view) {
    case 'home':
      screen = <HomeScreen now={now} balance={balance} mobile={me.mobile} go={go} onMenu={() => setDrawer(true)} onSupport={() => setSupport(true)} onMarket={openMarket}
        onChart={(m) => { setChartMarket(m); setChartFrom('home'); go('panelchart'); }} />;
      break;
    case 'bids': screen = <BidsScreen onBack={back} onOpen={go} />; break;
    case 'funds': screen = <FundsScreen onBack={back} onOpen={go} />; break;
    case 'addmoney': screen = <AddMoneyScreen balance={balance} onBack={back} />; break;
    case 'withdraw': screen = <WithdrawScreen balance={balance} onBack={back} />; break;
    case 'Add Fund History': screen = <FundHistoryScreen kind="deposit" onBack={() => go('funds')} />; break;
    case 'Withdraw Fund History': screen = <FundHistoryScreen kind="withdraw" onBack={() => go('funds')} />; break;
    case 'games':
      screen = market ? <GameTypesScreen market={market} onBack={back} onPick={(g) => { setGame(g); go('play'); }} /> : null;
      break;
    case 'play':
      screen = market ? <GamePlayScreen key={`${market.id}-${game}`} market={market} game={game} now={now} balance={balance} onBack={() => go('games')} onAddMoney={() => go('addmoney')} /> : null;
      break;
    case 'starline': case 'jackpot': {
      const kind: SlotKind = view === 'jackpot' ? 'jackpot' : 'starline';
      screen = <SlotsScreen kind={kind} onBack={back} onPick={(s, games) => {
        setSlotKind(kind); setSlot(s); setSlotGames(games);
        if (games.length === 1) { setSlotGame(games[0]); go('slotplay'); } else go('slotgames');
      }} />;
      break;
    }
    case 'slotgames':
      screen = <SlotGamesScreen kind={slotKind} slot={slot} games={slotGames} onBack={() => go(slotKind)} onPick={(g) => { setSlotGame(g); go('slotplay'); }} />;
      break;
    case 'slotplay':
      screen = <SlotPlayScreen key={`${slotKind}-${slot}-${slotGame}`} kind={slotKind} slot={slot} game={slotGame} balance={balance}
        onBack={() => go(slotGames.length === 1 ? slotKind : 'slotgames')} onAddMoney={() => go('addmoney')} />;
      break;
    case 'chart': screen = <ChartHubScreen onBack={back} onOpen={go} />; break;
    case 'chartmarkets':
      screen = <ChartMarketsScreen onBack={() => go('chart')} onPick={(m, t) => { setChartMarket(m); setChartFrom('chartmarkets'); go(t === 'jodi' ? 'jodichart' : 'panelchart'); }} />;
      break;
    case 'jodichart':
      screen = chartMarket ? <JodiChartScreen market={chartMarket} now={now} onBack={() => go('chartmarkets')} /> : null;
      break;
    case 'panelchart':
      screen = chartMarket ? <PanelChartScreen market={chartMarket} now={now} onBack={() => go(chartFrom)} /> : null;
      break;
    case 'starlinechart': screen = <StarlineChartScreen now={now} onBack={() => go('chart')} />; break;
    case 'disawarchart': screen = <DisawarChartScreen now={now} onBack={() => go('chart')} />; break;
    case 'gamerate': screen = <GameRateScreen onBack={back} />; break;
    case 'timetable': screen = <TimeTableScreen onBack={back} />; break;
    case 'settings': screen = <SettingsScreen onBack={back} />; break;
    case 'Bid History': screen = <BidHistoryScreen onBack={() => go('bids')} />; break;
    case 'Starline Bid History': screen = <BidHistoryScreen kind="starline" onBack={() => go('bids')} />; break;
    case 'Disawar Bid History': screen = <BidHistoryScreen kind="jackpot" onBack={() => go('bids')} />; break;
    case 'livechat': screen = <LiveChatScreen onBack={back} />; break;
    case 'passbook': screen = <PassbookScreen onBack={back} />; break;
    case 'howtoplay': screen = <HowToPlayScreen onBack={back} />; break;
    case 'notice': screen = <NoticeScreen onBack={back} />; break;
    case 'notifications': screen = <NotificationsScreen onBack={back} />; break;
    default: screen = <PlaceholderScreen title={view} onBack={back} />;
  }

  return (
    <AppDataContext.Provider value={data}>
      {screen}
      <Drawer
        open={drawer}
        user={{ name: me.name, mobile: me.mobile }}
        onClose={() => setDrawer(false)}
        onNavigate={go}
        onLogout={logout}
      />
      {support && <SupportModal onClose={() => setSupport(false)} onChat={() => { setSupport(false); go('livechat'); }} />}
      {closed && <ClosedModal onClose={() => setClosed(false)} />}
    </AppDataContext.Provider>
  );
}
