// Language button for the home header (next to the bell) and the list it opens. The popup is always in English.
import { useState } from 'react';
import { Check, Languages, X } from 'lucide-react';
import { useLang } from './i18n';
import { LANGUAGES } from './translations';

export function LanguageButton() {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="icon-btn" aria-label={t('Language')} onClick={() => setOpen(true)}><Languages size={30} /></button>
      {open && (
        <div className="overlay center" onClick={() => setOpen(false)}>
          <div className="modal lang-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <Languages size={30} />
              <h3>Choose Language</h3>
              <button className="modal-x" onClick={() => setOpen(false)} aria-label="Close"><X size={22} /></button>
            </div>
            <div className="lang-list">
            {LANGUAGES.map(({ code, label }) => (
              <button key={code} className={`modal-row lang-row${code === lang ? ' on' : ''}`} onClick={() => { setLang(code); setOpen(false); }}>
                <b>{label}</b>
                {code === lang && <Check size={22} />}
              </button>
            ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
