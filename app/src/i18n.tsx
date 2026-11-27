// Chosen language for the app's screen text. The choice is kept on the device.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { DICTIONARY, type Lang } from './translations';

const STORE_KEY = 'kalyan_lang';
const CODES: Lang[] = ['en', 'hi', 'ta', 'te', 'kn'];

function savedLang(): Lang {
  try {
    const v = localStorage.getItem(STORE_KEY);
    return CODES.includes(v as Lang) ? (v as Lang) : 'en';
  } catch {
    return 'en';
  }
}

export type Translate = (text: string, vars?: Record<string, string | number>) => string;

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Translate;
}

const LangContext = createContext<LangState>({ lang: 'en', setLang: () => {}, t: (text, vars) => fill(text, vars) });

/** Replaces {name} placeholders. */
const fill = (text: string, vars?: Record<string, string | number>) =>
  vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(savedLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORE_KEY, l); } catch { /* not persisted */ }
  }, []);

  const value = useMemo<LangState>(() => {
    const dict = lang === 'en' ? null : DICTIONARY[lang];
    // Text without a translation (market names, admin messages, anything new) is shown unchanged.
    const t: Translate = (text, vars) => fill(dict?.get(text.toLowerCase()) ?? text, vars);
    return { lang, setLang, t };
  }, [lang, setLang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
/** The translate function: t('Bid History'), t('Min {n}', { n: 10 }). */
export const useT = () => useContext(LangContext).t;
