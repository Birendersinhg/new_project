// Endpoints used by the user app.
import { cleanVpa, isValidVpa, payeeMobile } from '../../app/src/upi.ts';
import { checkPassword, hashPassword, newToken } from './auth.ts';
import { changeBalance, db, getSetting, tx } from './db.ts';
import { OPEN_ONLY, SLOT_GAMES, canonicalNumber, gameKind, getRates, getSlotRates, slotMinutes, slotsOf, type SlotKind } from './game.ts';
import { HttpError, int, mobileOf, requireAuth, route, str } from './http.ts';
import { DEMO_OTP, OtpError, otpProvider } from './otp.ts';
import { clock, isValidDate, isoDate, minutesOf, nowMinutes, to12h } from './time.ts';

const DAY = 86_400_000;
const SESSION_DAYS = 30;
const OTP_VALID_MS = 10 * 60_000;
const OTP_RESEND_MS = 30_000;
const OTP_SENDS_PER_IP_HOUR = 10;

// Protects the SMS credits: max 10 OTPs per hour from one IP address.
const otpSends = new Map<string, number[]>();
function guardOtpIp(ip: string) {
  const recent = (otpSends.get(ip) ?? []).filter((t) => t > Date.now() - 3_600_000);
  if (recent.length >= OTP_SENDS_PER_IP_HOUR) throw new HttpError(429, 'Too many OTP requests. Please try again later.');
  otpSends.set(ip, [...recent, Date.now()]);
}

const otpFail = (err: unknown): never => {
  if (err instanceof OtpError) throw new HttpError(err.status, err.message);
  throw err;
};

const startSession = (kind: 'user' | 'admin', id: number) => {
  const token = newToken();
  db.prepare('INSERT INTO sessions (token, kind, subject_id, expires_at) VALUES (?, ?, ?, ?)').run(token, kind, id, Date.now() + SESSION_DAYS * DAY);
  if (kind === 'user') db.prepare('INSERT INTO login_log (user_id) VALUES (?)').run(id);
  return token;
};
export { startSession };

// Simple brute-force guard: 5 wrong passwords per mobile/email locks login for 15 minutes.
const failures = new Map<string, { n: number; until: number }>();
export function guardLogin(key: string) {
  const f = failures.get(key);
  if (f && f.n >= 5 && f.until > Date.now()) throw new HttpError(429, 'Too many wrong attempts. Try again in 15 minutes.');
}
export function loginFailed(key: string) {
  const f = failures.get(key);
  const n = f && f.until > Date.now() ? f.n + 1 : 1;
  failures.set(key, { n, until: Date.now() + 15 * 60_000 });
}
export const loginOk = (key: string) => failures.delete(key);

// ---------- registration: name + mobile -> OTP -> password ----------
// `otps.code` holds the provider's reference: the code itself in test mode, the verification id for real SMS.
route('POST', '/api/auth/otp', async ({ body, req }) => {
  const name = str(body.name, 'Name', 60);
  if (name.length < 2) throw new HttpError(400, 'Please enter your name');
  const mobile = mobileOf(body.mobile);
  if (db.prepare('SELECT 1 FROM users WHERE mobile = ?').get(mobile)) throw new HttpError(409, 'This number is already registered. Please login.');
  const last = db.prepare('SELECT expires_at FROM otps WHERE mobile = ?').get(mobile) as { expires_at: number } | undefined;
  if (last && last.expires_at - OTP_VALID_MS > Date.now() - OTP_RESEND_MS) {
    throw new HttpError(429, 'An OTP was just sent. Please wait 30 seconds before requesting again.');
  }
  if (!otpProvider.demo) guardOtpIp(req.socket.remoteAddress ?? '');
  const ref = await otpProvider.send(mobile).catch(otpFail);
  db.prepare('INSERT OR REPLACE INTO otps (mobile, name, code, ticket, attempts, expires_at) VALUES (?, ?, ?, NULL, 0, ?)')
    .run(mobile, name, ref, Date.now() + OTP_VALID_MS);
  return otpProvider.demo ? { ok: true, demoOtp: DEMO_OTP } : { ok: true };
});

route('POST', '/api/auth/verify', async ({ body }) => {
  const mobile = mobileOf(body.mobile);
  const otp = db.prepare('SELECT code, attempts, expires_at FROM otps WHERE mobile = ?').get(mobile) as { code: string; attempts: number; expires_at: number } | undefined;
  if (!otp || otp.expires_at < Date.now()) throw new HttpError(400, 'OTP expired. Please request a new one.');
  if (otp.attempts >= 5) throw new HttpError(429, 'Too many wrong attempts. Please request a new OTP.');
  const entered = String(body.otp ?? '');
  if (!/^\d{4,8}$/.test(entered) || !(await otpProvider.verify(mobile, entered, otp.code).catch(otpFail))) {
    db.prepare('UPDATE otps SET attempts = attempts + 1 WHERE mobile = ?').run(mobile);
    throw new HttpError(400, 'Wrong OTP. Please try again.');
  }
  const ticket = newToken();
  db.prepare('UPDATE otps SET ticket = ? WHERE mobile = ?').run(ticket, mobile);
  return { ticket };
});

route('POST', '/api/auth/register', ({ body }) => {
  const ticket = str(body.ticket, 'Ticket', 100);
  const password = str(body.password, 'Password', 100);
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
  return tx(() => {
    const otp = db.prepare('SELECT mobile, name, expires_at FROM otps WHERE ticket = ?').get(ticket) as { mobile: string; name: string; expires_at: number } | undefined;
    if (!otp || otp.expires_at < Date.now()) throw new HttpError(400, 'Verification expired. Please register again.');
    if (db.prepare('SELECT 1 FROM users WHERE mobile = ?').get(otp.mobile)) throw new HttpError(409, 'This number is already registered. Please login.');
    const { id } = db.prepare('INSERT INTO users (name, mobile, pass_hash) VALUES (?, ?, ?) RETURNING id')
      .get(otp.name, otp.mobile, hashPassword(password)) as { id: number };
    db.prepare('DELETE FROM otps WHERE mobile = ?').run(otp.mobile);
    const bonus = Number(getSetting('welcome_bonus')) || 0;
    if (bonus > 0) changeBalance(id, bonus, 'Welcome bonus');
    return { token: startSession('user', id) };
  });
});

route('POST', '/api/auth/login', ({ body }) => {
  const mobile = mobileOf(body.mobile);
  const password = str(body.password, 'Password', 100);
  guardLogin(`u:${mobile}`);
  const user = db.prepare('SELECT id, pass_hash, active FROM users WHERE mobile = ?').get(mobile) as { id: number; pass_hash: string; active: number } | undefined;
  if (!user || !checkPassword(password, user.pass_hash)) {
    loginFailed(`u:${mobile}`);
    throw new HttpError(401, 'Incorrect mobile number or password');
  }
  // Inactive accounts are not blocked: the app shows them the quiz instead of the games.
  loginOk(`u:${mobile}`);
  return { token: startSession('user', user.id) };
});

route('POST', '/api/auth/logout', ({ req }) => {
  const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
});

// ---------- user data ----------
/** Signed-in user, including inactive ones (they are routed to the quiz app, not logged out). */
function sessionUser(ctx: Parameters<typeof requireAuth>[0]) {
  const id = requireAuth(ctx, 'user');
  const user = db.prepare('SELECT id, name, mobile, balance, active, betting FROM users WHERE id = ?').get(id) as
    { id: number; name: string; mobile: string; balance: number; active: number; betting: number } | undefined;
  if (!user) throw new HttpError(401, 'Please login again');
  return user;
}

/** Inactive users only get the quiz app; gaming actions stay blocked for them. */
function activeUser(ctx: Parameters<typeof requireAuth>[0]) {
  const user = sessionUser(ctx);
  if (!user.active) throw new HttpError(401, 'Your account is inactive. Please contact support.');
  return user;
}

route('GET', '/api/me', (ctx) => {
  const u = sessionUser(ctx);
  return {
    id: u.id, name: u.name, mobile: u.mobile, balance: u.balance, betting: !!u.betting, active: !!u.active,
    // Global Quiz App Mode applies to everyone; an inactive account gets the quiz on its own.
    mode: !u.active || getSetting('app_mode') === 'quiz' ? 'quiz' : 'gaming',
  };
});

// Includes today's declared result, so the home cards show it as soon as the admin declares it.
route('GET', '/api/markets', () => {
  const rows = db.prepare(`SELECT m.id, m.name, m.open_time, m.close_time, r.open_pana, r.close_pana
    FROM markets m LEFT JOIN results r ON r.market_id = m.id AND r.date = ?
    WHERE m.active = 1 ORDER BY m.open_time, m.close_time, m.name`).all(isoDate(clock.now())) as
    { id: number; name: string; open_time: string; close_time: string; open_pana: string | null; close_pana: string | null }[];
  return rows.map((m) => ({
    id: m.id, name: m.name, open: to12h(m.open_time), close: to12h(m.close_time),
    openPana: m.open_pana, closePana: m.close_pana,
  }));
});

route('GET', '/api/settings', () => ({
  ticker: getSetting('ticker'),
  phone: getSetting('contact_phone'),
  whatsapp: getSetting('whatsapp'),
  minBid: Number(getSetting('min_bid')),
  maxBid: Number(getSetting('max_bid')),
  rates: getRates(),
  slotRates: getSlotRates(),
  howToPlay: getSetting('how_to_play'),
  notice: getSetting('notice_board'),
  texts: {
    home: getSetting('text_home'), rates: getSetting('text_rates'), timetable: getSetting('text_timetable'),
    support: getSetting('text_support'), game: getSetting('text_game'),
  },
  sliders: (JSON.parse(getSetting('sliders')) as { url: string; order: number }[]).map((s) => s.url),
  mode: getSetting('app_mode') === 'quiz' ? 'quiz' : 'gaming',
  quizTimer: Number(getSetting('quiz_timer')) || 20,
  upi: publicUpi(),
  trust: publicTrust(),
}));

// ---------- bids ----------
route('POST', '/api/bids', (ctx) => {
  const user = activeUser(ctx);
  if (!user.betting) throw new HttpError(403, 'Bidding is blocked for your account. Please contact support.');
  const { body } = ctx;
  const marketId = int(body.marketId, 'Market');
  const game = str(body.game, 'Game', 40);
  let kind;
  try { kind = gameKind(game); } catch { throw new HttpError(400, 'Unknown game'); }
  const list = Array.isArray(body.bids) ? body.bids as { number?: unknown; points?: unknown }[] : [];
  if (!list.length || list.length > 500) throw new HttpError(400, 'Add at least one bid');

  const market = db.prepare('SELECT id, name, open_time, close_time, active FROM markets WHERE id = ?').get(marketId) as
    { id: number; name: string; open_time: string; close_time: string; active: number } | undefined;
  if (!market || !market.active) throw new HttpError(404, 'Market not found');

  // Time rules are checked on the server clock, never trusted from the app.
  const now = nowMinutes();
  const openPassed = now >= minutesOf(market.open_time);
  if (now >= minutesOf(market.close_time)) throw new HttpError(400, 'Market is Closed for today. Please come next day to play.');
  const usesSession = !OPEN_ONLY.includes(kind);
  if (!usesSession && openPassed) throw new HttpError(400, `${game} closes at the market's open time.`);
  const session = usesSession ? body.session : null;
  if (usesSession && session !== 'Open' && session !== 'Close') throw new HttpError(400, 'Select Open or Close session');
  if (session === 'Open' && openPassed) throw new HttpError(400, 'Open session is closed. Select Close.');

  const min = Number(getSetting('min_bid')), max = Number(getSetting('max_bid'));
  const clean = list.map((b) => {
    const number = canonicalNumber(kind, String(b.number ?? ''));
    if (!number) throw new HttpError(400, `${String(b.number)} is not valid for ${game}`);
    const points = int(b.points, 'Points');
    if (points < min || points > max) throw new HttpError(400, `Points must be between ${min} and ${max}`);
    return { number, points };
  });
  const total = clean.reduce((s, b) => s + b.points, 0);
  const date = isoDate(clock.now());

  return tx(() => {
    let balance;
    try {
      balance = changeBalance(user.id, -total, `Bid: ${market.name} ${game} (${clean.length})`);
    } catch {
      throw new HttpError(400, 'Insufficient balance');
    }
    const insert = db.prepare('INSERT INTO bids (user_id, market_id, date, game, session, number, points) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const b of clean) insert.run(user.id, market.id, date, game, session as string | null, b.number, b.points);
    return { balance, count: clean.length, total };
  });
});

route('GET', '/api/bids', (ctx) => {
  const user = activeUser(ctx);
  return db.prepare(`SELECT b.id, b.date, b.created_at AS at, m.name AS market, b.game, b.session, b.number, b.points, b.status, b.win_amount AS win
    FROM bids b JOIN markets m ON m.id = b.market_id WHERE b.user_id = ? ORDER BY b.id DESC LIMIT 300`).all(user.id);
});

// ---------- Starline and Jackpot (time-slot games) ----------
const slotKind = (v: unknown): SlotKind => {
  if (v !== 'starline' && v !== 'jackpot') throw new HttpError(400, 'Unknown game type');
  return v;
};

/** Today's slots with their result (if declared) and whether bids are still open, on the server clock. */
route('GET', '/api/slots/:kind', (ctx) => {
  activeUser(ctx);
  const kind = slotKind(ctx.params.kind);
  const date = isoDate(clock.now());
  const table = kind === 'starline' ? 'starline_results' : 'disawar_results';
  const col = kind === 'starline' ? 'pana' : 'jodi';
  const done = new Map((db.prepare(`SELECT slot, ${col} AS value FROM ${table} WHERE date = ?`).all(date) as { slot: string; value: string }[]).map((r) => [r.slot, r.value]));
  const now = nowMinutes();
  return {
    games: SLOT_GAMES[kind],
    slots: slotsOf(kind).map((slot) => ({ slot, open: now < slotMinutes(slot), result: done.get(slot) ?? null })),
  };
});

route('POST', '/api/slot-bids', (ctx) => {
  const user = activeUser(ctx);
  if (!user.betting) throw new HttpError(403, 'Bidding is blocked for your account. Please contact support.');
  const { body } = ctx;
  const kind = slotKind(body.kind);
  const slot = str(body.slot, 'Time', 20);
  if (!slotsOf(kind).includes(slot)) throw new HttpError(400, 'Select a valid time');
  const game = str(body.game, 'Game', 40);
  if (!SLOT_GAMES[kind].includes(game)) throw new HttpError(400, 'Unknown game');
  if (nowMinutes() >= slotMinutes(slot)) throw new HttpError(400, `${slot} is closed. Please pick a later time.`);
  const list = Array.isArray(body.bids) ? body.bids as { number?: unknown; points?: unknown }[] : [];
  if (!list.length || list.length > 500) throw new HttpError(400, 'Add at least one bid');

  const min = Number(getSetting('min_bid')), max = Number(getSetting('max_bid'));
  const clean = list.map((b) => {
    const number = canonicalNumber(gameKind(game), String(b.number ?? ''));
    if (!number) throw new HttpError(400, `${String(b.number)} is not valid for ${game}`);
    const points = int(b.points, 'Points');
    if (points < min || points > max) throw new HttpError(400, `Points must be between ${min} and ${max}`);
    return { number, points };
  });
  const total = clean.reduce((s, b) => s + b.points, 0);
  const date = isoDate(clock.now());
  const label = kind === 'starline' ? 'Starline' : 'Jackpot';

  return tx(() => {
    let balance;
    try {
      balance = changeBalance(user.id, -total, `Bid: ${label} ${slot} ${game} (${clean.length})`);
    } catch {
      throw new HttpError(400, 'Insufficient balance');
    }
    const insert = db.prepare('INSERT INTO slot_bids (user_id, kind, date, slot, game, number, points) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const b of clean) insert.run(user.id, kind, date, slot, game, b.number, b.points);
    return { balance, count: clean.length, total };
  });
});

route('GET', '/api/slot-bids', (ctx) => {
  const user = activeUser(ctx);
  return db.prepare(`SELECT id, date, created_at AS at, kind, slot, game, number, points, status, win_amount AS win
    FROM slot_bids WHERE user_id = ? ORDER BY id DESC LIMIT 300`).all(user.id);
});

// ---------- live support chat ----------
const CHAT_MAX = 1000;
const CHAT_BURST = 20; // messages per 5 minutes per user

route('GET', '/api/support/messages', (ctx) => {
  const user = activeUser(ctx);
  db.prepare("UPDATE support_messages SET seen = 1 WHERE user_id = ? AND sender = 'admin' AND seen = 0").run(user.id);
  const rows = db.prepare('SELECT id, sender, text, created_at AS at FROM support_messages WHERE user_id = ? ORDER BY id DESC LIMIT 200').all(user.id);
  return rows.reverse();
});

route('POST', '/api/support/messages', (ctx) => {
  const user = activeUser(ctx);
  const text = str(ctx.body.text, 'Message', CHAT_MAX);
  const recent = (db.prepare("SELECT COUNT(*) AS n FROM support_messages WHERE user_id = ? AND sender = 'user' AND created_at > datetime('now', 'localtime', '-5 minutes')").get(user.id) as { n: number }).n;
  if (recent >= CHAT_BURST) throw new HttpError(429, 'You are sending messages too fast. Please wait a moment.');
  return db.prepare("INSERT INTO support_messages (user_id, sender, text) VALUES (?, 'user', ?) RETURNING id, sender, text, created_at AS at").get(user.id, text);
});

/** Messages written by the admin, newest first. */
route('GET', '/api/notifications', (ctx) => {
  activeUser(ctx);
  return db.prepare('SELECT id, title, message, created_at AS at FROM notifications WHERE active = 1 ORDER BY id DESC LIMIT 100').all();
});

/** Passbook: every change to the user's points, newest first. */
route('GET', '/api/passbook', (ctx) => {
  const user = activeUser(ctx);
  return db.prepare('SELECT id, created_at AS at, amount, balance_after AS balance, remark FROM wallet_tx WHERE user_id = ? ORDER BY id DESC LIMIT 300').all(user.id);
});

// ---------- UPI payments (intent only, no gateway) ----------
// A UPI link opens the customer's payment app; it can never confirm a payment. So a top-up
// is a *claim*: the customer pays, sends the 12-digit UTR, and an admin approves it in the
// dashboard. Only that approval credits the wallet.
const MAX_AMOUNT = 500_000;

/** Payee details the app needs to build the link; sent with /api/settings. */
function publicUpi() {
  return {
    enabled: getSetting('upi_enabled') === '1' && !!getSetting('upi_id'),
    vpa: getSetting('upi_id'),
    mobile: getSetting('pay_mobile') || payeeMobile(getSetting('upi_id')),
    name: getSetting('upi_name') || 'Payment',
    note: getSetting('upi_note'),
    minDeposit: Number(getSetting('min_deposit')) || 1,
    minWithdraw: Number(getSetting('min_withdraw')) || 1,
  };
}

/** Reassurance lines shown under the payment options; the admin edits them from Settings. */
function publicTrust() {
  const items = getSetting('trust_note')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);
  return { title: getSetting('trust_title'), items };
}

/** The customer's own UPI ID or the mobile number they paid from, used to match the UTR. */
function payerOf(v: unknown): string {
  const raw = String(v ?? '').trim();
  if (!raw) throw new HttpError(400, 'Enter the UPI ID or mobile number you paid from');
  const vpa = cleanVpa(raw);
  if (vpa.includes('@')) {
    if (!isValidVpa(vpa)) throw new HttpError(400, 'That UPI ID does not look right. It should look like name@bank');
    return vpa;
  }
  const digits = raw.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  if (!/^[6-9]\d{9}$/.test(digits)) throw new HttpError(400, 'Enter a valid UPI ID (name@bank) or 10-digit mobile number');
  return digits;
}

route('POST', '/api/payments/upi', (ctx) => {
  const user = sessionUser(ctx);
  const upi = publicUpi();
  if (!upi.enabled) throw new HttpError(400, 'UPI payments are not available right now');
  const amount = int(ctx.body.amount, 'Amount');
  if (amount < upi.minDeposit) throw new HttpError(400, `Minimum deposit is ₹${upi.minDeposit}`);
  if (amount > MAX_AMOUNT) throw new HttpError(400, 'That amount is too large. Please contact support.');
  const payer = payerOf(ctx.body.payer);
  const utr = String(ctx.body.utr ?? '').trim();
  if (!/^\d{12}$/.test(utr)) throw new HttpError(400, 'Enter the 12-digit UTR / reference number from your UPI app');
  if (db.prepare('SELECT 1 FROM upi_payments WHERE utr = ?').get(utr)) {
    throw new HttpError(409, 'This UTR has already been submitted. Contact support if you paid twice.');
  }
  const row = db.prepare('INSERT INTO upi_payments (user_id, amount, utr, payer) VALUES (?, ?, ?, ?) RETURNING id')
    .get(user.id, amount, utr, payer) as { id: number };
  return { id: row.id, amount, payer, status: 'pending' };
});

route('GET', '/api/payments/mine', (ctx) => {
  const user = sessionUser(ctx);
  return {
    deposits: db.prepare('SELECT id, amount, utr, payer, status, remark, created_at AS date FROM upi_payments WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(user.id),
    // The full account number is only ever shown to the admin; the app sees the last 4 digits.
    withdrawals: db.prepare(`SELECT id, amount, method, upi, account_name AS accountName,
        CASE WHEN account_no IS NULL THEN NULL ELSE '••••' || substr(account_no, -4) END AS accountNo,
        ifsc, status, remark, created_at AS date
      FROM withdraw_requests WHERE user_id = ? ORDER BY id DESC LIMIT 50`).all(user.id),
  };
});

// Withdrawals hold the points straight away, so the same balance cannot be bid and withdrawn.
route('POST', '/api/withdrawals', (ctx) => {
  const user = sessionUser(ctx);
  const amount = int(ctx.body.amount, 'Amount');
  const min = Number(getSetting('min_withdraw')) || 1;
  if (amount < min) throw new HttpError(400, `Minimum withdrawal is ₹${min}`);
  if (amount > MAX_AMOUNT) throw new HttpError(400, 'That amount is too large. Please contact support.');

  const method = ctx.body.method === 'bank' ? 'bank' : 'upi';
  let upiId: string | null = null;
  let accountName: string | null = null;
  let accountNo: string | null = null;
  let ifsc: string | null = null;
  if (method === 'upi') {
    upiId = cleanVpa(str(ctx.body.upi, 'UPI ID', 100));
    if (!isValidVpa(upiId)) throw new HttpError(400, 'Enter a valid UPI ID like name@bank');
  } else {
    accountName = str(ctx.body.accountName, 'Account holder name', 80);
    accountNo = str(ctx.body.accountNo, 'Account number', 30);
    ifsc = str(ctx.body.ifsc, 'IFSC code', 15).toUpperCase();
    if (!/^\d{6,20}$/.test(accountNo)) throw new HttpError(400, 'Enter a valid account number');
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) throw new HttpError(400, 'Enter a valid IFSC code');
  }

  return tx(() => {
    const row = db.prepare(`INSERT INTO withdraw_requests (user_id, amount, method, upi, account_name, account_no, ifsc)
      VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`)
      .get(user.id, amount, method, upiId, accountName, accountNo, ifsc) as { id: number };
    let balance: number;
    try {
      balance = changeBalance(user.id, -amount, `Withdraw request #${row.id}`);
    } catch {
      throw new HttpError(400, 'You do not have enough balance');
    }
    return { id: row.id, amount, balance, status: 'pending' };
  });
});

// ---------- charts ----------
const range = (q: URLSearchParams) => {
  const from = q.get('from'), to = q.get('to');
  if (!isValidDate(from) || !isValidDate(to)) throw new HttpError(400, 'Invalid date range');
  return [from, to] as const;
};

route('GET', '/api/charts/market/:id', ({ params, query }) => {
  const [from, to] = range(query);
  return db.prepare('SELECT date, open_pana AS open, close_pana AS close FROM results WHERE market_id = ? AND date BETWEEN ? AND ?')
    .all(int(params.id, 'Market'), from, to);
});

route('GET', '/api/charts/starline', ({ query }) => {
  const [from, to] = range(query);
  return db.prepare('SELECT date, slot, pana FROM starline_results WHERE date BETWEEN ? AND ?').all(from, to);
});

route('GET', '/api/charts/disawar', ({ query }) => {
  const [from, to] = range(query);
  return db.prepare('SELECT date, slot, jodi FROM disawar_results WHERE date BETWEEN ? AND ?').all(from, to);
});
