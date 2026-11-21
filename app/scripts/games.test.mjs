// Exhaustive check of every game against an independent brute-force definition.
const m = await import(new URL('../src/matka.ts', import.meta.url));
let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) fails++; };
const tryBid = (kind, input) => { try { return m.bidNumbers(kind, input); } catch { return null; } };

// Independent reference: classify by counting equal digits; matka order = sort with 0 last.
const key = (d) => (d === '0' ? 10 : +d);
const canon = (s) => [...s].sort((x, y) => key(x) - key(y)).join('');
const kindOf = (s) => { const u = new Set(s).size; return u === 3 ? 'SP' : u === 2 ? 'DP' : 'TP'; };
const all3 = Array.from({ length: 1000 }, (_, i) => String(i).padStart(3, '0'));
const ref = { SP: new Set(), DP: new Set(), TP: new Set() };
for (const s of all3) ref[kindOf(s)].add(canon(s));
const ankRef = (p) => String([...p].reduce((a, c) => a + +c, 0) % 10);
const same = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

// Pana sets
for (const k of ['SP', 'DP', 'TP']) check(`${k} list = all ${ref[k].size} canonical panas`, same(m.PANAS[k], [...ref[k]]), `(${m.PANAS[k].length})`);

// Single digit: 0-9 accepted, everything else rejected
check('Single Digit accepts all 0-9', [...'0123456789'].every((d) => tryBid('single', { a: d })?.[0] === d));
check('Single Digit rejects 10, "", a, 00', ['10', '', 'a', '00'].every((v) => tryBid('single', { a: v }) === null));
check('Single Digit picker has 10 numbers', m.pickerOptions('single', 'Digit').length === 10);

// Jodi: 00-99
const jodis = Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0'));
check('Jodi accepts all 00-99', jodis.every((j) => tryBid('jodi', { a: j })?.[0] === j));
check('Jodi rejects 1, 100, ""', ['1', '100', ''].every((v) => tryBid('jodi', { a: v }) === null));
check('Jodi picker has 100 numbers', same(m.pickerOptions('jodi', 'Jodi'), jodis));

// SP / DP / TP: every 3-digit string in any order is accepted by exactly the right game
for (const [kind, k] of [['sp', 'SP'], ['dp', 'DP'], ['tp', 'TP']]) {
  let ok = true;
  for (const s of all3) {
    const r = tryBid(kind, { a: s });
    const expect = kindOf(s) === k ? canon(s) : null;
    if ((r?.[0] ?? null) !== expect) { ok = false; console.log('   mismatch', kind, s, r, expect); break; }
  }
  check(`${k} game: all 1000 three-digit inputs handled correctly (any digit order)`, ok);
  check(`${k} picker = ${ref[k].size} panas`, same(m.pickerOptions(kind, 'X Pana'), [...ref[k]]));
}

// Half Sangam A and B: every digit x every pana
const allP = [...ref.SP, ...ref.DP, ...ref.TP];
let hA = 0, hB = 0;
for (const d of '0123456789') for (const p of allP) {
  if (tryBid('half', { a: d, b: p, halfMode: 'A' })?.[0] === `${d}-${p}`) hA++;
  if (tryBid('half', { a: p, b: d, halfMode: 'B' })?.[0] === `${p}-${d}`) hB++;
}
check('Half Sangam A: all 10 x 220 combos', hA === 2200, `(${hA})`);
check('Half Sangam B: all 220 x 10 combos', hB === 2200, `(${hB})`);
check('Half Sangam rejects missing/invalid pana', tryBid('half', { a: '5', b: '12', halfMode: 'A' }) === null);
check('Half Sangam pana picker has all 220', m.pickerOptions('half', 'Close Pana').length === 220);

// Full Sangam: every pana x every pana
let full = 0;
for (const p of allP) for (const q of allP) if (tryBid('full', { a: p, b: q })?.[0] === `${p}-${q}`) full++;
check('Full Sangam: all 220 x 220 combos', full === 48400, `(${full})`);

// SP DP TP: for every ank and every non-empty combination of kinds
let sdt = true, totalPerAnk = [];
const combos = [['SP'], ['DP'], ['TP'], ['SP', 'DP'], ['SP', 'TP'], ['DP', 'TP'], ['SP', 'DP', 'TP']];
for (const d of '0123456789') {
  for (const ks of combos) {
    const expect = ks.flatMap((k) => [...ref[k]].filter((p) => ankRef(p) === d));
    if (!same(tryBid('spdptp', { a: d, kinds: ks }) ?? [], expect)) { sdt = false; console.log('   mismatch ank', d, ks); }
  }
  totalPerAnk.push(tryBid('spdptp', { a: d, kinds: ['SP', 'DP', 'TP'] }).length);
}
check('SP DP TP: every ank x every SP/DP/TP combination', sdt, `(per ank: ${totalPerAnk.join(',')})`);
check('SP DP TP: rejects no kinds selected', tryBid('spdptp', { a: '5', kinds: [] }) === null);

// Motors: every subset of digits
const subsets = Array.from({ length: 1024 }, (_, mask) => [...'0123456789'].filter((_, i) => mask & (1 << i)).join(''));
let spm = true, dpm = true;
for (const s of subsets) {
  const set = new Set(s);
  const expSP = [...ref.SP].filter((p) => [...p].every((c) => set.has(c)));
  const expDP = [...ref.DP].filter((p) => [...p].every((c) => set.has(c)));
  const rs = tryBid('spmotor', { a: s }), rd = tryBid('dpmotor', { a: s });
  if (s.length >= 4 ? !same(rs ?? [], expSP) : rs !== null) { spm = false; console.log('   sp motor', s); }
  if (s.length >= 3 ? !same(rd ?? [], expDP) : rd !== null) { dpm = false; console.log('   dp motor', s); }
}
check('SP Motor: all 1024 digit sets (4+ digits -> every SP from them)', spm, `(all 10 digits -> ${tryBid('spmotor', { a: '0123456789' }).length})`);
check('DP Motor: all 1024 digit sets (3+ digits -> every DP from them)', dpm, `(all 10 digits -> ${tryBid('dpmotor', { a: '0123456789' }).length})`);
check('Motor ignores duplicate digits', same(tryBid('spmotor', { a: '11223344' }), tryBid('spmotor', { a: '1234' })));

console.log(fails ? `\n${fails} FAILED` : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
