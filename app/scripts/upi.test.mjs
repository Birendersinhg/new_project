// Unit checks for the UPI link builder.
const u = await import(new URL('../src/upi.ts', import.meta.url));
let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) fails++; };

const pay = { vpa: 'shop@okhdfc', name: 'My Shop', amount: 499, note: 'Order 1234', txnRef: '1234' };
const q = u.buildQuery(pay);

// --- query string built by hand ---
check('keeps "@" literal in the UPI ID', q.includes('pa=shop@okhdfc') && !q.includes('%40'), q);
check('amount has 2 decimals and currency is INR', q.includes('am=499.00') && q.includes('cu=INR'));
check('encodes spaces as %20, never "+"', u.buildQuery({ vpa: 'shop@okhdfc', name: 'My Shop' }).includes('pn=My%20Shop'));
check('never uses "+" anywhere', !q.includes('+') && !u.buildQuery({ vpa: 'a@b', name: 'x y z', note: 'two words' }).includes('+'));
check('key order is pa, pn, am, cu, tn, tr', q.startsWith('pa=') && q.indexOf('&pn=') < q.indexOf('&am=') && q.indexOf('&cu=') < q.indexOf('&tn=') && q.indexOf('&tn=') < q.indexOf('&tr='));

// --- optional fields are omitted, not left empty ---
const bare = u.buildQuery({ vpa: 'shop@okhdfc', name: 'My Shop' });
check('omits am and cu when no amount is given', !bare.includes('am=') && !bare.includes('cu='));
check('omits tn when no note is given', !bare.includes('tn='));
check('omits tr when no reference is given', !bare.includes('tr='));
check('ignores a zero/negative/NaN amount', ['am=', 'cu='].every((k) => !u.buildQuery({ vpa: 'a@b', name: 'n', amount: 0 }).includes(k))
  && !u.buildQuery({ vpa: 'a@b', name: 'n', amount: -5 }).includes('am=')
  && !u.buildQuery({ vpa: 'a@b', name: 'n', amount: NaN }).includes('am='));

// --- VPA cleaning and validation ---
check('cleans spaces and invisible characters from a pasted ID', u.cleanVpa(' shop@okhdfc\n') === 'shop@okhdfc' && u.cleanVpa('shop\u00a0@okhdfc') === 'shop@okhdfc');
check('accepts name@handle IDs', ['shop@okhdfc', 'a.b-c_1@ybl', '9876543210@paytm'].every(u.isValidVpa));
check('rejects bad UPI IDs', ['', 'shop', 'shop@', '@okhdfc', 'shop@ok hdfc', 'sh op@okhdfc', 'shop@@okhdfc'].every((v) => !u.isValidVpa(v)));
check('cleaned ID is what goes into the link', u.buildQuery({ vpa: ' shop@okhdfc ', name: 'My Shop' }).startsWith('pa=shop@okhdfc&'));

// --- generic link ---
check('generic link is upi://pay?...', u.upiLink(pay, 'any', 'Mozilla/5.0 (Windows NT 10.0)').startsWith('upi://pay?pa=shop@okhdfc'));

// --- device specific links ---
const androidUa = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36';
const iosUa = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15';
const intents = { gpay: 'com.google.android.apps.nbu.paisa.user', paytm: 'net.one97.paytm', phonepe: 'com.phonepe.app' };
for (const [app, pkg] of Object.entries(intents)) {
  const link = u.upiLink(pay, app, androidUa);
  check(`android ${app}: intent:// link with the right package`, link.startsWith(`intent://pay?pa=shop@okhdfc`) && link.endsWith(`#Intent;scheme=upi;package=${pkg};end`), link.slice(-60));
  const ios = u.upiLink(pay, app, iosUa);
  check(`ios ${app}: ${u.IOS_SCHEME[app]} scheme`, ios.startsWith(`${u.IOS_SCHEME[app]}?pa=shop@okhdfc`) && !ios.includes('intent://'));
}
check('desktop falls back to the generic upi:// link for every app', Object.keys(intents).every((a) => u.upiLink(pay, a, 'Mozilla/5.0 (X11; Linux)').startsWith('upi://pay?')));
check('device detection', u.deviceOf(androidUa) === 'android' && u.deviceOf(iosUa) === 'ios' && u.deviceOf('curl/8') === 'other');

// --- payee-only variant ---
const basic = u.upiLinkBasic(pay, 'any');
check('payee-only link has pa and pn only', basic.includes('pa=shop@okhdfc') && basic.includes('pn=My%20Shop') && !basic.includes('am=') && !basic.includes('cu=') && !basic.includes('tn=') && !basic.includes('tr='));
check('payee-only android link keeps the package', u.upiLinkBasic(pay, 'gpay', androidUa).includes('package=com.google.android.apps.nbu.paisa.user'));

// --- number@bank IDs can be paid by mobile number ---
check('finds the mobile number behind 9876543210@paytm', u.payeeMobile('9876543210@paytm') === '9876543210');
check('no mobile number behind a normal ID', u.payeeMobile('shop@okhdfc') === '');
check('amount text always shows 2 decimals', u.amountText(499) === '₹499.00' && u.amountText(0.5) === '₹0.50');

console.log(fails ? `\n${fails} FAILED` : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
