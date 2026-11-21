// OTP provider tests against a fake Message Central API (no real SMS or credits used).
import { createOtpProvider, OtpError } from '../src/otp.ts';

let fails = 0;
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) fails++;
};
const rejects = async (p: Promise<unknown>, status: number) => {
  try { await p; return false; } catch (e) { return e instanceof OtpError && e.status === status; }
};

// ---------- fake Message Central ----------
const calls: { url: URL; method: string; auth?: string }[] = [];
let tokenNo = 0;
let expireTokenOnce = false;
const issued = new Map<string, { mobile: string; code: string; used: boolean; expired?: boolean }>();
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input));
  const auth = (init?.headers as Record<string, string> | undefined)?.authToken;
  calls.push({ url, method: init?.method ?? 'GET', auth });
  const p = url.searchParams;
  if (url.pathname === '/auth/v1/authentication/token') {
    const ok = p.get('customerId') === 'C-123' && p.get('key') === Buffer.from('pw-secret').toString('base64');
    return ok ? json(200, { status: 200, token: `tok-${++tokenNo}` }) : json(401, { status: 401 });
  }
  if (!auth?.startsWith('tok-')) return json(401, {});
  if (expireTokenOnce) { expireTokenOnce = false; return json(401, {}); }
  if (url.pathname === '/verification/v3/send') {
    if (p.get('mobileNumber') === '9000000506') return json(400, { responseCode: 506, message: 'REQUEST_ALREADY_EXISTS' });
    const id = String(1000 + issued.size);
    issued.set(id, { mobile: p.get('mobileNumber')!, code: '654321', used: false, expired: p.get('mobileNumber') === '9000000705' });
    return json(200, { responseCode: 200, message: 'SUCCESS', data: { verificationId: id, mobileNumber: p.get('mobileNumber'), responseCode: '200', timeout: '60' } });
  }
  if (url.pathname === '/verification/v3/validateOtp') {
    const v = issued.get(p.get('verificationId')!);
    if (!v) return json(400, { responseCode: 700, message: 'VERIFICATION_FAILED' });
    if (v.expired) return json(400, { responseCode: 705, message: 'VERIFICATION_EXPIRED' });
    if (v.used) return json(400, { responseCode: 703, message: 'ALREADY_VERIFIED' });
    if (p.get('code') !== v.code) return json(400, { responseCode: 702, message: 'WRONG_OTP_PROVIDED' });
    v.used = true;
    return json(200, { responseCode: 200, message: 'SUCCESS', data: { verificationStatus: 'VERIFICATION_COMPLETED', responseCode: '200' } });
  }
  return json(404, {});
}) as typeof fetch;

// ---------- tests ----------
check('no keys -> test mode', createOtpProvider({}).demo === true);
const demo = createOtpProvider({});
check('test mode: 123456 verifies', await demo.verify('9876543210', '123456', await demo.send('9876543210')));
check('test mode: other code fails', !(await demo.verify('9876543210', '111111', '123456')));

const mc = createOtpProvider({ MC_CUSTOMER_ID: 'C-123', MC_PASSWORD: 'pw-secret' });
check('keys set -> real SMS mode', mc.demo === false);
const ref = await mc.send('9876543210');
const send = calls.find((c) => c.url.pathname === '/verification/v3/send')!;
check('logs in with base64 password, then sends', calls[0].url.pathname === '/auth/v1/authentication/token' && send.method === 'POST' && send.auth === 'tok-1');
check('send uses India code, SMS flow, 6-digit OTP', send.url.searchParams.get('countryCode') === '91' && send.url.searchParams.get('flowType') === 'SMS' && send.url.searchParams.get('otpLength') === '6');
check('wrong code -> false', (await mc.verify('9876543210', '000000', ref)) === false);
check('right code -> true', (await mc.verify('9876543210', '654321', ref)) === true);
check('token is reused (one login)', calls.filter((c) => c.url.pathname.startsWith('/auth')).length === 1);
check('already-used code -> error', await rejects(mc.verify('9876543210', '654321', ref), 400));
check('expired code -> error', await rejects(mc.send('9000000705').then((r) => mc.verify('9000000705', '654321', r)), 400));
check('resend too fast -> 429', await rejects(mc.send('9000000506'), 429));
expireTokenOnce = true;
await mc.send('9123456789');
check('expired token is renewed automatically', tokenNo === 2);
const before = calls.length;
const fixed = createOtpProvider({ MC_CUSTOMER_ID: 'C-123', MC_AUTH_TOKEN: 'tok-dashboard' });
await fixed.send('9876543210');
check('dashboard Auth Token used directly (no login call)', !fixed.demo && calls.length === before + 1 && calls[before].auth === 'tok-dashboard');
check('rejected dashboard token -> clear error', await rejects(createOtpProvider({ MC_CUSTOMER_ID: 'C-123', MC_AUTH_TOKEN: 'bad' }).send('9876543210'), 502));
check('customer ID alone -> stays in test mode', createOtpProvider({ MC_CUSTOMER_ID: 'C-123' }).demo);
check('bad keys -> clear error', await rejects(createOtpProvider({ MC_CUSTOMER_ID: 'C-123', MC_PASSWORD: 'wrong' }).send('9876543210'), 502));

console.log(fails ? `\n${fails} FAILED` : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
