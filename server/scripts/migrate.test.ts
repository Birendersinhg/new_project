// Opens a database in the old format (bids without 'reverted') and checks the upgrade keeps every bid.
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'kalyan-migrate-'));
const file = join(dir, 'old.db');
const old = new DatabaseSync(file);
old.exec(`
  CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, mobile TEXT NOT NULL UNIQUE, pass_hash TEXT NOT NULL,
    balance INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, betting INTEGER NOT NULL DEFAULT 1,
    approved INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT '');
  CREATE TABLE markets (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, open_time TEXT NOT NULL, close_time TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE bids (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), market_id INTEGER NOT NULL REFERENCES markets(id),
    date TEXT NOT NULL, game TEXT NOT NULL, session TEXT, number TEXT NOT NULL, points INTEGER NOT NULL CHECK (points > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost')),
    win_amount INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT '');
  INSERT INTO users (id, name, mobile, pass_hash) VALUES (1, 'A', '9876543210', 'x:y');
  INSERT INTO markets (id, name, open_time, close_time) VALUES (1, 'Kalyan', '15:45', '17:45');
  INSERT INTO bids (user_id, market_id, date, game, session, number, points, status, win_amount)
    VALUES (1, 1, '2026-11-19', 'Single Digit', 'Open', '5', 10, 'won', 100), (1, 1, '2026-11-19', 'Jodi', NULL, '15', 20, 'pending', 0);
`);
old.close();

process.env.DB_FILE = file;
const { db } = await import('../src/db.ts');

let fails = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) fails++; };
const rows = db.prepare('SELECT number, points, status, win_amount FROM bids ORDER BY id').all() as { number: string; points: number; status: string; win_amount: number }[];
check('all old bids kept with their data', rows.length === 2 && rows[0].status === 'won' && rows[0].win_amount === 100 && rows[1].number === '15');
db.prepare("UPDATE bids SET status = 'reverted' WHERE number = '15'").run();
check("upgraded table accepts 'reverted'", (db.prepare("SELECT COUNT(*) AS n FROM bids WHERE status = 'reverted'").get() as { n: number }).n === 1);
check('indexes recreated', (db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'index' AND name IN ('bids_market_date', 'bids_user')").get() as { n: number }).n === 2);
check('old table removed', !db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'bids_old'").get());
db.close();
rmSync(dir, { recursive: true, force: true });

console.log(fails ? `\n${fails} FAILED` : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
