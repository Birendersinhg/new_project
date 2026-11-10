import { useEffect, useState, type ComponentType } from 'react';
import Layout from './Layout';
import Login from './Login';
import Dashboard from './pages/Dashboard';
import { UserList, UserDetails, ReferralReport } from './pages/Users';
import { DeclareResult, GameNames, GameRates } from './pages/Games';
import * as Reports from './pages/Reports';
import * as WalletPages from './pages/Wallet';
import * as Numbers from './pages/Numbers';
import * as SettingsPages from './pages/Settings';
import type { Go, PageParams, PageProps } from './types';

const PAGES: Record<string, ComponentType<PageProps>> = {
  dashboards: Dashboard,
  user_management: UserList,
  'user-details': UserDetails,
  referrals: ReferralReport,
  declare_result: DeclareResult,
  report_bid_history: Reports.BidHistory,
  report_sell: Reports.SellReport,
  report_winning: Reports.WinningReport,
  report_bid_win: Reports.BidWinReport,
  report_withdraw: Reports.WithdrawReport,
  report_auto_deposit: Reports.AutoDepositHistory,
  report_add_fund: Reports.AddFundReport,
  deposits: WalletPages.FundRequest,
  withdrawals: WalletPages.WithdrawRequest,
  add_fund_wallet: WalletPages.AddFund,
  bid_revert: WalletPages.BidRevert,
  game_names: GameNames,
  rates: GameRates,
  num_single: Numbers.SingleDigit,
  num_jodi: Numbers.JodiDigit,
  num_single_pana: Numbers.SinglePana,
  num_double_pana: Numbers.DoublePana,
  num_triple_pana: Numbers.TriplePana,
  num_half_sangam: Numbers.HalfSangam,
  num_full_sangam: Numbers.FullSangam,
  auto_active: SettingsPages.AutoActive,
  settings: SettingsPages.MainSettings,
  contact_settings: SettingsPages.ContactSettings,
  sliders: SettingsPages.SliderImages,
  how_to_play: SettingsPages.HowToPlay,
};

const readTab = () => new URLSearchParams(location.search).get('tab') || 'dashboards';

export default function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('demo-auth') === '1');
  const [tab, setTab] = useState(readTab);
  const [params, setParams] = useState<PageParams>({});

  useEffect(() => {
    const onPop = () => setTab(readTab());
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  const go: Go = (t, p = {}) => {
    setParams(p);
    setTab(t);
    history.pushState(null, '', `?tab=${t}`);
    scrollTo(0, 0);
  };
  const login = () => { sessionStorage.setItem('demo-auth', '1'); setAuthed(true); };
  const logout = () => { sessionStorage.removeItem('demo-auth'); setAuthed(false); };

  if (!authed) return <Login onLogin={login} />;
  const Page = PAGES[tab] || Dashboard;
  return (
    <Layout tab={tab} go={go} onLogout={logout}>
      <Page go={go} params={params} />
    </Layout>
  );
}
