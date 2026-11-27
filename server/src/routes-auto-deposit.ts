// Auto deposit: the payment feed posts every UPI payment that lands on the admin's UPI ID here,
// and the customer's wallet is topped up without anyone typing a UTR. Unmatched payments are kept
// with the payer's number so the admin can credit them by hand.
import { timingSafeEqual } from 'node:crypto';
import { autoDepositKey, changeBalance, db, getSetting, tx } from './db.ts';
import { HttpError, int, requireAuth, route, type Ctx } from './http.ts';
import { isValidDate } from './time.ts';

const admin = (ctx: Ctx) => requireAuth(ctx, 'admin');

/** First non-empty value of `names` in the posted body. Feeds spell their fields differently. */
function first(body: Record<string, unknown>, names: string[]): string {
  for (const name of names) {
    const v = body[name];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
}

/** "₹5.00" / 5 / "5.00" -> 5. The wallet counts whole rupees (points). */
function rupees(v: string): number {
  const n = Number(v.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** The number behind a payer: "98765 43210" and "9876543210@paytm" both give 9876543210. */
function payerMobile(payer: string): string {
  const local = payer.split('@')[0].replace(/\D/g, '');
  const all = payer.replace(/\D/g, '');
  const ten = (s: string) => s.replace(/^91(?=\d{10}$)/, '');
  for (const candidate of [ten(local), ten(all)]) {
    if (/^[6-9]\d{9}$/.test(candidate)) return candidate;
  }
  return '';
}

function keyMatches(given: string): boolean {
  const key = Buffer.from(autoDepositKey());
  const sent = Buffer.from(given);
  return sent.length === key.length && timingSafeEqual(sent, key);
}

interface AutoRow {
  id: number; user_id: number | null; amount: number; utr: string; status: string;
}

/** Stores the payment and returns what happened to it. Call inside a transaction. */
function record(p: {
  amount: number; utr: string; payer: string; payerName: string; payee: string; note: string;
  source: string; raw: string;
}): { status: string; userId: number | null; balance?: number; remark: string } {
  // The admin can switch automatic crediting off in Settings: payments are then stored only,
  // and the admin credits them by hand from Auto Deposit History / Fund Request.
  const autoCredit = getSetting('auto_credit') !== '0';
  const mobile = payerMobile(p.payer);
  const insert = db.prepare(`INSERT INTO auto_deposits
    (amount, utr, payer, payer_name, payee, note, status, user_id, payment_id, remark, source, raw)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`);
  const claim = db.prepare('SELECT id, user_id, amount, status FROM upi_payments WHERE utr = ?')
    .get(p.utr) as { id: number; user_id: number; amount: number; status: string } | undefined;
  // Every branch stores one row; only the status, customer and remark differ.
  const save = (status: string, userId: number | null, paymentId: number | null, remark: string) =>
    insert.run(p.amount, p.utr, p.payer || mobile || null, p.payerName || null, p.payee || null, p.note || null,
      status, userId, paymentId, remark, p.source || null, p.raw);

  // 1. The customer already told the app this UTR: approve that claim, so one payment is credited once.
  if (claim) {
    if (claim.status === 'approved') {
      const remark = 'UTR was already approved, nothing credited twice';
      save('rejected', claim.user_id, claim.id, remark);
      return { status: 'rejected', userId: claim.user_id, remark };
    }
    if (claim.status === 'rejected') {
      const remark = 'Claim was rejected by the admin, nothing credited';
      save('rejected', claim.user_id, claim.id, remark);
      return { status: 'rejected', userId: claim.user_id, remark };
    }
    if (claim.amount !== p.amount) {
      const remark = `Received ₹${p.amount} but the claim is ₹${claim.amount}`;
      save('pending', claim.user_id, claim.id, remark);
      return { status: 'pending', userId: claim.user_id, remark };
    }
    if (!autoCredit) {
      const remark = 'Auto credit is off: approve this claim by hand';
      save('pending', claim.user_id, claim.id, remark);
      return { status: 'pending', userId: claim.user_id, remark };
    }
    db.prepare("UPDATE upi_payments SET status = 'approved', remark = ?, reviewed_at = datetime('now', 'localtime') WHERE id = ?")
      .run('Auto deposit: UPI payment received', claim.id);
    const balance = changeBalance(claim.user_id, p.amount, `UPI deposit #${claim.id} (auto, UTR ${p.utr})`);
    const remark = 'Auto-verified from the UPI payment feed';
    save('credited', claim.user_id, claim.id, remark);
    return { status: 'credited', userId: claim.user_id, balance, remark };
  }

  // 2. The payer's number is a customer's number: credit it straight away.
  const user = mobile
    ? db.prepare('SELECT id, name FROM users WHERE mobile = ?').get(mobile) as { id: number; name: string } | undefined
    : undefined;
  if (user) {
    if (!autoCredit) {
      const remark = `Auto credit is off: credit ${user.name} by hand`;
      save('pending', user.id, null, remark);
      return { status: 'pending', userId: user.id, remark };
    }
    // Recorded as an approved claim too, so every deposit report shows it in one place.
    const payment = db.prepare(`INSERT INTO upi_payments (user_id, amount, utr, payer, status, remark, reviewed_at)
      VALUES (?, ?, ?, ?, 'approved', 'Auto deposit: UPI payment received', datetime('now', 'localtime')) RETURNING id`)
      .get(user.id, p.amount, p.utr, p.payer || mobile) as { id: number };
    const balance = changeBalance(user.id, p.amount, `Auto deposit #${payment.id} (UTR ${p.utr})`);
    const remark = `Credited to ${user.name}`;
    save('credited', user.id, payment.id, remark);
    return { status: 'credited', userId: user.id, balance, remark };
  }

  // 3. Nobody matched: keep the payment with the payer's number for the admin.
  const remark = 'No customer found for this payer';
  save('unmatched', null, null, remark);
  return { status: 'unmatched', userId: null, remark };
}

/**
 * The payment feed's endpoint. Auth: `x-api-key: <key>` (or `Authorization: Bearer <key>`).
 * Sending the same UTR twice is safe: the second call is answered as a duplicate and credits nothing.
 */
function ingest(ctx: Ctx) {
  const sent = String(ctx.req.headers['x-api-key'] ?? '').trim()
    || (ctx.req.headers.authorization ?? '').replace(/^Bearer /i, '').trim();
  if (!sent || !keyMatches(sent)) throw new HttpError(401, 'Invalid auto deposit key');

  const body = ctx.body;
  const amount = rupees(first(body, ['amount', 'amt', 'paid', 'credit', 'value']));
  if (amount < 1) throw new HttpError(400, 'amount is required, in whole rupees');
  const utr = first(body, ['utr', 'txnId', 'txn_id', 'transactionId', 'rrn', 'ref', 'reference', 'bankRef', 'chequeId'])
    .replace(/\s+/g, '').toUpperCase().slice(0, 64);
  if (utr.length < 4) throw new HttpError(400, 'utr (the bank reference of the payment) is required');
  const payer = first(body, ['payer', 'sender', 'from', 'payerVpa', 'senderVpa', 'vpa', 'mobile', 'phone', 'remitter']).slice(0, 100);

  const seen = db.prepare('SELECT id, status FROM auto_deposits WHERE utr = ?').get(utr) as AutoRow | undefined;
  if (seen) return { ok: true, duplicate: true, id: seen.id, status: seen.status, amount, utr };

  const done = tx(() => record({
    amount,
    utr,
    payer,
    payerName: first(body, ['payerName', 'senderName', 'name', 'remitterName']).slice(0, 100),
    payee: first(body, ['payee', 'payeeVpa', 'to', 'upi']).slice(0, 100) || getSetting('upi_id'),
    note: first(body, ['note', 'remark', 'remarks', 'narration', 'message']).slice(0, 200),
    source: first(body, ['source', 'provider', 'feed', 'app']).slice(0, 40),
    raw: JSON.stringify(body).slice(0, 2000),
  }));
  return { ok: true, duplicate: false, status: done.status, amount, utr, userId: done.userId, remark: done.remark };
}

/** Keeps the last 50 calls to the feed, so the admin can see whether the sender reaches this server. */
function logAttempt(code: number, detail: string) {
  db.prepare('INSERT INTO feed_attempts (code, detail) VALUES (?, ?)').run(code, detail.slice(0, 200));
  db.prepare('DELETE FROM feed_attempts WHERE id <= (SELECT max(id) FROM feed_attempts) - 50').run();
}

route('POST', '/api/auto-deposit', (ctx) => {
  try {
    const out = ingest(ctx) as { status?: string; duplicate?: boolean };
    logAttempt(200, out.duplicate ? 'Already received (duplicate)' : `Stored: ${out.status}`);
    return out;
  } catch (err) {
    const code = err instanceof HttpError ? err.status : 500;
    logAttempt(code, err instanceof Error ? err.message : 'Call failed');
    throw err;
  }
});

// ---------- admin ----------
const range = (ctx: Ctx) => {
  const from = ctx.query.get('from') ?? '';
  const to = ctx.query.get('to') ?? '';
  if ((from && !isValidDate(from)) || (to && !isValidDate(to))) throw new HttpError(400, 'Select a valid date');
  return { from, to };
};

/** Everything the feed has delivered, newest first, with the customer it was matched to. */
route('GET', '/api/admin/auto-deposits', (ctx) => {
  admin(ctx);
  const { from, to } = range(ctx);
  const status = ctx.query.get('status') ?? '';
  const filters: string[] = [];
  const params: string[] = [];
  if (from) { filters.push('date(a.created_at) >= ?'); params.push(from); }
  if (to) { filters.push('date(a.created_at) <= ?'); params.push(to); }
  if (['credited', 'unmatched', 'pending', 'rejected'].includes(status)) { filters.push('a.status = ?'); params.push(status); }
  return db.prepare(`SELECT a.id, a.amount, a.utr, a.payer, a.payer_name AS payerName, a.payee, a.note,
      a.status, a.remark, a.source, a.user_id AS userId, u.name AS userName, u.mobile AS userMobile,
      a.payment_id AS paymentId, date(a.created_at) AS date, substr(a.created_at, 12, 8) AS time
    FROM auto_deposits a LEFT JOIN users u ON u.id = a.user_id
    ${filters.length ? 'WHERE ' + filters.join(' AND ') : ''}
    ORDER BY a.id DESC LIMIT 500`).all(...params);
});

/** The endpoint + key the admin gives to the UPI payment app / SMS forwarder. */
route('GET', '/api/admin/auto-deposits/feed', (ctx) => {
  admin(ctx);
  const last = db.prepare('SELECT max(created_at) AS at FROM auto_deposits').get() as { at: string | null };
  return {
    url: '/api/auto-deposit',
    key: autoDepositKey(),
    upi: getSetting('upi_id'),
    lastPayment: last.at,
    attempts: db.prepare('SELECT at, code, detail FROM feed_attempts ORDER BY id DESC LIMIT 3').all(),
  };
});

/** Credits a payment the feed could not match to a customer. */
route('POST', '/api/admin/auto-deposits/:id/credit', (ctx) => {
  admin(ctx);
  const id = int(ctx.params.id, 'Auto deposit');
  const userId = int(ctx.body.userId, 'User');
  return tx(() => {
    const row = db.prepare('SELECT id, amount, utr, payer, status FROM auto_deposits WHERE id = ?').get(id) as
      { id: number; amount: number; utr: string; payer: string | null; status: string } | undefined;
    if (!row) throw new HttpError(404, 'Auto deposit not found');
    if (row.status === 'credited') throw new HttpError(409, 'This payment is already credited');
    const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId) as { id: number; name: string } | undefined;
    if (!user) throw new HttpError(404, 'User not found');
    const claimed = db.prepare('SELECT id FROM upi_payments WHERE utr = ?').get(row.utr) as { id: number } | undefined;
    if (claimed) throw new HttpError(409, 'This UTR is already used by a claim. Use Fund Request to review it.');
    const payment = db.prepare(`INSERT INTO upi_payments (user_id, amount, utr, payer, status, remark, reviewed_at)
      VALUES (?, ?, ?, ?, 'approved', 'Auto deposit credited by admin', datetime('now', 'localtime')) RETURNING id`)
      .get(user.id, row.amount, row.utr, row.payer) as { id: number };
    const balance = changeBalance(user.id, row.amount, `Auto deposit #${row.id} (UTR ${row.utr})`);
    db.prepare("UPDATE auto_deposits SET status = 'credited', user_id = ?, payment_id = ?, remark = ? WHERE id = ?")
      .run(user.id, payment.id, `Credited to ${user.name} by admin`, row.id);
    return { status: 'credited', balance, user: user.name };
  });
});

/** Deposit report: every top-up claim, with whether it was credited automatically by the feed. */
route('GET', '/api/admin/deposits', (ctx) => {
  admin(ctx);
  const { from, to } = range(ctx);
  const status = ctx.query.get('status') ?? '';
  const filters: string[] = [];
  const params: string[] = [];
  if (from) { filters.push('date(p.created_at) >= ?'); params.push(from); }
  if (to) { filters.push('date(p.created_at) <= ?'); params.push(to); }
  if (['pending', 'approved', 'rejected'].includes(status)) { filters.push('p.status = ?'); params.push(status); }
  return db.prepare(`SELECT p.id, u.name, u.mobile, p.amount, p.utr, p.payer, p.status, p.remark,
      date(p.created_at) AS date, substr(p.created_at, 12, 8) AS time,
      EXISTS (SELECT 1 FROM auto_deposits a WHERE a.payment_id = p.id) AS auto
    FROM upi_payments p JOIN users u ON u.id = p.user_id
    ${filters.length ? 'WHERE ' + filters.join(' AND ') : ''}
    ORDER BY p.id DESC LIMIT 1000`).all(...params);
});
