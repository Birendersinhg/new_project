// End-to-end API test on a fresh in-memory database.
process.env.NODE_ENV = 'test';
process.env.DB_FILE = ':memory:';
process.env.ADMIN_EMAIL = 'admin@test.com';
process.env.ADMIN_PASSWORD = 'secret99';

const { server } = await import('../src/index.ts');
const { clock } = await import('../src/time.ts');
await new Promise<void>((r) => server.listen(0, r));
const port = (server.address() as { port: number }).port;

let fails = 0;
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) fails++;
};

async function api(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`http://localhost:${port}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() as any };
}

const at = (h: number, m = 0) => { clock.now = () => new Date(2026, 10, 19, h, m); };
at(9, 0);

// ---------- registration + login ----------
let r = await api('POST', '/api/auth/otp', { name: 'Ravi', mobile: '9876543210' });
check('OTP requested', r.status === 200 && r.data.demoOtp === '123456');
r = await api('POST', '/api/auth/verify', { mobile: '9876543210', otp: '000000' });
check('wrong OTP rejected', r.status === 400);
r = await api('POST', '/api/auth/verify', { mobile: '9876543210', otp: '123456' });
const ticket = r.data.ticket;
check('OTP verified -> ticket', r.status === 200 && !!ticket);
r = await api('POST', '/api/auth/register', { ticket, password: '123' });
check('short password rejected', r.status === 400);
r = await api('POST', '/api/auth/register', { ticket, password: 'pass1234' });
let user = r.data.token;
check('registered and logged in', r.status === 200 && !!user);
r = await api('POST', '/api/auth/register', { ticket, password: 'pass1234' });
check('ticket cannot be reused', r.status === 400);
r = await api('POST', '/api/auth/otp', { name: 'Ravi', mobile: '+91 98765 43210' });
check('same number cannot register twice', r.status === 409);
r = await api('POST', '/api/auth/otp', { name: 'Asha', mobile: '9123456780' });
const r2 = await api('POST', '/api/auth/otp', { name: 'Asha', mobile: '9123456780' });
check('OTP resend blocked for 30 seconds', r.status === 200 && r2.status === 429);

// Real-SMS mode: the code comes from the provider and is never sent back to the app.
const { setOtpProvider } = await import('../src/otp.ts');
setOtpProvider({ demo: false, send: async () => 'ref-42', verify: async (_m, code, ref) => ref === 'ref-42' && code === '4321' });
r = await api('POST', '/api/auth/otp', { name: 'Kiran', mobile: '9988776655' });
check('real mode: no OTP returned to the app', r.status === 200 && r.data.demoOtp === undefined);
r = await api('POST', '/api/auth/verify', { mobile: '9988776655', otp: '123456' });
check('real mode: test code 123456 rejected', r.status === 400);
r = await api('POST', '/api/auth/verify', { mobile: '9988776655', otp: '4321' });
check('real mode: provider-verified code accepted', r.status === 200 && !!r.data.ticket);
setOtpProvider({ demo: false, send: async () => { throw new (await import('../src/otp.ts')).OtpError(502, 'Could not reach the SMS service. Please try again.'); }, verify: async () => false });
r = await api('POST', '/api/auth/otp', { name: 'Neha', mobile: '9876500000' });
check('SMS service down -> clear error', r.status === 502 && r.data.error.includes('SMS service'));
r = await api('GET', '/api/me', undefined, user);
check('welcome bonus 5 credited', r.data.balance === 5 && r.data.name === 'Ravi');
r = await api('POST', '/api/auth/login', { mobile: '9876543210', password: 'nope' });
check('wrong password rejected', r.status === 401);
r = await api('POST', '/api/auth/login', { mobile: '9876543210', password: 'pass1234' });
check('login works', r.status === 200 && !!r.data.token);
user = r.data.token;

// ---------- admin ----------
r = await api('GET', '/api/admin/users');
check('admin routes need login', r.status === 401);
r = await api('GET', '/api/admin/users', undefined, user);
check('user token cannot use admin routes', r.status === 401);
r = await api('POST', '/api/admin/login', { email: 'admin@test.com', password: 'wrong' });
check('admin wrong password rejected', r.status === 401);
r = await api('POST', '/api/admin/login', { email: 'ADMIN@test.com', password: 'secret99' });
const adm = r.data.token;
check('admin login', r.status === 200 && !!adm);
r = await api('GET', '/api/admin/users', undefined, adm);
const uid = r.data[0].id;
check('admin sees registered user', r.data.length === 1 && r.data[0].mobile === '9876543210');

// ---------- markets ----------
r = await api('GET', '/api/markets');
const kalyan = r.data.find((m: any) => m.name === 'Kalyan');
check('38 markets, times in 12h', r.data.length === 38 && kalyan.open === '3:45 PM' && kalyan.close === '5:45 PM');
r = await api('POST', '/api/admin/markets', { name: 'Test Bazar', open: '10:00', close: '09:00' }, adm);
check('close before open rejected', r.status === 400);
r = await api('POST', '/api/admin/markets', { name: 'kalyan', open: '10:00', close: '11:00' }, adm);
check('duplicate game name rejected (any case)', r.status === 409);
r = await api('POST', '/api/admin/markets', { name: 'Test Bazar', open: '10:00', close: '11:00' }, adm);
const testId = r.data.id;
check('admin adds a game', r.status === 200 && !!testId);
r = await api('GET', '/api/markets');
check('new game appears in app', r.data.some((m: any) => m.name === 'Test Bazar' && m.open === '10:00 AM'));
r = await api('PUT', `/api/admin/markets/${testId}`, { name: 'Test Bazar', open: '10:00', close: '11:00', active: false }, adm);
r = await api('GET', '/api/markets');
check('inactive game hidden from app', !r.data.some((m: any) => m.name === 'Test Bazar'));

// ---------- bids ----------
const bid = (game: string, session: string | null, bids: { number: string; points: number }[], m = kalyan.id) =>
  api('POST', '/api/bids', { marketId: m, game, session, bids }, user);
r = await bid('Single Digit', 'Open', [{ number: '1', points: 10 }]);
check('insufficient balance (5 < 10)', r.status === 400 && r.data.error === 'Insufficient balance');
r = await api('POST', `/api/admin/users/${uid}/wallet`, { amount: 1000, op: 'add', remark: 'Test points' }, adm);
check('admin adds 1000 points', r.data.balance === 1005);
r = await api('POST', `/api/admin/users/${uid}/wallet`, { amount: 99999, op: 'deduct' }, adm);
check('admin cannot deduct below 0', r.status === 400);

r = await bid('Single Digit', 'Open', [{ number: '1', points: 5 }]);
check('below minimum points rejected', r.status === 400);
r = await bid('Single Pana', 'Open', [{ number: '112', points: 10 }]);
check('112 rejected as Single Pana', r.status === 400);
r = await bid('Single Digit', 'Open', [{ number: '1', points: 10 }]);
check('single digit open bid', r.status === 200 && r.data.balance === 995);
r = await bid('Single Pana', 'Open', [{ number: '821', points: 10 }]);
check('single pana 821 stored as 128', r.status === 200);
r = await bid('Jodi', null, [{ number: '15', points: 10 }]);
check('jodi before open', r.status === 200);
r = await bid('Half Sangam', null, [{ number: '1-140', points: 10 }, { number: '128-5', points: 10 }]);
check('half sangam A and B', r.status === 200);
r = await bid('Full Sangam', null, [{ number: '128-140', points: 10 }]);
check('full sangam', r.status === 200);
r = await bid('Single Digit', 'Close', [{ number: '5', points: 10 }]);
check('single digit close bid', r.status === 200 && r.data.balance === 935);

at(16, 0); // after Kalyan open (3:45 PM)
r = await bid('Single Digit', 'Open', [{ number: '2', points: 10 }]);
check('open session blocked after open time', r.status === 400);
r = await bid('Jodi', null, [{ number: '22', points: 10 }]);
check('jodi blocked after open time', r.status === 400);
r = await bid('Double Pana', 'Close', [{ number: '500', points: 10 }]);
check('close session still allowed', r.status === 200 && r.data.balance === 925);
at(18, 0); // after close
r = await bid('Single Digit', 'Close', [{ number: '2', points: 10 }]);
check('everything blocked after close', r.status === 400);

// ---------- results + settlement ----------
const bal = async () => (await api('GET', '/api/me', undefined, user)).data.balance as number;
r = await api('POST', '/api/admin/results', { marketId: kalyan.id, date: '2026-11-19', session: 'close', pana: '140' }, adm);
check('close before open rejected', r.status === 400);
r = await api('POST', '/api/admin/results', { marketId: kalyan.id, date: '2026-11-20', session: 'open', pana: '128' }, adm);
check('future date rejected', r.status === 400);
r = await api('POST', '/api/admin/results', { marketId: kalyan.id, date: '2026-11-19', session: 'open', pana: '812' }, adm);
check('open 128 declared (ank 1)', r.status === 200 && r.data.pana === '128' && r.data.ank === '1');
// wins: single "1" open 10 -> 100, SP 128 -> 1500
check('open winners paid: 925 + 100 + 1500', (await bal()) === 2525, `(${await bal()})`);
r = await api('POST', '/api/admin/results', { marketId: kalyan.id, date: '2026-11-19', session: 'close', pana: '140' }, adm);
// close 140 ank 5: single close "5" -> 100, jodi 15 -> 1000, half 1-140 -> 10000, half 128-5 -> 10000, full 128-140 -> 100000; DP 500 loses
check('close winners paid', (await bal()) === 2525 + 100 + 1000 + 10000 + 10000 + 100000, `(${await bal()})`);
r = await api('POST', '/api/admin/results', { marketId: kalyan.id, date: '2026-11-19', session: 'close', pana: '500' }, adm);
// close 500 ank 5: jodi/half B/single close still win; half A (1-140) and full lose; DP 500 now wins 3000
check('corrected close: only the difference changes', (await bal()) === 2525 + 100 + 1000 + 10000 + 3000, `(${await bal()})`);
r = await api('POST', '/api/admin/results', { marketId: kalyan.id, date: '2026-11-19', session: 'close', pana: '500' }, adm);
check('declaring the same result twice pays nothing extra', (await bal()) === 2525 + 100 + 1000 + 10000 + 3000);
r = await api('GET', '/api/charts/market/' + kalyan.id + '?from=2026-11-01&to=2026-11-30');
check('chart shows one result row', r.data.length === 1 && r.data[0].open === '128' && r.data[0].close === '500');
r = await api('DELETE', `/api/admin/results?marketId=${kalyan.id}&date=2026-11-19`, undefined, adm);
check('deleting result reverses all payouts', (await bal()) === 925, `(${await bal()})`);
r = await api('GET', '/api/bids', undefined, user);
check('bids back to pending', r.data.every((b: any) => b.status === 'pending'));

// ---------- settings ----------
r = await api('PUT', '/api/admin/settings', { ticker: 'Hello players', min_bid: '20', max_bid: '10' }, adm);
check('max < min rejected', r.status === 400);
r = await api('PUT', '/api/admin/settings', { ticker: 'Hello players', min_bid: '20', contact_phone: '+91 99999 11111', rates: { single: 95, jodi: 950, sp: 1400, dp: 2800, tp: 7000, half: 10000, full: 100000 } }, adm);
r = await api('GET', '/api/settings');
check('app sees new ticker, phone, min bid, rates', r.data.ticker === 'Hello players' && r.data.phone === '+91 99999 11111' && r.data.minBid === 20 && r.data.rates.single === 95);

// ---------- app mode (gaming / quiz) ----------
r = await api('GET', '/api/settings');
check('app starts in gaming mode with a 20s quiz timer', r.data.mode === 'gaming' && r.data.quizTimer === 20);
r = await api('PUT', '/api/admin/settings', { app_mode: 'quiz', quiz_timer: '30' }, adm);
check('admin saves quiz app mode', r.status === 200);
r = await api('GET', '/api/settings');
check('app sees quiz mode and 30s timer', r.data.mode === 'quiz' && r.data.quizTimer === 30);
r = await api('PUT', '/api/admin/settings', { app_mode: 'something' }, adm);
check('unknown app mode rejected', r.status === 400);
r = await api('PUT', '/api/admin/settings', { quiz_timer: '5' }, adm);
check('unsupported quiz timer rejected', r.status === 400);
r = await api('PUT', '/api/admin/settings', { app_mode: 'gaming' }, adm);
r = await api('GET', '/api/settings');
check('admin can switch back to gaming mode', r.data.mode === 'gaming');

// ---------- home card results ----------
await api('POST', '/api/admin/results', { marketId: kalyan.id, date: '2026-11-19', session: 'open', pana: '128' }, adm);
r = await api('GET', '/api/markets');
let k = r.data.find((m: any) => m.id === kalyan.id);
check('home card gets today\'s open result', k.openPana === '128' && k.closePana === null);
await api('POST', '/api/admin/results', { marketId: kalyan.id, date: '2026-11-19', session: 'close', pana: '140' }, adm);
k = (await api('GET', '/api/markets')).data.find((m: any) => m.id === kalyan.id);
check('home card gets today\'s close result', k.openPana === '128' && k.closePana === '140');
await api('POST', '/api/admin/results', { marketId: kalyan.id, date: '2026-11-18', session: 'open', pana: '230' }, adm);
k = (await api('GET', '/api/markets')).data.find((m: any) => m.id === kalyan.id);
check('yesterday\'s result does not show on today\'s card', k.openPana === '128');

// ---------- content shown in the app ----------
r = await api('PUT', '/api/admin/settings', { how_to_play: 'Pick a market...', notice_board: 'Be fair', whatsapp: '919999911111', sliders: [{ url: 'https://example.com/b.jpg', order: 2 }, { url: 'https://example.com/a.jpg', order: 1 }] }, adm);
r = await api('GET', '/api/settings');
check('app gets how-to-play, notice, whatsapp', r.data.howToPlay === 'Pick a market...' && r.data.notice === 'Be fair' && r.data.whatsapp === '919999911111');
check('app gets slider images in display order', r.data.sliders.join() === 'https://example.com/a.jpg,https://example.com/b.jpg');
r = await api('PUT', '/api/admin/settings', { sliders: [{ url: 'javascript:alert(1)' }] }, adm);
check('non-http slider link rejected', r.status === 400);

// ---------- payment trust and security messages ----------
r = await api('GET', '/api/settings');
check('app gets the trust and security messages', r.data.trust.title === 'Your payment is protected' && r.data.trust.items.length === 5 && r.data.trust.items[0] === 'Your payments are safe and secure.');
r = await api('PUT', '/api/admin/settings', { trust_title: 'Pay safely', trust_note: ' Line one \n\nLine two\n' }, adm);
check('admin saves the trust messages', r.status === 200);
r = await api('GET', '/api/settings');
check('app sees the edited trust messages (blank lines dropped)', r.data.trust.title === 'Pay safely' && r.data.trust.items.join('|') === 'Line one|Line two');
r = await api('PUT', '/api/admin/settings', { trust_note: '1\n2\n3\n4\n5\n6' }, adm);
check('more than 5 trust messages rejected', r.status === 400);

// ---------- starline / disawar ----------
r = await api('POST', '/api/admin/starline', { date: '2026-11-19', slot: '10:00 AM', pana: '852' }, adm);
check('starline declared (852 -> 258, digit 5)', r.status === 200 && r.data.pana === '258' && r.data.ank === '5');
await api('POST', '/api/admin/starline', { date: '2026-11-19', slot: '10:00 AM', pana: '577' }, adm);
r = await api('GET', '/api/charts/starline?from=2026-11-19&to=2026-11-19');
check('starline correction overwrites (one per slot)', r.data.length === 1 && r.data[0].pana === '577');
r = await api('POST', '/api/admin/starline', { date: '2026-11-19', slot: '10:15 AM', pana: '577' }, adm);
check('unknown starline time rejected', r.status === 400);
r = await api('POST', '/api/admin/disawar', { date: '2026-11-19', slot: '10:30 AM', jodi: '32' }, adm);
r = await api('GET', '/api/charts/disawar?from=2026-11-19&to=2026-11-19');
check('disawar declared and shown in chart', r.data.length === 1 && r.data[0].jodi === '32');
r = await api('POST', '/api/admin/disawar', { date: '2026-11-19', slot: '10:30 AM', jodi: '3' }, adm);
check('bad disawar jodi rejected', r.status === 400);
await api('DELETE', '/api/admin/disawar?date=2026-11-19&slot=10:30 AM', undefined, adm);
r = await api('GET', '/api/charts/disawar?from=2026-11-19&to=2026-11-19');
check('disawar result deleted', r.data.length === 0);

// ---------- admin password ----------
const adm2 = (await api('POST', '/api/admin/login', { email: 'admin@test.com', password: 'secret99' })).data.token;
r = await api('POST', '/api/admin/password', { current: 'nope', next: 'newpass123' }, adm);
check('admin password: wrong current rejected', r.status === 400);
r = await api('POST', '/api/admin/password', { current: 'secret99', next: 'short' }, adm);
check('admin password: too short rejected', r.status === 400);
r = await api('POST', '/api/admin/password', { current: 'secret99', next: 'newpass123' }, adm);
check('admin password changed', r.status === 200);
check('other admin sessions logged out, current kept', (await api('GET', '/api/admin/stats', undefined, adm2)).status === 401 && (await api('GET', '/api/admin/stats', undefined, adm)).status === 200);
check('old admin password no longer works', (await api('POST', '/api/admin/login', { email: 'admin@test.com', password: 'secret99' })).status === 401);

// ---------- bid revert ----------
{
  const sita = (await api('GET', '/api/markets')).data.find((m: any) => m.name === 'Sita Night'); // 6:40 PM - 7:40 PM
  at(9, 0);
  await api('POST', `/api/admin/users/${uid}/wallet`, { amount: 500, op: 'add' }, adm);
  const start = await bal();
  await bid('Single Digit', 'Open', [{ number: '3', points: 20 }, { number: '4', points: 30 }], sita.id);
  await bid('Jodi', null, [{ number: '34', points: 40 }], sita.id);
  check('bids placed for revert test', (await bal()) === start - 90);
  const report = (await api('GET', `/api/admin/bids?date=2026-11-19&marketId=${sita.id}`, undefined, adm)).data;
  const single3 = report.find((b: any) => b.number === '3');
  r = await api('POST', '/api/admin/bids/revert', { marketId: sita.id, date: '2026-11-19', ids: [single3.id] }, adm);
  check('revert one bid refunds its points', r.status === 200 && r.data.reverted === 1 && (await bal()) === start - 70);
  r = await api('POST', '/api/admin/bids/revert', { marketId: sita.id, date: '2026-11-19', ids: [single3.id] }, adm);
  check('same bid cannot be reverted twice', r.status === 400 && (await bal()) === start - 70);
  // Declaring open 300 (ank 3) must not pay the reverted "3" bid; "4" loses.
  await api('POST', '/api/admin/results', { marketId: sita.id, date: '2026-11-19', session: 'open', pana: '300' }, adm);
  check('reverted bid is not paid when its number wins', (await bal()) === start - 70);
  r = await api('POST', '/api/admin/bids/revert', { marketId: sita.id, date: '2026-11-19' }, adm);
  check('revert all: only still-pending bids (jodi 40)', r.status === 200 && r.data.reverted === 1 && r.data.points === 40 && (await bal()) === start - 30);
  r = await api('POST', '/api/admin/bids/revert', { marketId: sita.id, date: '2026-11-19' }, adm);
  check('nothing left to revert -> clear error', r.status === 400);
  const mine = (await api('GET', '/api/bids', undefined, user)).data.filter((b: any) => b.market === 'Sita Night');
  check('user sees reverted and lost statuses', mine.filter((b: any) => b.status === 'reverted').length === 2 && mine.some((b: any) => b.status === 'lost'));
  await api('DELETE', `/api/admin/results?marketId=${sita.id}&date=2026-11-19`, undefined, adm);
  const after = (await api('GET', '/api/bids', undefined, user)).data.filter((b: any) => b.market === 'Sita Night');
  check('deleting the result keeps reverted bids reverted', after.filter((b: any) => b.status === 'reverted').length === 2 && (await bal()) === start - 30);
  const tx = (await api('GET', `/api/admin/users/${uid}`, undefined, adm)).data.wallet;
  check('refund shows in wallet history', tx.some((w: any) => w.remark.startsWith('Refund: Sita Night') && w.amt === 20));
}

// ---------- UPI payments (intent link + UTR, no gateway) ----------
{
  r = await api('GET', '/api/settings');
  check('UPI is off until the admin sets it up', r.data.upi.enabled === false);
  r = await api('POST', '/api/payments/upi', { amount: 500, utr: '123456789012', payer: 'ravi@ybl' }, user);
  check('deposit rejected while UPI is off', r.status === 400);

  r = await api('PUT', '/api/admin/settings', { upi_id: ' shop@okhdfc ', upi_name: 'My Shop', upi_note: 'Top up', upi_enabled: '1', min_deposit: '50', min_withdraw: '100' }, adm);
  check('admin saves UPI settings', r.status === 200);
  r = await api('GET', '/api/settings');
  check('app sees the UPI ID (spaces cleaned) and limits', r.data.upi.enabled === true && r.data.upi.vpa === 'shop@okhdfc' && r.data.upi.name === 'My Shop' && r.data.upi.minDeposit === 50 && r.data.upi.minWithdraw === 100);
  r = await api('PUT', '/api/admin/settings', { upi_id: 'not-a-vpa' }, adm);
  check('bad UPI ID rejected by the admin settings', r.status === 400);

  const before = await bal();
  r = await api('POST', '/api/payments/upi', { amount: 500, utr: '123456789012' }, user);
  check('the payer UPI ID / mobile is required', r.status === 400);
  r = await api('POST', '/api/payments/upi', { amount: 500, utr: '123456789012', payer: 'not an id!' }, user);
  check('a bad payer is rejected', r.status === 400);
  r = await api('POST', '/api/payments/upi', { amount: 500, utr: '12345', payer: 'ravi@ybl' }, user);
  check('UTR must be 12 digits', r.status === 400);
  r = await api('POST', '/api/payments/upi', { amount: 49, utr: '123456789012', payer: 'ravi@ybl' }, user);
  check('deposit below the minimum rejected', r.status === 400);
  r = await api('POST', '/api/payments/upi', { amount: 500, utr: '123456789012', payer: 'ravi@ybl' }, user);
  const dep = r.data.id;
  check('deposit claim saved as pending with the payer', r.status === 200 && r.data.status === 'pending' && r.data.payer === 'ravi@ybl');
  check('a claim never credits the wallet by itself', (await bal()) === before);
  r = await api('POST', '/api/payments/upi', { amount: 500, utr: '123456789012', payer: '9876543210' }, user);
  check('the same UTR cannot be claimed twice', r.status === 409);

  r = await api('GET', '/api/admin/payments?status=pending', undefined, adm);
  check('admin sees the pending claim with user, UTR and payer', r.data.some((p: any) => p.id === dep && p.utr === '123456789012' && p.payer === 'ravi@ybl' && p.mobile === '9876543210'));
  r = await api('POST', `/api/admin/payments/${dep}`, { action: 'approve' }, adm);
  check('admin approval credits the points', r.status === 200 && r.data.status === 'approved' && (await bal()) === before + 500);
  r = await api('POST', `/api/admin/payments/${dep}`, { action: 'approve' }, adm);
  check('the same claim cannot be approved twice', r.status === 409);
  check('wallet history shows the deposit', (await api('GET', `/api/admin/users/${uid}`, undefined, adm)).data.wallet.some((w: any) => w.remark.includes('UPI deposit') && w.amt === 500));

  r = await api('POST', '/api/payments/upi', { amount: 300, utr: '999888777666', payer: '9876500011' }, user);
  const dep2 = r.data.id;
  r = await api('POST', `/api/admin/payments/${dep2}`, { action: 'reject', remark: 'UTR not found in bank statement' }, adm);
  check('rejecting a claim credits nothing', r.status === 200 && r.data.status === 'rejected' && (await bal()) === before + 500);

  // ---------- withdrawals ----------
  const wBefore = await bal();
  r = await api('POST', '/api/withdrawals', { amount: 100, method: 'upi', upi: 'bad id' }, user);
  check('withdrawal with a bad UPI ID rejected', r.status === 400);
  r = await api('POST', '/api/withdrawals', { amount: 50, method: 'upi', upi: 'ravi@ybl' }, user);
  check('withdrawal below the minimum rejected', r.status === 400);
  r = await api('POST', '/api/withdrawals', { amount: 300, method: 'upi', upi: 'ravi@ybl' }, user);
  const wd = r.data.id;
  check('withdrawal request holds the points', r.status === 200 && (await bal()) === wBefore - 300);
  r = await api('POST', '/api/withdrawals', { amount: 10_000_000, method: 'upi', upi: 'ravi@ybl' }, user);
  check('withdrawal above the balance rejected', r.status === 400 && (await bal()) === wBefore - 300);
  r = await api('POST', `/api/admin/withdrawals/${wd}`, { action: 'reject', remark: 'Wrong UPI ID' }, adm);
  check('rejecting a withdrawal refunds the points', r.status === 200 && (await bal()) === wBefore);
  r = await api('POST', '/api/withdrawals', { amount: 200, method: 'bank', accountName: 'Ravi Kumar', accountNo: '123456789012', ifsc: 'hdfc0001234' }, user);
  const wd2 = r.data.id;
  check('bank withdrawal accepted (IFSC upper-cased)', r.status === 200 && (await bal()) === wBefore - 200);
  r = await api('POST', `/api/admin/withdrawals/${wd2}`, { action: 'pay' }, adm);
  check('paying keeps the points deducted', r.status === 200 && r.data.status === 'paid' && (await bal()) === wBefore - 200);

  r = await api('GET', '/api/payments/mine', undefined, user);
  check('user sees deposit and withdrawal history', r.data.deposits.length === 2 && r.data.deposits.some((d: any) => d.status === 'approved') && r.data.withdrawals.length === 2 && r.data.withdrawals.some((w: any) => w.status === 'paid'));
  check('account number is masked in the user app', r.data.withdrawals.every((w: any) => !w.accountNo || w.accountNo.endsWith('9012')));

  // turn UPI back off so later checks see a clean state
  await api('PUT', '/api/admin/settings', { upi_enabled: '0' }, adm);
}

// ---------- permissions ----------
await api('PATCH', `/api/admin/users/${uid}`, { betting: false }, adm);
at(9, 0);
r = await bid('Single Digit', 'Open', [{ number: '1', points: 20 }]);
check('betting blocked by admin', r.status === 403);
r = await api('GET', '/api/me', undefined, user);
check('active user is in gaming mode by default', r.data.mode === 'gaming' && r.data.active === true);
await api('PATCH', `/api/admin/users/${uid}`, { active: false }, adm);
r = await api('GET', '/api/me', undefined, user);
check('deactivated user stays signed in and gets the quiz', r.status === 200 && r.data.mode === 'quiz' && r.data.active === false);
r = await api('POST', '/api/auth/login', { mobile: '9876543210', password: 'pass1234' });
check('deactivated user can still login (quiz app)', r.status === 200 && !!r.data.token);
user = r.data.token;
r = await bid('Single Digit', 'Open', [{ number: '1', points: 20 }]);
check('deactivated user cannot bid', r.status === 401);
await api('PATCH', `/api/admin/users/${uid}`, { active: true }, adm);
r = await api('GET', '/api/me', undefined, user);
check('reactivated user returns to gaming mode', r.data.mode === 'gaming' && r.data.active === true);
await api('PUT', '/api/admin/settings', { app_mode: 'quiz' }, adm);
r = await api('GET', '/api/me', undefined, user);
check('global quiz mode applies to active users too', r.data.mode === 'quiz');
await api('PUT', '/api/admin/settings', { app_mode: 'gaming' }, adm);

server.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
