// Checks the chart helpers: derived jodi, red jodi, week maths, slots. (Result storage is tested in server/.)
const r = await import(new URL('../src/results.ts', import.meta.url));
let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) fails++; };

check('jodi derived from both anks (128,140 -> 15)', r.jodiOf({ open: '128', close: '140' }) === '15');
check('no jodi until both sessions declared', r.jodiOf({ open: '128' }) === undefined && r.jodiOf({ open: '128', close: null }) === undefined);
const reds = Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0')).filter(r.isRedJodi);
check('red jodis are exactly the 20 standard ones', reds.join(',') === '00,05,11,16,22,27,33,38,44,49,50,55,61,66,72,77,83,88,94,99', `(${reds.length})`);
check('slots: 14 starline, 15 disawar, no repeats', r.STARLINE_SLOTS.length === 14 && new Set(r.STARLINE_SLOTS).size === 14 && r.DISAWAR_SLOTS.length === 15 && new Set(r.DISAWAR_SLOTS).size === 15);
let weekOk = true;
for (let i = 0; i < 400; i++) {
  const d = new Date(2026, 0, 1 + i), m = r.weekStart(d);
  if (m.getDay() !== 1 || (d - m) / 864e5 < 0 || (d - m) / 864e5 > 6.1) weekOk = false;
}
check('weekStart is the Monday of the week for 400 consecutive days', weekOk);
check('isoDate uses local date', r.isoDate(new Date(2026, 10, 19, 23, 59)) === '2026-11-19' && r.showDate('2026-11-19') === '19-11-2026');

console.log(fails ? `\n${fails} FAILED` : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
