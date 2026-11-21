// Endpoints used by the user app.
import { checkPassword, hashPassword, newToken } from './auth.ts';
import { changeBalance, db, getSetting, tx } from './db.ts';
import { OPEN_ONLY, canonicalNumber, gameKind, getRates } from './game.ts';
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
  if (!user.active) throw new HttpError(403, 'Your account is inactive. Please contact support.');
  loginOk(`u:${mobile}`);
  return { token: startSession('user', user.id) };
});

route('POST', '/api/auth/logout', ({ req }) => {
  const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
});

// ---------- user data ----------
function activeUser(ctx: Parameters<typeof requireAuth>[0]) {
  const id = requireAuth(ctx, 'user');
  const user = db.prepare('SELECT id, name, mobile, balance, active, betting FROM users WHERE id = ?').get(id) as
    { id: number; name: string; mobile: string; balance: number; active: number; betting: number } | undefined;
  if (!user || !user.active) throw new HttpError(401, 'Your account is inactive. Please contact support.');
  return user;
}

route('GET', '/api/me', (ctx) => {
  const u = activeUser(ctx);
  return { id: u.id, name: u.name, mobile: u.mobile, balance: u.balance, betting: !!u.betting };
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
  howToPlay: getSetting('how_to_play'),
  notice: getSetting('notice_board'),
  sliders: (JSON.parse(getSetting('sliders')) as { url: string; order: number }[]).map((s) => s.url),
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
  return db.prepare(`SELECT b.id, b.date, m.name AS market, b.game, b.session, b.number, b.points, b.status, b.win_amount AS win
    FROM bids b JOIN markets m ON m.id = b.market_id WHERE b.user_id = ? ORDER BY b.id DESC LIMIT 300`).all(user.id);
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
