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

  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

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
  whatsapp: '',
  min_bid: '10',
  max_bid: '10000',
  welcome_bonus: '5',
  how_to_play: '',
  notice_board: '',
  // Home screen banner images: [{ url, order }].
  sliders: '[]',
  // What the user app shows after login: 'gaming' (matka) or 'quiz' (quiz app mode).
  app_mode: 'gaming',
  // Seconds allowed per quiz question (20, 25 or 30).
  quiz_timer: '20',
  // Win amount for every 10 points played.
  rates: JSON.stringify({ single: 100, jodi: 1000, sp: 1500, dp: 3000, tp: 7000, half: 10000, full: 100000 }),
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
