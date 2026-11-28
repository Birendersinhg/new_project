// Every game's bids, payouts and history on a fresh in-memory database:
// all ten market games plus Starline and Jackpot are placed, settled by results, and checked in
// the user's Bid History, the Passbook, the admin report, the charts and the wallet totals.
process.env.NODE_ENV = 'test';
process.env.DB_FILE = ':memory:';
process.env.ADMIN_EMAIL = 'admin@test.com';
process.env.ADMIN_PASSWORD = 'secret99';

const { server } = await import('../src/index.ts');
const { clock } = await import('../src/time.ts');
await new Promise<void>((r) => server.listen(0, r));
const port = (server.address() as { port: number }).port;

let fails = 0;
const check = (name: string, ok: boolean, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) fails++; };
async function api(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`http://localhost:${port}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() as any };
}
const DATE = '2026-11-19';
clock.now = () => new Date(2026, 10, 19, 9, 0); // before every market opens, so every game and session can be played

async function register(name: string, mobile: string) {
  await api('POST', '/api/auth/otp', { name, mobile });
  const ticket = (await api('POST', '/api/auth/verify', { mobile, otp: '123456' })).data.ticket;
  return (await api('POST', '/api/auth/register', { ticket, password: 'pass1234' })).data.token as string;
}
const adm = (await api('POST', '/api/admin/login', { email: 'admin@test.com', password: 'secret99' })).data.token;
const user = await register('Ravi', '9876543210');
const other = await register('Asha', '9123456780');
const uid = (await api('GET', '/api/admin/users', undefined, adm)).data.find((u: any) => u.mobile === '9876543210').id;
await api('POST', `/api/admin/users/${uid}/wallet`, { amount: 500000, op: 'add' }, adm);
const balance = async (t = user) => (await api('GET', '/api/me', undefined, t)).data.balance as number;
const start = await balance();

const list = (await api('GET', '/api/admin/markets', undefined, adm)).data as { id: number; name: string; open: string }[];
const [A, B] = list.filter((m) => m.open > '09:00');

// ---------- the bids: [market, game, session, number, points, expected win] ----------
// Market A results: open 128 (ank 1), close 235 (ank 0) -> jodi 10.   Market B: open 112 (DP, ank 4), close 111 (TP, ank 3) -> jodi 43.
type Row = [typeof A, string, string | null, string, number, number];
const rows: Row[] = [
  [A, 'Single Digit', 'Open', '1', 10, 100], [A, 'Single Digit', 'Open', '2', 10, 0],
  [A, 'Single Digit', 'Close', '0', 10, 100], [A, 'Single Digit', 'Close', '9', 10, 0],
  [A, 'Jodi', null, '10', 20, 2000], [A, 'Jodi', null, '11', 10, 0],
  [A, 'Single Pana', 'Open', '128', 10, 1500], [A, 'Single Pana', 'Open', '129', 10, 0], [A, 'Single Pana', 'Close', '235', 10, 1500],
  [A, 'Double Pana', 'Open', '112', 10, 0],
  [A, 'Triple Pana', 'Close', '111', 10, 0],
  [A, 'Half Sangam', null, '1-235', 10, 10000], [A, 'Half Sangam', null, '128-0', 10, 10000], [A, 'Half Sangam', null, '2-235', 10, 0],
  [A, 'Full Sangam', null, '128-235', 10, 100000], [A, 'Full Sangam', null, '128-236', 10, 0],
  [A, 'SP DP TP', 'Open', '128', 10, 1500], [A, 'SP DP TP', 'Open', '137', 10, 0], [A, 'SP DP TP', 'Open', '112', 10, 0],
  [A, 'SP MOTER', 'Close', '235', 10, 1500], [A, 'SP MOTER', 'Close', '236', 10, 0],
  [A, 'DP MOTER', 'Open', '112', 10, 0], [A, 'DP MOTER', 'Open', '122', 10, 0],
  [B, 'Single Digit', 'Open', '4', 10, 100], [B, 'Single Digit', 'Close', '3', 10, 100],
  [B, 'Jodi', null, '43', 10, 1000],
  [B, 'Double Pana', 'Open', '112', 10, 3000], [B, 'Triple Pana', 'Close', '111', 10, 7000],
  [B, 'DP MOTER', 'Open', '112', 10, 3000], [B, 'SP DP TP', 'Close', '111', 10, 7000],
];

// Bids go in one request per market, game and session, the way the app sends them.
const groups = new Map<string, Row[]>();
for (const row of rows) groups.set(`${row[0].id}|${row[1]}|${row[2]}`, [...(groups.get(`${row[0].id}|${row[1]}|${row[2]}`) ?? []), row]);
let spent = 0;
for (const [, g] of groups) {
  const [m, game, session] = g[0];
  const r = await api('POST', '/api/bids', { marketId: m.id, game, session, bids: g.map((x) => ({ number: x[3], points: x[4] })) }, user);
  const total = g.reduce((s, x) => s + x[4], 0);
  spent += total;
  check(`placed ${game}${session ? ' ' + session : ''} on market ${m === A ? 'A' : 'B'}`, r.status === 200 && r.data.count === g.length && r.data.total === total, JSON.stringify(r.data));
}

// ---------- stored correctly right after placing ----------
check('wallet balance went down by exactly the points played', (await balance()) === start - spent, `${await balance()} vs ${start - spent}`);
let hist = (await api('GET', '/api/bids', undefined, user)).data as any[];
check('Bid History has every bid', hist.length === rows.length, `${hist.length}/${rows.length}`);
check('every bid starts as pending with no win', hist.every((b) => b.status === 'pending' && b.win === 0));
check('history points add up to the points spent', hist.reduce((s, b) => s + b.points, 0) === spent);
const keyOf = (b: any) => `${b.market}|${b.game}|${b.session ?? ''}|${b.number}`;
const stored = new Map(hist.map((b) => [keyOf(b), b]));
const missing = rows.filter((r) => !stored.has(`${r[0].name}|${r[1]}|${r[2] ?? ''}|${r[3]}`));
check('each bid is stored with its market, game, session and number', missing.length === 0, missing.map((r) => `${r[1]} ${r[3]}`).join(', '));
check('every bid carries the date and a time', hist.every((b) => b.date === DATE && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(b.at)));
check('sessions are stored only for games that use them', hist.filter((b) => ['Jodi', 'Half Sangam', 'Full Sangam'].includes(b.game)).every((b) => b.session === null) && hist.filter((b) => b.game === 'Single Digit').every((b) => b.session === 'Open' || b.session === 'Close'));
let pass = (await api('GET', '/api/passbook', undefined, user)).data as any[];
check('Passbook shows one debit per placed request', pass.filter((t) => /^Bid: /.test(t.remark)).length === groups.size && pass.filter((t) => /^Bid: /.test(t.remark)).every((t) => t.amount < 0));
check("another user's history stays empty", (await api('GET', '/api/bids', undefined, other)).data.length === 0);
const adminRows = (id: number) => api('GET', `/api/admin/bids?date=${DATE}&marketId=${id}`, undefined, adm).then((r) => r.data as any[]);
check('admin report lists every bid of market A', (await adminRows(A.id)).length === rows.filter((r) => r[0] === A).length);
check('admin report lists every bid of market B', (await adminRows(B.id)).length === rows.filter((r) => r[0] === B).length);
check('admin report names the user and mobile', (await adminRows(A.id)).every((b) => b.user === 'Ravi' && b.mobile === '9876543210'));

// ---------- results settle every game ----------
const declare = (m: typeof A, session: 'open' | 'close', pana: string) => api('POST', '/api/admin/results', { marketId: m.id, date: DATE, session, pana }, adm);
await declare(A, 'open', '128');
hist = (await api('GET', '/api/bids', undefined, user)).data as any[];
const byKey = () => new Map(hist.map((b) => [keyOf(b), b]));
const openOnly = rows.filter((r) => r[0] === A && r[2] === 'Open');
check('after the open result, Open-session bids of A are settled', openOnly.every((r) => { const b = byKey().get(`${A.name}|${r[1]}|${r[2]}|${r[3]}`); return b.status === (r[5] > 0 ? 'won' : 'lost') && b.win === r[5]; }));
check('close-session and jodi/sangam bids wait for the close result', rows.filter((r) => r[0] === A && (r[2] === 'Close' || r[2] === null)).every((r) => byKey().get(`${A.name}|${r[1]}|${r[2] ?? ''}|${r[3]}`).status === 'pending'));
check('bids of the other market are untouched', rows.filter((r) => r[0] === B).every((r) => byKey().get(`${B.name}|${r[1]}|${r[2] ?? ''}|${r[3]}`).status === 'pending'));
await declare(A, 'close', '235');
await declare(B, 'open', '112');
await declare(B, 'close', '111');
hist = (await api('GET', '/api/bids', undefined, user)).data as any[];
const wrong = rows.filter((r) => { const b = byKey().get(`${r[0].name}|${r[1]}|${r[2] ?? ''}|${r[3]}`); return !b || b.status !== (r[5] > 0 ? 'won' : 'lost') || b.win !== r[5]; });
check('every bid ends won or lost with the right payout', wrong.length === 0, wrong.map((r) => `${r[1]} ${r[3]}`).join(', '));
const winnings = rows.reduce((s, r) => s + r[5], 0);
check('the history wins add up to the expected total', hist.reduce((s, b) => s + b.win, 0) === winnings);
check('wallet = start - points played + winnings', (await balance()) === start - spent + winnings, `${await balance()} vs ${start - spent + winnings}`);
pass = ((await api('GET', '/api/passbook', undefined, user)).data as any[]).slice().reverse();
check('Passbook has one Win entry per winning bid', pass.filter((t) => /^Win: /.test(t.remark)).length === rows.filter((r) => r[5] > 0).length);
check('Passbook win entries add up to the winnings', pass.filter((t) => /^Win: /.test(t.remark)).reduce((s, t) => s + t.amount, 0) === winnings);
let chain = true, prev = 0;
for (const t of pass) { if (prev + t.amount !== t.balance) chain = false; prev = t.balance; }
check('every Passbook balance follows from the one before it', chain && prev === (await balance()));
check('the user history is newest first', hist.every((b, i) => i === 0 || hist[i - 1].at >= b.at));

// ---------- charts keep both results of every market ----------
const chartA = (await api('GET', `/api/charts/market/${A.id}?from=2026-11-01&to=2026-11-30`)).data as any[];
const chartB = (await api('GET', `/api/charts/market/${B.id}?from=2026-11-01&to=2026-11-30`)).data as any[];
check('chart of market A stores open and close', chartA.length === 1 && chartA[0].open === '128' && chartA[0].close === '235');
check('chart of market B stores open and close', chartB.length === 1 && chartB[0].open === '112' && chartB[0].close === '111');
const home = ((await api('GET', '/api/markets')).data as any[]).find((m) => m.id === A.id);
check('the home card shows the declared result', home.openPana === '128' && home.closePana === '235');

// ---------- Starline and Jackpot ----------
const before = await balance();
const slotRows: [string, string, string, string, number, number][] = [
  ['starline', '1:00 PM', 'Single Digit', '1', 10, 95], ['starline', '1:00 PM', 'Single Digit', '6', 10, 0],
  ['starline', '1:00 PM', 'Single Pana', '137', 10, 1500], ['starline', '1:00 PM', 'Single Pana', '138', 10, 0],
  ['starline', '1:00 PM', 'Double Pana', '112', 10, 0], ['starline', '2:00 PM', 'Triple Pana', '555', 10, 7000],
  ['starline', '2:00 PM', 'Double Pana', '334', 10, 0],
  ['jackpot', '5:00 PM', 'Jodi', '47', 10, 950], ['jackpot', '5:00 PM', 'Jodi', '48', 10, 0],
];
// Slot results: Starline 1:00 PM = pana 137 (digit sum 11 -> single digit 1), 2:00 PM = 555, Jackpot 5:00 PM = jodi 47.
const slotGroups = new Map<string, typeof slotRows>();
for (const r of slotRows) slotGroups.set(`${r[0]}|${r[1]}|${r[2]}`, [...(slotGroups.get(`${r[0]}|${r[1]}|${r[2]}`) ?? []), r]);
let slotSpent = 0;
for (const [, g] of slotGroups) {
  const [kind, slot, game] = g[0];
  const r = await api('POST', '/api/slot-bids', { kind, slot, game, bids: g.map((x) => ({ number: x[3], points: x[4] })) }, user);
  slotSpent += g.reduce((s, x) => s + x[4], 0);
  check(`placed ${kind} ${slot} ${game}`, r.status === 200, JSON.stringify(r.data));
}
check('slot bids took exactly their points from the wallet', (await balance()) === before - slotSpent);
let slotHist = (await api('GET', '/api/slot-bids', undefined, user)).data as any[];
check('slot history has every bid, all pending', slotHist.length === slotRows.length && slotHist.every((b) => b.status === 'pending'));
check('slot history keeps kind, slot, game and number', slotRows.every((r) => slotHist.some((b) => b.kind === r[0] && b.slot === r[1] && b.game === r[2] && b.number === r[3] && b.points === r[4] && b.date === DATE)));
await api('POST', '/api/admin/starline', { date: DATE, slot: '1:00 PM', pana: '137' }, adm);
await api('POST', '/api/admin/starline', { date: DATE, slot: '2:00 PM', pana: '555' }, adm);
await api('POST', '/api/admin/disawar', { date: DATE, slot: '5:00 PM', jodi: '47' }, adm);
slotHist = (await api('GET', '/api/slot-bids', undefined, user)).data as any[];
const slotWon = (r: (typeof slotRows)[number]) => slotHist.find((b) => b.kind === r[0] && b.slot === r[1] && b.game === r[2] && b.number === r[3]);
check('Starline Single Digit, Single Pana, Triple Pana and Jackpot Jodi winners are paid at their rates', slotWon(slotRows[0]).win === 95 && slotWon(slotRows[2]).win === 1500 && slotWon(slotRows[5]).win === 7000 && slotWon(slotRows[7]).win === 950);
check('Starline and Jackpot losers are marked lost', [1, 3, 4, 6, 8].every((i) => slotWon(slotRows[i]).status === 'lost' && slotWon(slotRows[i]).win === 0));
const slotWins = slotHist.reduce((s, b) => s + b.win, 0);
check('wallet after the slot results = before - slot points + slot winnings', (await balance()) === before - slotSpent + slotWins, `${await balance()} vs ${before - slotSpent + slotWins}`);
pass = (await api('GET', '/api/passbook', undefined, user)).data as any[];
check('Passbook records the slot debits and wins', pass.some((t) => /^Bid: Starline 1:00 PM/.test(t.remark)) && pass.some((t) => /^Win: Starline 1:00 PM/.test(t.remark)) && pass.some((t) => /^Win: Jackpot 5:00 PM/.test(t.remark)));
const chartStar = (await api('GET', '/api/charts/starline?from=2026-11-01&to=2026-11-30')).data as any[];
const chartJack = (await api('GET', '/api/charts/disawar?from=2026-11-01&to=2026-11-30')).data as any[];
check('Starline chart stores both slots', chartStar.length === 2 && chartStar.some((c) => c.slot === '1:00 PM' && c.pana === '137') && chartStar.some((c) => c.slot === '2:00 PM' && c.pana === '555'));
check('Jackpot chart stores the slot', chartJack.length === 1 && chartJack[0].jodi === '47');
check('admin report shows every slot bid of the day', (await api('GET', `/api/admin/slot-bids?date=${DATE}`, undefined, adm)).data.length === slotRows.length);

// ---------- nothing leaks between users or gets lost ----------
check("the other user still has no bids or slot bids", (await api('GET', '/api/bids', undefined, other)).data.length === 0 && (await api('GET', '/api/slot-bids', undefined, other)).data.length === 0);
const totalRows = ((await api('GET', '/api/bids', undefined, user)).data as any[]).length + ((await api('GET', '/api/slot-bids', undefined, user)).data as any[]).length;
check('no bid was lost or duplicated', totalRows === rows.length + slotRows.length, `${totalRows}/${rows.length + slotRows.length}`);

console.log(fails ? `\n${fails} FAILED` : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
