// The app's brand colours, set by the admin. They are kept on the device so the login screen and the first paint already use them.
export interface Theme { start: string; end: string; accent: string; bg: string }

export const DEFAULT_THEME: Theme = { start: '#f20000', end: '#c62828', accent: '#d32f2f', bg: '#f3f1f1' };
const STORE_KEY = 'kalyan_theme';
const HEX = /^#[0-9a-fA-F]{6}$/;

const valid = (t: Partial<Theme> | null | undefined): t is Theme =>
  !!t && HEX.test(t.start ?? '') && HEX.test(t.end ?? '') && HEX.test(t.accent ?? '') && HEX.test(t.bg ?? '');

/** Sets the CSS variables that the stylesheets use. */
export function applyTheme(theme: Partial<Theme> | null | undefined) {
  const t = valid(theme) ? theme : DEFAULT_THEME;
  const style = document.documentElement.style;
  style.setProperty('--primary-start', t.start);
  style.setProperty('--primary-end', t.end);
  style.setProperty('--accent', t.accent);
  style.setProperty('--bg', t.bg);
}

/** Applies a theme from the server and remembers it for the next start. */
export function setTheme(theme: Partial<Theme> | null | undefined) {
  applyTheme(theme);
  try { if (valid(theme)) localStorage.setItem(STORE_KEY, JSON.stringify(theme)); } catch { /* not persisted */ }
}

/** The theme saved on this device, applied before the first screen is drawn. */
export function applySavedTheme() {
  try { applyTheme(JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null')); } catch { applyTheme(null); }
}
