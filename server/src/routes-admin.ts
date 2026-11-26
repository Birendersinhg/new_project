// Endpoints used by the admin dashboard. Every route except login requires an admin session.
import { ankOf, normalizePana, panaKind } from '../../app/src/matka.ts';
import { cleanVpa, isValidVpa } from '../../app/src/upi.ts';
import { checkPassword, hashPassword } from './auth.ts';
import { DEFAULT_SETTINGS, changeBalance, db, getSetting, tx } from './db.ts';
import { JACKPOT_SLOTS, STARLINE_SLOTS, getRates, getSlotRates, settle, settleSlot } from './game.ts';
import { HttpError, int, requireAuth, route, str, type Ctx } from './http.ts';
import { guardLogin, loginFailed, loginOk, startSession } from './routes-app.ts';
import { clock, isValidDate, isValidTime, isoDate } from './time.ts';

const admin = (ctx: Ctx) => requireAuth(ctx, 'admin');

route('POST', '/api/admin/login', ({ body }) => {
  const email = str(body.email, 'Email', 100).toLowerCase();
  const password = str(body.password, 'Password', 100);
  guardLogin(`a:${email}`);
  const row = db.prepare('SELECT id, pass_hash FROM admins WHERE email = ?').get(email) as { id: number; pass_hash: string } | undefined;
  if (!row || !checkPassword(password, row.pass_hash)) {
    loginFailed(`a:${email}`);
    throw new HttpError(401, 'Incorrect email or password');
  }
  loginOk(`a:${email}`);
  return { token: startSession('admin', row.id) };
});

route('GET', '/api/admin/stats', (ctx) => {
  admin(ctx);
  const today = isoDate(clock.now());
  const one = (sql: string, ...p: (string | number)[]) => (db.prepare(sql).get(...p) as { n: number }).n;
  return {
    users: one('SELECT COUNT(*) AS n FROM users'),
    approved: one('SELECT COUNT(*) AS n FROM users WHERE approved = 1'),
    unapproved: one('SELECT COUNT(*) AS n FROM users WHERE approved = 0'),
    games: one('SELECT COUNT(*) AS n FROM markets'),
    bidsToday: one('SELECT COUNT(*) AS n FROM bids WHERE date = ?', today),
    pointsToday: one('SELECT COALESCE(SUM(points), 0) AS n FROM bids WHERE date = ?', today),
    winsToday: one('SELECT COALESCE(SUM(win_amount), 0) AS n FROM bids WHERE date = ?', today),
  };
});

// ---------- users ----------
const USER_COLS = 'id, name, mobile, balance, active, betting, approved, created_at AS date';

route('GET', '/api/admin/users', (ctx) => {
  admin(ctx);
  return db.prepare(`SELECT ${USER_COLS} FROM users ORDER BY id DESC`).all();
});

route('GET', '/api/admin/users/:id', (ctx) => {
  admin(ctx);
  const id = int(ctx.params.id, 'User');
  const user = db.prepare(`SELECT ${USER_COLS} FROM users WHERE id = ?`).get(id);
  if (!user) throw new HttpError(404, 'User not found');
  return {
    user,
    wallet: db.prepare('SELECT created_at AS dt, amount AS amt, balance_after AS bal, remark FROM wallet_tx WHERE user_id = ? ORDER BY id DESC LIMIT 300').all(id),
    bids: db.prepare(`SELECT b.date, m.name AS game, b.game AS type, b.session, b.number AS digit, b.points, b.status, b.win_amount AS win
      FROM bids b JOIN markets m ON m.id = b.market_id WHERE b.user_id = ? ORDER BY b.id DESC LIMIT 300`).all(id),
  };
});

route('PATCH', '/api/admin/users/:id', (ctx) => {
  admin(ctx);
  const id = int(ctx.params.id, 'User');
  for (const key of ['active', 'betting', 'approved'] as const) {
    if (typeof ctx.body[key] === 'boolean') db.prepare(`UPDATE users SET ${key} = ? WHERE id = ?`).run(ctx.body[key] ? 1 : 0, id);
  }
  // Inactive users stay signed in; their app switches to Quiz App Mode instead.
});

route('POST', '/api/admin/users/:id/wallet', (ctx) => {
  admin(ctx);
  const id = int(ctx.params.id, 'User');
  const amount = int(ctx.body.amount, 'Amount');
  if (amount <= 0 || amount > 10_000_000) throw new HttpError(400, 'Enter a valid amount');
  const op = ctx.body.op === 'deduct' ? -1 : 1;
  const remark = typeof ctx.body.remark === 'string' && ctx.body.remark.trim() ? ctx.body.remark.trim().slice(0, 100) : op > 0 ? 'Added by admin' : 'Deducted by admin';
  return tx(() => {
    try {
      return { balance: changeBalance(id, op * amount, remark) };
    } catch {
      throw new HttpError(400, 'User does not have enough balance to deduct this amount');
    }
  });
});

route('POST', '/api/admin/users/:id/password', (ctx) => {
  admin(ctx);
  const id = int(ctx.params.id, 'User');
  const password = str(ctx.body.password, 'Password', 100);
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
  db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(hashPassword(password), id);
  db.prepare("DELETE FROM sessions WHERE kind = 'user' AND subject_id = ?").run(id);
});

// ---------- markets (Game Name) ----------
route('GET', '/api/admin/markets', (ctx) => {
  admin(ctx);
  return db.prepare('SELECT id, name, open_time AS open, close_time AS close, active FROM markets ORDER BY open_time, close_time, name').all();
});

function marketInput(body: Record<string, unknown>) {
  const name = str(body.name, 'Game name', 40);
  const open = body.open, close = body.close;
  if (!isValidTime(open) || !isValidTime(close)) throw new HttpError(400, 'Enter valid open and close times');
  if (close <= open) throw new HttpError(400, 'Close time must be after open time');
  return { name, open, close, active: body.active === false ? 0 : 1 };
}

route('POST', '/api/admin/markets', (ctx) => {
  admin(ctx);
  const m = marketInput(ctx.body);
  try {
    return db.prepare('INSERT INTO markets (name, open_time, close_time, active) VALUES (?, ?, ?, ?) RETURNING id').get(m.name, m.open, m.close, m.active);
  } catch {
    throw new HttpError(409, 'A game with this name already exists');
  }
});

route('PUT', '/api/admin/markets/:id', (ctx) => {
  admin(ctx);
  const m = marketInput(ctx.body);
  try {
    db.prepare('UPDATE markets SET name = ?, open_time = ?, close_time = ?, active = ? WHERE id = ?').run(m.name, m.open, m.close, m.active, int(ctx.params.id, 'Game'));
  } catch {
    throw new HttpError(409, 'A game with this name already exists');
  }
});

route('DELETE', '/api/admin/markets/:id', (ctx) => {
  admin(ctx);
  const id = int(ctx.params.id, 'Game');
  // Keep history intact: a market that has bids is deactivated instead of deleted.
  if (db.prepare('SELECT 1 FROM bids WHERE market_id = ? LIMIT 1').get(id)) {
    db.prepare('UPDATE markets SET active = 0 WHERE id = ?').run(id);
    return { deactivated: true };
  }
  db.prepare('DELETE FROM markets WHERE id = ?').run(id);
  return { deleted: true };
});

// ---------- results ----------
route('GET', '/api/admin/results', (ctx) => {
  admin(ctx);
  const date = ctx.query.get('date');
  if (!isValidDate(date)) throw new HttpError(400, 'Invalid date');
  const rows = db.prepare(`SELECT r.market_id AS marketId, m.name, r.date, r.open_pana AS open, r.close_pana AS close
    FROM results r JOIN markets m ON m.id = r.market_id WHERE r.date = ? ORDER BY m.open_time`).all(date) as
    { open: string | null; close: string | null }[];
  return rows.map((r) => ({ ...r, openAnk: r.open ? ankOf(r.open) : null, closeAnk: r.close ? ankOf(r.close) : null }));
});

/** Declares or corrects one session's pana, then settles every bid for that market/date. */
route('POST', '/api/admin/results', (ctx) => {
  admin(ctx);
  const marketId = int(ctx.body.marketId, 'Game');
  const date = ctx.body.date;
  if (!isValidDate(date)) throw new HttpError(400, 'Select a valid date');
  if (date > isoDate(clock.now())) throw new HttpError(400, 'Cannot declare a result for a future date');
  const session = ctx.body.session;
  if (session !== 'open' && session !== 'close') throw new HttpError(400, 'Select a session');
  const pana = normalizePana(str(ctx.body.pana, 'Pana', 3));
  if (!pana || !panaKind(pana)) throw new HttpError(400, 'Enter a valid pana');
  if (!db.prepare('SELECT 1 FROM markets WHERE id = ?').get(marketId)) throw new HttpError(404, 'Game not found');

  return tx(() => {
    const existing = db.prepare('SELECT open_pana FROM results WHERE market_id = ? AND date = ?').get(marketId, date) as { open_pana: string | null } | undefined;
    if (session === 'close' && !existing?.open_pana) throw new HttpError(400, 'Declare the Open result first');
    db.prepare(`INSERT INTO results (date, market_id, ${session}_pana) VALUES (?, ?, ?)
      ON CONFLICT (date, market_id) DO UPDATE SET ${session}_pana = excluded.${session}_pana`).run(date, marketId, pana);
    return { pana, ank: ankOf(pana), settled: settle(marketId, date) };
  });
});

/** Deletes a result (or just its close session) and reverses any payouts made from it. */
route('DELETE', '/api/admin/results', (ctx) => {
  admin(ctx);
  const marketId = int(ctx.query.get('marketId'), 'Game');
  const date = ctx.query.get('date');
  if (!isValidDate(date)) throw new HttpError(400, 'Invalid date');
  const closeOnly = ctx.query.get('session') === 'close';
  return tx(() => {
    if (closeOnly) db.prepare('UPDATE results SET close_pana = NULL WHERE market_id = ? AND date = ?').run(marketId, date);
    else db.prepare('DELETE FROM results WHERE market_id = ? AND date = ?').run(marketId, date);
    return { settled: settle(marketId, date) };
  });
});

// ---------- bids report ----------
route('GET', '/api/admin/bids', (ctx) => {
  admin(ctx);
  const date = ctx.query.get('date') ?? isoDate(clock.now());
  if (!isValidDate(date)) throw new HttpError(400, 'Invalid date');
  const marketId = ctx.query.get('marketId');
  return db.prepare(`SELECT b.id, u.name AS user, u.mobile, m.name AS market, b.game, b.session, b.number, b.points, b.status, b.win_amount AS win, b.created_at AS time
    FROM bids b JOIN users u ON u.id = b.user_id JOIN markets m ON m.id = b.market_id
    WHERE b.date = ? ${marketId ? 'AND b.market_id = ?' : ''} ORDER BY b.id DESC LIMIT 1000`)
    .all(...(marketId ? [date, int(marketId, 'Game')] : [date]));
});

// ---------- settings ----------
const EDITABLE = ['ticker', 'contact_phone', 'whatsapp', 'min_bid', 'max_bid', 'welcome_bonus', 'how_to_play', 'notice_board', 'text_home', 'text_rates', 'text_timetable', 'text_support', 'text_game', 'app_mode', 'quiz_timer',
  'pay_mobile', 'upi_id', 'upi_name', 'upi_note', 'upi_enabled', 'min_deposit', 'min_withdraw', 'trust_title', 'trust_note'] as const;
const LONG_TEXT = ['how_to_play', 'notice_board', 'text_home', 'text_rates', 'text_timetable', 'text_support', 'text_game', 'trust_note'];
const MAX_SLIDERS = 10;

route('GET', '/api/admin/settings', (ctx) => {
  admin(ctx);
  return { ...Object.fromEntries(EDITABLE.map((k) => [k, getSetting(k)])), rates: getRates(), slotRates: getSlotRates(), sliders: JSON.parse(getSetting('sliders')) };
});

route('PUT', '/api/admin/settings', (ctx) => {
  admin(ctx);
  const b = ctx.body;
  const set = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value');
  const updates: [string, string][] = [];
  for (const k of EDITABLE) {
    if (b[k] === undefined) continue;
    const v = String(b[k]).trim().slice(0, LONG_TEXT.includes(k) ? 5000 : 300);
    if (['min_bid', 'max_bid', 'welcome_bonus'].includes(k) && !/^\d+$/.test(v)) throw new HttpError(400, `${k.replace('_', ' ')} must be a number`);
    if (k === 'app_mode' && v !== 'gaming' && v !== 'quiz') throw new HttpError(400, 'Mode must be gaming or quiz');
    if (k === 'quiz_timer' && !['20', '25', '30'].includes(v)) throw new HttpError(400, 'Quiz timer must be 20, 25 or 30 seconds');
    if (k === 'upi_enabled' && v !== '0' && v !== '1') throw new HttpError(400, 'UPI status must be on or off');
    if (['min_deposit', 'min_withdraw'].includes(k) && (!/^\d+$/.test(v) || Number(v) < 1)) {
      throw new HttpError(400, `${k === 'min_deposit' ? 'Minimum deposit' : 'Minimum withdrawal'} must be a number of at least 1`);
    }
    if (k === 'pay_mobile') {
      // The app pays a VPA, so a UPI ID that was built from a number follows the new number.
      // A merchant/bank ID pasted by the admin has its own local part and is never rebuilt.
      const digits = v.replace(/\D/g, '');
      if (digits && !/^[6-9]\d{9}$/.test(digits)) throw new HttpError(400, 'Payee mobile number must be a 10-digit Indian number');
      updates.push([k, digits]);
      const [local, handle = ''] = cleanVpa(getSetting('upi_id')).split('@');
      if (digits && handle && /^[6-9]\d{9}$/.test(local) && b.upi_id === undefined) updates.push(['upi_id', `${digits}@${handle}`]);
      continue;
    }
    if (k === 'trust_note' && v.split('\n').filter((line) => line.trim()).length > 5) {
      throw new HttpError(400, 'Up to 5 trust and security messages (one per line)');
    }
    if (k === 'upi_id') {
      // Stored without spaces/invisible characters; a saved ID is what the app puts in the links.
      const id = cleanVpa(v);
      if (id && !isValidVpa(id)) throw new HttpError(400, 'UPI ID must look like name@bank, e.g. shop@okhdfc');
      updates.push([k, id]);
      continue;
    }
    updates.push([k, v]);
  }
  const min = Number(updates.find(([k]) => k === 'min_bid')?.[1] ?? getSetting('min_bid'));
  const max = Number(updates.find(([k]) => k === 'max_bid')?.[1] ?? getSetting('max_bid'));
  if (min < 1 || max < min) throw new HttpError(400, 'Maximum bid must be at least the minimum bid (and minimum at least 1)');
  if (b.rates !== undefined) {
    const rates = b.rates as Record<string, unknown>;
    const current = JSON.parse(DEFAULT_SETTINGS.rates) as Record<string, number>;
    const next: Record<string, number> = {};
    for (const key of Object.keys(current)) {
      const n = Number(rates?.[key]);
      if (!Number.isInteger(n) || n < 1) throw new HttpError(400, `Rate for ${key} must be a whole number`);
      next[key] = n;
    }
    updates.push(['rates', JSON.stringify(next)]);
  }
  if (b.slotRates !== undefined) {
    const input = b.slotRates as Record<string, unknown>;
    const next: Record<string, number> = {};
    for (const key of Object.keys(getSlotRates())) {
      const n = Number(input?.[key]);
      if (!Number.isInteger(n) || n < 1) throw new HttpError(400, `Rate for ${key} must be a whole number`);
      next[key] = n;
    }
    updates.push(['slot_rates', JSON.stringify(next)]);
  }
  if (b.sliders !== undefined) {
    if (!Array.isArray(b.sliders) || b.sliders.length > MAX_SLIDERS) throw new HttpError(400, `Up to ${MAX_SLIDERS} slider images`);
    const list = (b.sliders as { url?: unknown; order?: unknown }[]).map((s) => {
      const url = String(s.url ?? '').trim();
      if (!/^https?:\/\/\S+$/i.test(url) || url.length > 500) throw new HttpError(400, 'Each slider image needs a valid http(s) image link');
      return { url, order: Number.isInteger(Number(s.order)) ? Number(s.order) : 1 };
    }).sort((x, y) => x.order - y.order);
    updates.push(['sliders', JSON.stringify(list)]);
  }
  tx(() => { for (const [k, v] of updates) set.run(k, v); });
});

// ---------- notifications (written by the admin, shown in the app) ----------
function notificationInput(body: Record<string, unknown>) {
  return { title: str(body.title, 'Title', 100), message: String(body.message ?? '').trim().slice(0, 1000), active: body.active === false ? 0 : 1 };
}

route('GET', '/api/admin/notifications', (ctx) => {
  admin(ctx);
  return db.prepare('SELECT id, title, message, active, created_at AS at FROM notifications ORDER BY id DESC').all();
});

route('POST', '/api/admin/notifications', (ctx) => {
  admin(ctx);
  const n = notificationInput(ctx.body);
  return db.prepare('INSERT INTO notifications (title, message, active) VALUES (?, ?, ?) RETURNING id').get(n.title, n.message, n.active);
});

route('PUT', '/api/admin/notifications/:id', (ctx) => {
  admin(ctx);
  const n = notificationInput(ctx.body);
  db.prepare('UPDATE notifications SET title = ?, message = ?, active = ? WHERE id = ?').run(n.title, n.message, n.active, int(ctx.params.id, 'Notification'));
});

route('DELETE', '/api/admin/notifications/:id', (ctx) => {
  admin(ctx);
  db.prepare('DELETE FROM notifications WHERE id = ?').run(int(ctx.params.id, 'Notification'));
});

// ---------- starline / disawar results (one per date + time slot) ----------
const DISAWAR_SLOTS = JACKPOT_SLOTS;

function slotInput(body: Record<string, unknown>, slots: string[]) {
  const date = body.date;
  if (!isValidDate(date)) throw new HttpError(400, 'Select a valid date');
  if (date > isoDate(clock.now())) throw new HttpError(400, 'Cannot declare a result for a future date');
  const slot = String(body.slot ?? '');
  if (!slots.includes(slot)) throw new HttpError(400, 'Select a valid time');
  return { date, slot };
}

route('GET', '/api/admin/starline', (ctx) => {
  admin(ctx);
  const date = ctx.query.get('date');
  if (!isValidDate(date)) throw new HttpError(400, 'Invalid date');
  return { slots: STARLINE_SLOTS, results: db.prepare('SELECT slot, pana FROM starline_results WHERE date = ?').all(date) };
});

route('POST', '/api/admin/starline', (ctx) => {
  admin(ctx);
  const { date, slot } = slotInput(ctx.body, STARLINE_SLOTS);
  const pana = normalizePana(str(ctx.body.pana, 'Pana', 3));
  if (!pana || !panaKind(pana)) throw new HttpError(400, 'Enter a valid pana');
  return tx(() => {
    db.prepare('INSERT INTO starline_results (date, slot, pana) VALUES (?, ?, ?) ON CONFLICT (date, slot) DO UPDATE SET pana = excluded.pana').run(date, slot, pana);
    return { pana, ank: ankOf(pana), settled: settleSlot('starline', date, slot) };
  });
});

route('DELETE', '/api/admin/starline', (ctx) => {
  admin(ctx);
  const date = ctx.query.get('date'), slot = ctx.query.get('slot');
  if (!isValidDate(date) || !STARLINE_SLOTS.includes(String(slot))) throw new HttpError(400, 'Invalid date or time');
  tx(() => {
    db.prepare('DELETE FROM starline_results WHERE date = ? AND slot = ?').run(date, slot);
    settleSlot('starline', date, String(slot));
  });
});

route('GET', '/api/admin/disawar', (ctx) => {
  admin(ctx);
  const date = ctx.query.get('date');
  if (!isValidDate(date)) throw new HttpError(400, 'Invalid date');
  return { slots: DISAWAR_SLOTS, results: db.prepare('SELECT slot, jodi FROM disawar_results WHERE date = ?').all(date) };
});

route('POST', '/api/admin/disawar', (ctx) => {
  admin(ctx);
  const { date, slot } = slotInput(ctx.body, DISAWAR_SLOTS);
  const jodi = String(ctx.body.jodi ?? '').trim();
  if (!/^\d{2}$/.test(jodi)) throw new HttpError(400, 'Enter a 2-digit jodi (00-99)');
  return tx(() => {
    db.prepare('INSERT INTO disawar_results (date, slot, jodi) VALUES (?, ?, ?) ON CONFLICT (date, slot) DO UPDATE SET jodi = excluded.jodi').run(date, slot, jodi);
    return { jodi, settled: settleSlot('jackpot', date, slot) };
  });
});

route('DELETE', '/api/admin/disawar', (ctx) => {
  admin(ctx);
  const date = ctx.query.get('date'), slot = ctx.query.get('slot');
  if (!isValidDate(date) || !DISAWAR_SLOTS.includes(String(slot))) throw new HttpError(400, 'Invalid date or time');
  tx(() => {
    db.prepare('DELETE FROM disawar_results WHERE date = ? AND slot = ?').run(date, slot);
    settleSlot('jackpot', date, String(slot));
  });
});

// ---------- UPI deposits and withdrawals ----------
/** Every top-up claim, newest first. Only a pending one can be approved or rejected. */
route('GET', '/api/admin/payments', (ctx) => {
  admin(ctx);
  const status = ctx.query.get('status');
  const filter = status === 'pending' || status === 'approved' || status === 'rejected';
  return db.prepare(`SELECT p.id, p.user_id AS userId, u.name, u.mobile, u.balance, p.amount, p.utr, p.payer, p.status, p.remark,
      p.created_at AS date, p.reviewed_at AS reviewed
    FROM upi_payments p JOIN users u ON u.id = p.user_id
    ${filter ? 'WHERE p.status = ?' : ''} ORDER BY p.id DESC LIMIT 500`).all(...(filter ? [status as string] : []));
});

/**
 * Approve = the UTR was checked and the points are credited. Reject = nothing is credited.
 * This is the only place a UPI payment can turn into balance; the app cannot do it.
 */
route('POST', '/api/admin/payments/:id', (ctx) => {
  admin(ctx);
  const id = int(ctx.params.id, 'Payment');
  const action = ctx.body.action;
  if (action !== 'approve' && action !== 'reject') throw new HttpError(400, 'Choose approve or reject');
  const remark = typeof ctx.body.remark === 'string' && ctx.body.remark.trim() ? ctx.body.remark.trim().slice(0, 100) : null;
  return tx(() => {
    const row = db.prepare('SELECT id, user_id, amount, utr, status FROM upi_payments WHERE id = ?').get(id) as
      { id: number; user_id: number; amount: number; utr: string; status: string } | undefined;
    if (!row) throw new HttpError(404, 'Payment not found');
    if (row.status !== 'pending') throw new HttpError(409, 'This payment has already been reviewed');
    if (action === 'approve') {
      db.prepare("UPDATE upi_payments SET status = 'approved', remark = ?, reviewed_at = datetime('now', 'localtime') WHERE id = ?")
        .run(remark ?? 'UTR verified', id);
      const balance = changeBalance(row.user_id, row.amount, `UPI deposit #${id} (UTR ${row.utr})`);
      return { status: 'approved', balance };
    }
    db.prepare("UPDATE upi_payments SET status = 'rejected', remark = ?, reviewed_at = datetime('now', 'localtime') WHERE id = ?")
      .run(remark ?? 'Rejected by admin', id);
    return { status: 'rejected' };
  });
});

/** Withdrawal requests, newest first. The points were already held when the user requested. */
route('GET', '/api/admin/withdrawals', (ctx) => {
  admin(ctx);
  const status = ctx.query.get('status');
  const filter = status === 'pending' || status === 'paid' || status === 'rejected';
  return db.prepare(`SELECT w.id, w.user_id AS userId, u.name, u.mobile, u.balance, w.amount, w.method, w.upi,
      w.account_name AS accountName, w.account_no AS accountNo, w.ifsc, w.status, w.remark,
      w.created_at AS date, w.reviewed_at AS reviewed
    FROM withdraw_requests w JOIN users u ON u.id = w.user_id
    ${filter ? 'WHERE w.status = ?' : ''} ORDER BY w.id DESC LIMIT 500`).all(...(filter ? [status as string] : []));
});

/** pay = money sent (points stay deducted). reject = points are given back. */
route('POST', '/api/admin/withdrawals/:id', (ctx) => {
  admin(ctx);
  const id = int(ctx.params.id, 'Withdrawal');
  const action = ctx.body.action;
  if (action !== 'pay' && action !== 'reject') throw new HttpError(400, 'Choose pay or reject');
  const remark = typeof ctx.body.remark === 'string' && ctx.body.remark.trim() ? ctx.body.remark.trim().slice(0, 100) : null;
  return tx(() => {
    const row = db.prepare('SELECT id, user_id, amount, status FROM withdraw_requests WHERE id = ?').get(id) as
      { id: number; user_id: number; amount: number; status: string } | undefined;
    if (!row) throw new HttpError(404, 'Withdrawal not found');
    if (row.status !== 'pending') throw new HttpError(409, 'This withdrawal has already been reviewed');
    if (action === 'pay') {
      db.prepare("UPDATE withdraw_requests SET status = 'paid', remark = ?, reviewed_at = datetime('now', 'localtime') WHERE id = ?")
        .run(remark ?? 'Paid by admin', id);
      return { status: 'paid' };
    }
    db.prepare("UPDATE withdraw_requests SET status = 'rejected', remark = ?, reviewed_at = datetime('now', 'localtime') WHERE id = ?")
      .run(remark ?? 'Rejected by admin', id);
    const balance = changeBalance(row.user_id, row.amount, `Withdraw refund #${id}`);
    return { status: 'rejected', balance };
  });
});

// ---------- admin's own password ----------
route('POST', '/api/admin/password', (ctx) => {
  const id = admin(ctx);
  const current = str(ctx.body.current, 'Current password', 100);
  const next = str(ctx.body.next, 'New password', 100);
  if (next.length < 8) throw new HttpError(400, 'New password must be at least 8 characters');
  const row = db.prepare('SELECT pass_hash FROM admins WHERE id = ?').get(id) as { pass_hash: string };
  if (!checkPassword(current, row.pass_hash)) throw new HttpError(400, 'Current password is wrong');
  db.prepare('UPDATE admins SET pass_hash = ? WHERE id = ?').run(hashPassword(next), id);
  // Log out every other admin session; the current one stays signed in.
  const token = (ctx.req.headers.authorization ?? '').replace(/^Bearer /, '');
  db.prepare("DELETE FROM sessions WHERE kind = 'admin' AND subject_id = ? AND token != ?").run(id, token);
});

// ---------- bid revert: cancel pending bids and refund their points ----------
/**
 * Reverts pending bids for a market/date (optionally only some ids). Bids that already won or lost
 * are left alone; the result has to be deleted first, which puts them back to pending.
 */
/** Refunds pending Starline / Jackpot bids of one slot, all of them or only the chosen ids. */
function revertSlotBids(body: Record<string, unknown>) {
  const kind = body.kind;
  if (kind !== 'starline' && kind !== 'jackpot') throw new HttpError(400, 'Unknown game type');
  const date = body.date;
  if (!isValidDate(date)) throw new HttpError(400, 'Select a valid date');
  const slot = str(body.slot, 'Time', 20);
  if (!(kind === 'starline' ? STARLINE_SLOTS : JACKPOT_SLOTS).includes(slot)) throw new HttpError(400, 'Select a valid time');
  const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).map((id) => int(id, 'Bid')) : null;
  if (ids && !ids.length) throw new HttpError(400, 'Select at least one bid');
  const label = `${kind === 'starline' ? 'Starline' : 'Jackpot'} ${slot}`;

  return tx(() => {
    const bids = db.prepare("SELECT id, user_id, game, number, points FROM slot_bids WHERE kind = ? AND date = ? AND slot = ? AND status = 'pending'")
      .all(kind, date, slot) as { id: number; user_id: number; game: string; number: string; points: number }[];
    const chosen = ids ? bids.filter((b) => ids.includes(b.id)) : bids;
    if (!chosen.length) throw new HttpError(400, 'No pending bids to revert');
    const mark = db.prepare("UPDATE slot_bids SET status = 'reverted', win_amount = 0 WHERE id = ? AND status = 'pending'");
    for (const b of chosen) {
      mark.run(b.id);
      changeBalance(b.user_id, b.points, `Refund: ${label} ${b.game} ${b.number} bid reverted`);
    }
    return { reverted: chosen.length, points: chosen.reduce((s, b) => s + b.points, 0), users: new Set(chosen.map((b) => b.user_id)).size };
  });
}

/** Starline / Jackpot bids for one slot, in the same shape as the market bid report. */
route('GET', '/api/admin/slot-bids', (ctx) => {
  admin(ctx);
  const date = ctx.query.get('date'), kind = ctx.query.get('kind'), slot = String(ctx.query.get('slot') ?? '');
  if (!isValidDate(date)) throw new HttpError(400, 'Invalid date');
  if (kind !== 'starline' && kind !== 'jackpot') throw new HttpError(400, 'Unknown game type');
  return db.prepare(`SELECT b.id, u.name AS user, u.mobile, ? AS market, b.game, NULL AS session, b.number, b.points, b.status, b.win_amount AS win, b.created_at AS time
    FROM slot_bids b JOIN users u ON u.id = b.user_id
    WHERE b.kind = ? AND b.date = ? AND b.slot = ? ORDER BY b.id DESC LIMIT 1000`)
    .all(`${kind === 'starline' ? 'Starline' : 'Jackpot'} ${slot}`, kind, date, slot);
});

route('POST', '/api/admin/bids/revert', (ctx) => {
  admin(ctx);
  if (ctx.body.kind !== undefined) return revertSlotBids(ctx.body);
  const marketId = int(ctx.body.marketId, 'Game');
  const date = ctx.body.date;
  if (!isValidDate(date)) throw new HttpError(400, 'Select a valid date');
  const ids = Array.isArray(ctx.body.ids) ? (ctx.body.ids as unknown[]).map((id) => int(id, 'Bid')) : null;
  if (ids && !ids.length) throw new HttpError(400, 'Select at least one bid');
  const market = db.prepare('SELECT name FROM markets WHERE id = ?').get(marketId) as { name: string } | undefined;
  if (!market) throw new HttpError(404, 'Game not found');

  return tx(() => {
    const bids = db.prepare(`SELECT id, user_id, game, number, points FROM bids
      WHERE market_id = ? AND date = ? AND status = 'pending'`).all(marketId, date) as
      { id: number; user_id: number; game: string; number: string; points: number }[];
    const chosen = ids ? bids.filter((b) => ids.includes(b.id)) : bids;
    if (!chosen.length) throw new HttpError(400, 'No pending bids to revert');
    const mark = db.prepare("UPDATE bids SET status = 'reverted', win_amount = 0 WHERE id = ? AND status = 'pending'");
    for (const b of chosen) {
      mark.run(b.id);
      changeBalance(b.user_id, b.points, `Refund: ${market.name} ${b.game} ${b.number} bid reverted`);
    }
    return { reverted: chosen.length, points: chosen.reduce((s, b) => s + b.points, 0), users: new Set(chosen.map((b) => b.user_id)).size };
  });
});
