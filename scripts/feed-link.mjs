// Prints everything the bank-SMS forwarder on the phone needs to send payments into this server:
// the POST address (LAN and public), the key, and a ready JSON body with field regexes.
import { networkInterfaces } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync(new URL('../server/data/kalyan.db', import.meta.url));
const setting = (key) => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? '';

const port = Number(process.env.PORT ?? 3000);
const key = setting('auto_deposit_key');
const upi = setting('upi_id');
const seen = db.prepare('SELECT max(created_at) AS at FROM auto_deposits').get()?.at;
const calls = db.prepare('SELECT at, code, detail FROM feed_attempts ORDER BY id DESC LIMIT 3').all();

const lan = Object.values(networkInterfaces())
  .flat()
  .filter((n) => n && n.family === 'IPv4' && !n.internal)
  .map((n) => n.address);

const body = '{"amount":"%Regex=(?i)(?:RS[.]?|INR)[ ]*([0-9]+([.][0-9]+)?)%",'
  + '"utr":"%Regex=(?i)(?:UTR|REF[.]?|RRN)[ ]*[:#]?[ ]*([0-9]{6,})%",'
  + '"payer":"%Regex=([6-9][0-9]{9}@[A-Za-z][A-Za-z0-9.]*)%",'
  + '"payerName":"%from%","source":"sms-forwarder"}';

const line = '-'.repeat(64);
console.log(`\nPayment feed — send bank SMS alerts to this server (port ${port})\n${line}`);

if (!key) {
  console.log('No feed key yet. Start the server once (npm run dev), then run this again.');
  process.exit(0);
}

console.log('POST URL  (phone on the same Wi-Fi as this computer):');
if (lan.length === 0) console.log('  (no LAN address found — connect this computer to Wi-Fi)');
for (const ip of lan) console.log(`  http://${ip}:${port}/api/auto-deposit`);
console.log(`  http://localhost:${port}/api/auto-deposit   (only on this computer)`);

console.log('\nHEADER   x-api-key: ' + key);
console.log('         (or Authorization: Bearer ' + key + ')');
console.log('\nPAYEE    ' + (upi || 'set the UPI ID in admin Settings first'));
console.log('\nJSON BODY (paste as the message body, method POST, content type JSON):');
console.log('  ' + body);

console.log(`\n${line}\nPast calls to the feed (newest first):`);
if (calls.length === 0) {
  console.log('  nothing yet — so nothing has ever reached this server.');
  console.log('  A UPI payment alone cannot show up here; the phone must forward the bank SMS.');
} else {
  for (const c of calls) console.log(`  ${c.at}  ${c.code === 200 ? 'accepted' : `refused ${c.code} — ${c.detail}`}`);
}
console.log('Last payment stored: ' + (seen ?? 'none yet'));

console.log(`\n${line}\nIf the phone is on mobile data (not your Wi-Fi), expose this computer first:`);
console.log(`  cloudflared tunnel --url http://localhost:${port}`);
console.log('  then use the https://….trycloudflare.com address it prints + /api/auto-deposit');
console.log('On Windows, allow Node.js on private networks when the firewall asks.\n');
