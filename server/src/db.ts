import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from './auth.ts';

const file = process.env.DB_FILE ?? fileURLToPath(new URL('../data/kalyan.db', import.meta.url));
// First run on a fresh checkout: the data folder may not exist yet.
if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
export const db = new DatabaseSync(file);

// 'reverted' = cancelled by the admin and points refunded.
const BIDS_INDEXES = `
  CREATE INDEX IF NOT EXISTS bids_market_date ON bids (market_id, date);
  CREATE INDEX IF NOT EXISTS bids_user ON bids (user_id, id);`;
const BIDS_TABLE = `
  CREATE TABLE IF NOT EXISTS bids (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    market_id INTEGER NOT NULL REFERENCES markets(id),
    date TEXT NOT NULL,
    game TEXT NOT NULL,
    session TEXT,
    number TEXT NOT NULL,
    points INTEGER NOT NULL CHECK (points > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'reverted')),
    win_amount INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
  ${BIDS_INDEXES}`;

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL UNIQUE,
    pass_hash TEXT NOT NULL,
    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    active INTEGER NOT NULL DEFAULT 1,
    betting INTEGER NOT NULL DEFAULT 1,
    approved INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  -- One row per user login (and registration), so the admin can see who logged in on any day.
  CREATE TABLE IF NOT EXISTS login_log (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
  CREATE INDEX IF NOT EXISTS login_log_at ON login_log (at);

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    pass_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('user', 'admin')),
    subject_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  -- Registration OTPs. A verified OTP becomes a one-time ticket for setting the password.
  CREATE TABLE IF NOT EXISTS otps (
    mobile TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    ticket TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER NOT NULL
  );

  -- Times are stored as 24h "HH:MM".
  CREATE TABLE IF NOT EXISTS markets (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    open_time TEXT NOT NULL,
    close_time TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  -- One result per market per date; ank and jodi are always derived from the panas.
  CREATE TABLE IF NOT EXISTS results (
    date TEXT NOT NULL,
    market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    open_pana TEXT,
    close_pana TEXT,
    PRIMARY KEY (date, market_id)
  );

  CREATE TABLE IF NOT EXISTS starline_results (date TEXT NOT NULL, slot TEXT NOT NULL, pana TEXT NOT NULL, PRIMARY KEY (date, slot));
  CREATE TABLE IF NOT EXISTS disawar_results (date TEXT NOT NULL, slot TEXT NOT NULL, jodi TEXT NOT NULL, PRIMARY KEY (date, slot));

  ${BIDS_TABLE}

  -- Every balance change is recorded with the balance after it.
  CREATE TABLE IF NOT EXISTS wallet_tx (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    remark TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  -- Bids on Starline and Jackpot (Gali Disawar) time slots; each is settled by that slot's result.
  CREATE TABLE IF NOT EXISTS slot_bids (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL CHECK (kind IN ('starline', 'jackpot')),
    date TEXT NOT NULL,
    slot TEXT NOT NULL,
    game TEXT NOT NULL,
    number TEXT NOT NULL,
    points INTEGER NOT NULL CHECK (points > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'reverted')),
    win_amount INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
  CREATE INDEX IF NOT EXISTS slot_bids_slot ON slot_bids (kind, date, slot);
  CREATE INDEX IF NOT EXISTS slot_bids_user ON slot_bids (user_id, id);

  -- Live support chat. seen = 1 once the other side has read it (the admin for a user message, the user for an admin reply).
  CREATE TABLE IF NOT EXISTS support_messages (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    sender TEXT NOT NULL CHECK (sender IN ('user', 'admin')),
    text TEXT NOT NULL,
    seen INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
  CREATE INDEX IF NOT EXISTS support_messages_user ON support_messages (user_id, id);

  -- Messages the admin writes; shown to every user on the app's Notifications screen.
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  -- UPI top-ups: the customer pays with a UPI link, then sends the 12-digit UTR.
  -- Only an admin approval credits the wallet; the browser can never mark one paid.
  CREATE TABLE IF NOT EXISTS upi_payments (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount INTEGER NOT NULL CHECK (amount > 0),
    utr TEXT NOT NULL UNIQUE,
    payer TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    remark TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    reviewed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS upi_payments_user ON upi_payments (user_id, id);
  CREATE INDEX IF NOT EXISTS upi_payments_status ON upi_payments (status, id);

  -- Withdrawals: the amount is held from the balance when requested and refunded if rejected.
  CREATE TABLE IF NOT EXISTS withdraw_requests (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount INTEGER NOT NULL CHECK (amount > 0),
    method TEXT NOT NULL DEFAULT 'upi' CHECK (method IN ('upi', 'bank')),
    upi TEXT,
    account_name TEXT,
    account_no TEXT,
    ifsc TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
    remark TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    reviewed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS withdraw_requests_user ON withdraw_requests (user_id, id);
  CREATE INDEX IF NOT EXISTS withdraw_requests_status ON withdraw_requests (status, id);

  -- UPI payments that arrived on the admin's UPI ID, pushed in by the payment feed.
  -- status: credited (wallet topped up) / unmatched (payer is not a customer yet) /
  -- pending (needs the admin, e.g. the amount does not match the claim) / rejected.
  CREATE TABLE IF NOT EXISTS auto_deposits (
    id INTEGER PRIMARY KEY,
    amount INTEGER NOT NULL CHECK (amount > 0),
    utr TEXT NOT NULL UNIQUE,
    payer TEXT,
    payer_name TEXT,
    payee TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'credited' CHECK (status IN ('credited', 'unmatched', 'pending', 'rejected')),
    user_id INTEGER REFERENCES users(id),
    payment_id INTEGER REFERENCES upi_payments(id),
    remark TEXT,
    source TEXT,
    raw TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
  CREATE INDEX IF NOT EXISTS auto_deposits_status ON auto_deposits (status, id);
  CREATE INDEX IF NOT EXISTS auto_deposits_created ON auto_deposits (created_at);

  -- Every call to the payment feed URL. A payment that never shows up can then be explained:
  -- nothing reached the server, or the sender used the wrong key / a bad body.
  CREATE TABLE IF NOT EXISTS feed_attempts (
    id INTEGER PRIMARY KEY,
    at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    code INTEGER NOT NULL,
    detail TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS feed_attempts_at ON feed_attempts (at);

  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

// Databases created before the payer column existed need it added once.
const paymentCols = db.prepare('PRAGMA table_info(upi_payments)').all() as { name: string }[];
if (!paymentCols.some((c) => c.name === 'payer')) db.exec('ALTER TABLE upi_payments ADD COLUMN payer TEXT');

// Databases created before bids could be reverted have a narrower status check; rebuild that table once.
const bidsSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'bids'").get() as { sql: string }).sql;
if (!bidsSql.includes("'reverted'")) {
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    db.exec(`ALTER TABLE bids RENAME TO bids_old;
      ${BIDS_TABLE}
      INSERT INTO bids SELECT * FROM bids_old;
      DROP TABLE bids_old;
      ${BIDS_INDEXES}`);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}

export const DEFAULT_SETTINGS: Record<string, string> = {
  ticker: 'PLAY FOR FUN - FREE POINTS ONLY, NO REAL MONEY',
  contact_phone: '+91 00000 00000',
  whatsapp: '9928821585',
  min_bid: '10',
  max_bid: '10000',
  welcome_bonus: '5',
  how_to_play: '',
  notice_board: '',
  // Short texts the admin can edit; an empty one is hidden in the app.
  text_home: '',
  text_rates: 'Win ratio is shown per 10 points played. Rates can change; the rate shown here is the one applied.',
  text_timetable: 'Times are shown for today. A market closes for bids at its close time.',
  text_support: 'Our team is available to help you. Tap an option below to get in touch.',
  text_game: 'Check the number and points before you place a bid. Placed bids cannot be changed.',
  // Home screen banner images: [{ url, order }].
  sliders: '[]',
  // What the user app shows after login: 'gaming' (matka) or 'quiz' (quiz app mode).
  app_mode: 'gaming',
  // Seconds allowed per quiz question (20, 25 or 30).
  quiz_timer: '20',
  // Win amount for every 10 points played on Starline and Jackpot.
  slot_rates: JSON.stringify({ starSingle: 95, starSp: 1500, starDp: 3000, starTp: 7000, jackpotJodi: 950 }),
  // Win amount for every 10 points played.
  rates: JSON.stringify({ single: 100, jodi: 1000, sp: 1500, dp: 3000, tp: 7000, half: 10000, full: 100000 }),
  // UPI payments. Empty UPI ID (or upi_enabled = '0') hides the pay buttons in the app.
  pay_mobile: '',
  upi_id: '',
  upi_name: '',
  upi_note: 'Wallet top-up',
  upi_enabled: '0',
  // '1' tops up the customer's wallet the moment the payment feed reports money.
  // '0' keeps every payment waiting for the admin (Fund Request / Auto Deposit History).
  auto_credit: '1',
  // How the app takes a UPI payment: 'qr' shows only the QR code, 'upi' opens a UPI app.
  payment_type: 'qr',
  min_deposit: '10',
  min_withdraw: '100',
  // Trust and security messages under the payment options on Add Money. One per line, up to 5.
  trust_title: 'Your payment is protected',
  trust_note: [
    'Your payments are safe and secure.',
    'Your financial information is protected with secure payment processing.',
    'We prioritize your privacy and never compromise your security.',
    'Pay with confidence using our trusted payment methods.',
    'Your money and payment details are handled with care.',
  ].join('\n'),
};

const DEFAULT_MARKETS: [string, string, string][] = [
  ['Sita Morning', '09:35', '10:35'], ['Sridevi Morning', '10:00', '11:00'], ['Karnataka Day', '10:20', '11:20'],
  ['Milan Morning', '10:20', '11:20'], ['Andhra Morning', '10:35', '11:35'], ['Madhur Morning', '11:20', '12:20'],
  ['Sridevi', '11:35', '12:35'], ['Mahadevi Morning', '11:35', '12:35'], ['Kalyan Morning', '11:40', '12:40'],
  ['Padmavathi', '11:40', '12:40'], ['Worli Morning', '12:00', '13:00'], ['New Time Bazar', '13:00', '14:00'],
  ['Time Bazar', '13:05', '14:05'], ['Sridevi Day', '13:25', '14:25'], ['Madhur Day', '13:30', '14:30'],
  ['Puna Bazar', '13:30', '15:30'], ['Sita Day', '13:35', '14:35'], ['Rajdhani Day', '15:05', '17:05'],
  ['Milan Day', '15:10', '17:10'], ['Andhra Day', '15:30', '17:30'], ['Supreme Day', '15:35', '17:35'],
  ['Kalyan', '15:45', '17:45'], ['Mahadevi', '16:20', '18:20'], ['Sita Night', '18:40', '19:40'],
  ['Karnataka Night', '18:45', '19:45'], ['Sridevi Night', '19:15', '20:15'], ['Mahadevi Night', '19:40', '20:40'],
  ['Padmavathi Night', '19:40', '20:40'], ['Madhur Night', '20:30', '22:30'], ['Andhra Night', '20:40', '22:40'],
  ['Supreme Night', '20:45', '22:45'], ['Night Time Bazar', '20:50', '22:50'], ['Milan Night', '21:05', '23:05'],
  ['Kalyan Night', '21:40', '23:40'], ['Rajdhani Night', '21:40', '23:50'], ['Old Mumbai', '21:40', '23:30'],
  ['Ratan Khatri', '21:40', '23:40'], ['Main Bazar', '21:50', '23:55'],
];

/** First run only: default markets, settings and the admin login (from env, with a dev fallback). */
export function seed() {
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insertSetting.run(k, v);

  const { n } = db.prepare('SELECT COUNT(*) AS n FROM markets').get() as { n: number };
  if (!n) {
    const insert = db.prepare('INSERT INTO markets (name, open_time, close_time) VALUES (?, ?, ?)');
    for (const m of DEFAULT_MARKETS) insert.run(...m);
  }

  const admins = db.prepare('SELECT COUNT(*) AS n FROM admins').get() as { n: number };
  if (!admins.n) {
    const email = process.env.ADMIN_EMAIL ?? 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD ?? 'admin123';
    db.prepare('INSERT INTO admins (email, pass_hash) VALUES (?, ?)').run(email.toLowerCase(), hashPassword(password));
  }

  // The auto deposit feed needs its key from the first request, so create it at startup.
  autoDepositKey();
}

/** Runs `fn` in a transaction; any thrown error rolls everything back. */
export function tx<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/**
 * Shared secret the payment feed sends with every deposit. Generated once per install and kept in
 * settings, so the ingest endpoint is never open to anyone who knows the URL.
 */
export function autoDepositKey(): string {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'auto_deposit_key'").get() as { value: string } | undefined;
  if (row?.value) return row.value;
  const key = randomBytes(16).toString('hex');
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_deposit_key', ?)").run(key);
  return key;
}

export function getSetting(key: string): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? DEFAULT_SETTINGS[key] ?? '';
}

/** Applies a balance change and records it. Throws if the balance would go negative. */
export function changeBalance(userId: number, amount: number, remark: string): number {
  const row = db.prepare('UPDATE users SET balance = balance + ? WHERE id = ? AND balance + ? >= 0 RETURNING balance')
    .get(amount, userId, amount) as { balance: number } | undefined;
  if (!row) throw new Error('Insufficient balance');
  db.prepare('INSERT INTO wallet_tx (user_id, amount, balance_after, remark) VALUES (?, ?, ?, ?)').run(userId, amount, row.balance, remark);
  return row.balance;
}
