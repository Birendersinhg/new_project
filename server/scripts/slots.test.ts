// Starline and Jackpot: slot list, bidding rules, settlement and result correction on a fresh in-memory database.
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
const at = (h: number, m = 0) => { clock.now = () => new Date(2026, 10, 19, h, m); };
const DATE = '2026-11-19';
at(9, 0);

const adm = (await api('POST', '/api/admin/login', { email: 'admin@test.com', password: 'secret99' })).data.token;
await api('POST', '/api/auth/otp', { name: 'Ravi', mobile: '9876543210' });
const ticket = (await api('POST', '/api/auth/verify', { mobile: '9876543210', otp: '123456' })).data.ticket;
const user = (await api('POST', '/api/auth/register', { ticket, password: 'pass1234' })).data.token;
const uid = (await api('GET', '/api/admin/users', undefined, adm)).data.find((u: any) => u.mobile === '9876543210').id;
await api('POST', `/api/admin/users/${uid}/wallet`, { amount: 5000, op: 'add' }, adm);
const balance = async () => (await api('GET', '/api/me', undefined, user)).data.balance as number;
const start = await balance();

// ---------- slot list ----------
let r = await api('GET', '/api/slots/starline', undefined, user);
check('starline slots listed with its games', r.status === 200 && r.data.slots.length === 14 && r.data.games.length === 4);
check('all slots open at 9:00', r.data.slots.every((s: any) => s.open && s.result === null));
r = await api('GET', '/api/slots/jackpot', undefined, user);
check('jackpot slots listed (Jodi only)', r.data.slots.length === 15 && r.data.games.join() === 'Jodi');
check('unknown slot type rejected', (await api('GET', '/api/slots/other', undefined, user)).status === 400);
check('slots need login', (await api('GET', '/api/slots/starline')).status === 401);

// ---------- placing bids ----------
const place = (body: object) => api('POST', '/api/slot-bids', body, user);
r = await place({ kind: 'starline', slot: '1:00 PM', game: 'Single Digit', bids: [{ number: '5', points: 10 }] });
check('starline single digit bid placed', r.status === 200 && r.data.total === 10 && r.data.balance === start - 10);
check('invalid number rejected', (await place({ kind: 'starline', slot: '1:00 PM', game: 'Single Pana', bids: [{ number: '112', points: 10 }] })).status === 400);
check('wrong game for jackpot rejected', (await place({ kind: 'jackpot', slot: '5:00 PM', game: 'Single Digit', bids: [{ number: '5', points: 10 }] })).status === 400);
check('unknown slot rejected', (await place({ kind: 'starline', slot: '9:99 PM', game: 'Single Digit', bids: [{ number: '5', points: 10 }] })).status === 400);
check('points below minimum rejected', (await place({ kind: 'starline', slot: '1:00 PM', game: 'Single Digit', bids: [{ number: '5', points: 1 }] })).status === 400);
check('too many points for the wallet rejected', (await place({ kind: 'starline', slot: '1:00 PM', game: 'Single Digit', bids: [{ number: '5', points: 10000 }, { number: '6', points: 10000 }] })).status === 400);
check('failed bids did not touch the balance', (await balance()) === start - 10);
await place({ kind: 'starline', slot: '1:00 PM', game: 'Single Pana', bids: [{ number: '128', points: 20 }] });
await place({ kind: 'starline', slot: '1:00 PM', game: 'Double Pana', bids: [{ number: '112', points: 20 }] });
await place({ kind: 'starline', slot: '1:00 PM', game: 'Triple Pana', bids: [{ number: '111', points: 10 }] });
r = await place({ kind: 'jackpot', slot: '5:00 PM', game: 'Jodi', bids: [{ number: '47', points: 10 }, { number: '48', points: 10 }] });
check('jackpot jodi bids placed', r.status === 200 && r.data.count === 2);
check('single pana typed in any order is accepted', (await place({ kind: 'starline', slot: '2:00 PM', game: 'Single Pana', bids: [{ number: '821', points: 10 }] })).status === 200);

// ---------- time rules ----------
at(13, 0);
r = await place({ kind: 'starline', slot: '1:00 PM', game: 'Single Digit', bids: [{ number: '5', points: 10 }] });
check('bids close when the slot time arrives', r.status === 400, JSON.stringify(r.data));
check('later slot still open', (await place({ kind: 'starline', slot: '2:00 PM', game: 'Single Digit', bids: [{ number: '5', points: 10 }] })).status === 200);
r = await api('GET', '/api/slots/starline', undefined, user);
check('slot list shows closed vs open', r.data.slots.find((s: any) => s.slot === '1:00 PM').open === false && r.data.slots.find((s: any) => s.slot === '2:00 PM').open === true);
at(9, 0);

// ---------- settlement ----------
const afterBids = await balance();
r = await api('POST', '/api/admin/starline', { date: DATE, slot: '1:00 PM', pana: '128' }, adm); // ank 1
check('starline result declared and settled', r.status === 200 && r.data.settled.won === 1 && r.data.settled.lost === 3, JSON.stringify(r.data));
// single digit 5 lost, SP 128 won (20 pts * 1500 / 10 = 3000), DP 112 lost, TP 111 lost
check('single pana winner paid at the starline rate', (await balance()) === afterBids + 3000);
let mine = (await api('GET', '/api/slot-bids', undefined, user)).data as any[];
check('history has every bid with its status', mine.length >= 8 && mine.some((b) => b.game === 'Single Pana' && b.number === '128' && b.status === 'won' && b.win === 3000));
check('losing bids marked lost', mine.filter((b) => b.slot === '1:00 PM' && b.status === 'lost').length === 3);
check('bids of other slots stay pending', mine.filter((b) => b.slot !== '1:00 PM').every((b) => b.status === 'pending'));

// Correct the result: pana 110 (ank 2): the 128 win is taken back, nothing else changes.
await api('POST', '/api/admin/starline', { date: DATE, slot: '1:00 PM', pana: '110' }, adm);
check('re-declaring corrects payouts', (await balance()) === afterBids, `${await balance()} vs ${afterBids}`);
// Pana 555 (a triple, ank 5): the Single Digit 5 bid wins 10 * 95 / 10 = 95.
await api('POST', '/api/admin/starline', { date: DATE, slot: '1:00 PM', pana: '555' }, adm);
mine = (await api('GET', '/api/slot-bids', undefined, user)).data as any[];
check('single digit wins on the pana digit sum', mine.some((b) => b.game === 'Single Digit' && b.number === '5' && b.slot === '1:00 PM' && b.status === 'won' && b.win === 95), JSON.stringify(mine.filter((b) => b.slot === '1:00 PM')));
r = await api('DELETE', `/api/admin/starline?date=${DATE}&slot=${encodeURIComponent('1:00 PM')}`, undefined, adm);
check('deleting a result takes the winnings back', (await balance()) === afterBids, `${await balance()} vs ${afterBids}`);
mine = (await api('GET', '/api/slot-bids', undefined, user)).data as any[];
check('bids return to pending after delete', mine.filter((b) => b.slot === '1:00 PM').every((b) => b.status === 'pending'));

// Jackpot: jodi 47 wins 10 * 950 / 10 = 950
const beforeJackpot = await balance();
r = await api('POST', '/api/admin/disawar', { date: DATE, slot: '5:00 PM', jodi: '47' }, adm);
check('jackpot result settled', r.status === 200 && r.data.settled.won === 1 && r.data.settled.lost === 1, JSON.stringify(r.data));
check('jackpot jodi winner paid', (await balance()) === beforeJackpot + 950);
await api('POST', '/api/admin/disawar', { date: DATE, slot: '5:00 PM', jodi: '47' }, adm);
check('declaring the same result again pays nothing extra', (await balance()) === beforeJackpot + 950);

// ---------- rates ----------
r = await api('GET', '/api/settings');
check('settings expose the slot rates', r.data.slotRates?.starSp === 1500 && r.data.slotRates?.jackpotJodi === 950);
r = await api('PUT', '/api/admin/settings', { slotRates: { starSingle: 90, starSp: 1400, starDp: 2800, starTp: 6000, jackpotJodi: 900 } }, adm);
check('admin can change slot rates', r.status === 200 && (await api('GET', '/api/settings')).data.slotRates.jackpotJodi === 900);
check('bad slot rate rejected', (await api('PUT', '/api/admin/settings', { slotRates: { starSingle: 0, starSp: 1, starDp: 1, starTp: 1, jackpotJodi: 1 } }, adm)).status === 400);

// ---------- admin: list and revert slot bids ----------
const beforeRevert = await balance();
await place({ kind: 'starline', slot: '3:00 PM', game: 'Single Digit', bids: [{ number: '1', points: 10 }, { number: '2', points: 30 }] });
r = await api('GET', `/api/admin/slot-bids?date=${DATE}&kind=starline&slot=${encodeURIComponent('3:00 PM')}`, undefined, adm);
check('admin sees the slot bids with the user', r.status === 200 && r.data.length === 2 && r.data[0].mobile === '9876543210' && r.data[0].market === 'Starline 3:00 PM', JSON.stringify(r.data));
check('slot bid list needs admin', (await api('GET', `/api/admin/slot-bids?date=${DATE}&kind=starline&slot=x`, undefined, user)).status === 401);
const firstId = r.data.find((b: any) => b.number === '1').id;
r = await api('POST', '/api/admin/bids/revert', { kind: 'starline', slot: '3:00 PM', date: DATE, ids: [firstId] }, adm);
check('selected slot bid reverted and refunded', r.status === 200 && r.data.reverted === 1 && r.data.points === 10 && (await balance()) === beforeRevert - 30, JSON.stringify(r.data));
r = await api('POST', '/api/admin/bids/revert', { kind: 'starline', slot: '3:00 PM', date: DATE, ids: [firstId] }, adm);
check('a reverted bid cannot be reverted twice', r.status === 400);
await api('POST', '/api/admin/starline', { date: DATE, slot: '3:00 PM', pana: '128' }, adm); // ank 1, bid on 2 loses
r = await api('POST', '/api/admin/bids/revert', { kind: 'starline', slot: '3:00 PM', date: DATE }, adm);
check('bids that already lost cannot be reverted', r.status === 400);
await api('DELETE', `/api/admin/starline?date=${DATE}&slot=${encodeURIComponent('3:00 PM')}`, undefined, adm);
r = await api('POST', '/api/admin/bids/revert', { kind: 'starline', slot: '3:00 PM', date: DATE }, adm);
check('revert all pending after the result is deleted', r.status === 200 && r.data.reverted === 1 && (await balance()) === beforeRevert, JSON.stringify(r.data));
const rows = (await api('GET', '/api/slot-bids', undefined, user)).data as any[];
check('reverted bids show as reverted in the user history', rows.filter((b) => b.slot === '3:00 PM' && b.status === 'reverted').length === 2);
check('refunds are recorded in the passbook', (await api('GET', '/api/passbook', undefined, user)).data.some((t: any) => /Refund: Starline 3:00 PM/.test(t.remark)));

// ---------- admin bid history report: all slot bids of a day, or one kind ----------
const dayAll = (await api('GET', `/api/admin/slot-bids?date=${DATE}`, undefined, adm)).data as any[];
const dayStar = (await api('GET', `/api/admin/slot-bids?date=${DATE}&kind=starline`, undefined, adm)).data as any[];
const dayJack = (await api('GET', `/api/admin/slot-bids?date=${DATE}&kind=jackpot`, undefined, adm)).data as any[];
check('admin report lists every Starline and Jackpot bid of the day', dayAll.length > 0 && dayAll.length === dayStar.length + dayJack.length, `${dayAll.length}/${dayStar.length}/${dayJack.length}`);
check('admin report can show only Starline', dayStar.every((b) => b.market.startsWith('Starline ')) && dayStar.length > 0);
check('admin report can show only Jackpot', dayJack.every((b) => b.market.startsWith('Jackpot ')) && dayJack.length === 2);
check('admin report rejects an unknown game type', (await api('GET', `/api/admin/slot-bids?date=${DATE}&kind=x`, undefined, adm)).status === 400);
const mineStar = (await api('GET', '/api/slot-bids', undefined, user)).data as any[];
check("the user's own history separates Starline from Jackpot", mineStar.filter((b) => b.kind === 'starline').length === dayStar.length && mineStar.filter((b) => b.kind === 'jackpot').length === dayJack.length);

// ---------- charts: every declared result is stored per day and shows right away ----------
const from = '2026-11-01', to = '2026-11-30';
const markets = (await api('GET', '/api/markets')).data as any[];
const kalyan = markets.find((m) => m.name === 'Kalyan');
await api('POST', '/api/admin/results', { marketId: kalyan.id, date: DATE, session: 'open', pana: '128' }, adm);
let chart = (await api('GET', `/api/charts/market/${kalyan.id}?from=${from}&to=${to}`)).data as any[];
check('market chart shows the open result as soon as it is declared', chart.length === 1 && chart[0].date === DATE && chart[0].open === '128' && chart[0].close === null);
await api('POST', '/api/admin/results', { marketId: kalyan.id, date: DATE, session: 'close', pana: '235' }, adm);
await api('POST', '/api/admin/results', { marketId: kalyan.id, date: '2026-11-18', session: 'open', pana: '123' }, adm);
chart = (await api('GET', `/api/charts/market/${kalyan.id}?from=${from}&to=${to}`)).data as any[];
check('market chart keeps every day', chart.length === 2 && chart.find((c) => c.date === DATE).close === '235');
await api('POST', '/api/admin/starline', { date: DATE, slot: '4:00 PM', pana: '246' }, adm);
await api('POST', '/api/admin/starline', { date: '2026-11-18', slot: '10:00 AM', pana: '137' }, adm);
chart = (await api('GET', `/api/charts/starline?from=${from}&to=${to}`)).data as any[];
check('starline chart stores each day and slot', chart.some((c) => c.date === DATE && c.slot === '4:00 PM' && c.pana === '246') && chart.some((c) => c.date === '2026-11-18' && c.slot === '10:00 AM'));
await api('POST', '/api/admin/disawar', { date: DATE, slot: '5:30 PM', jodi: '58' }, adm);
chart = (await api('GET', `/api/charts/disawar?from=${from}&to=${to}`)).data as any[];
check('jackpot (disawar) chart stores each result', chart.some((c) => c.slot === '5:30 PM' && c.jodi === '58') && chart.some((c) => c.slot === '5:00 PM' && c.jodi === '47'));
await api('POST', '/api/admin/starline', { date: DATE, slot: '4:00 PM', pana: '255' }, adm);
chart = (await api('GET', `/api/charts/starline?from=${from}&to=${to}`)).data as any[];
check('correcting a result updates the chart', chart.filter((c) => c.slot === '4:00 PM').length === 1 && chart.find((c) => c.slot === '4:00 PM').pana === '255');

// ---------- blocked users ----------
await api('PATCH', `/api/admin/users/${uid}`, { betting: false }, adm);
check('betting-blocked user cannot bid on slots', (await place({ kind: 'jackpot', slot: '6:30 PM', game: 'Jodi', bids: [{ number: '12', points: 10 }] })).status === 403);

console.log(fails ? `\n${fails} FAILED` : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
