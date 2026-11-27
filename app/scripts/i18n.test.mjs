// Checks the screen translations: every language has every entry, placeholders match, and every text the screens translate has an entry.
import { readFileSync, readdirSync } from 'node:fs';
import { DICTIONARY, LANGUAGES } from '../src/translations.ts';

let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) fails++; };

const langs = ['hi', 'ta', 'te', 'kn'];
check('five languages are offered, English first', LANGUAGES.length === 5 && LANGUAGES[0].code === 'en' && LANGUAGES.map((l) => l.code).join() === 'en,hi,ta,te,kn');
const sizes = langs.map((l) => DICTIONARY[l].size);
check('every language has the same number of entries', new Set(sizes).size === 1 && sizes[0] > 150, sizes.join('/'));

const holes = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join();
let badHoles = [];
let empty = [];
for (const [key, hi] of DICTIONARY.hi) {
  for (const l of langs) {
    const v = DICTIONARY[l].get(key);
    if (!v || !v.trim()) empty.push(`${l}:${key}`);
    else if (holes(v) !== holes(key)) badHoles.push(`${l}:${key}`);
  }
}
check('no empty translations', empty.length === 0, empty.slice(0, 5).join(' | '));
check('placeholders like {n} are kept in every language', badHoles.length === 0, badHoles.slice(0, 5).join(' | '));

// Each translation must really be in its own script (Devanagari, Tamil, Telugu, Kannada), not left in English.
const script = { hi: /[ऀ-ॿ]/, ta: /[஀-௿]/, te: /[ఀ-౿]/, kn: /[ಀ-೿]/ };
const KEEP_LATIN = new Set(['ok', 'sorry !']);
const wrongScript = [];
for (const l of langs) for (const [key, v] of DICTIONARY[l]) if (!script[l].test(v) && !KEEP_LATIN.has(key)) wrongScript.push(`${l}:${key}`);
check('every translation is written in its own script', wrongScript.length === 0, wrongScript.slice(0, 5).join(' | '));

// Texts the screens translate: t('...'), t("..."), plus headings and labels written as plain literals.
const files = readdirSync('src').filter((f) => /\.tsx$/.test(f) && !['quiz.tsx', 'payments.tsx', 'addmoney.tsx'].includes(f));
const wanted = new Map();
const add = (text, file) => { if (text && /[A-Za-z]/.test(text)) wanted.set(text.toLowerCase(), `${file}: ${text}`); };
for (const f of files) {
  const src = readFileSync(`src/${f}`, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) add(m[1].replace(/\\'/g, "'"), f);
  for (const m of src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) add(m[1], f);
  for (const m of src.matchAll(/\b(?:title|subtitle)="([^"{}]+)"/g)) add(m[1], f);
  for (const m of src.matchAll(/\b(?:label|title|desc|name):\s*'((?:[^'\\]|\\.)*)'/g)) add(m[1].replace(/\\'/g, "'"), f);
}
// Literals picked up by the patterns above that are not screen text (market names, internal ids, class names...).
// 'SP DP TP' is a set of standard codes (Single, Double, Triple Pana) and stays as written in every language.
const SKIP = new Set(['kalyan', 'home', 'passbook', 'sp dp tp']);
const missing = [];
for (const [key, where] of wanted) if (!DICTIONARY.hi.has(key) && !SKIP.has(key)) missing.push(where);
check('every translated or headed text has an entry', missing.length === 0, '\n      ' + missing.join('\n      '));

console.log(fails ? `\n${fails} FAILED` : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
