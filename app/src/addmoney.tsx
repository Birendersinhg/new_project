// Add money: a two-step UPI checkout, no payment gateway.
//
// Step 1 is only the amount. Step 2 is the payment page: payee, amount in words, a
// per-attempt reference, a QR that carries the exact amount, and direct app buttons.
// A UPI link can never confirm a payment, so the screen still ends with the customer
// sending the 12-digit UTR, which an admin checks before the wallet is credited.
import { useEffect, useState, type FormEvent } from 'react';
import { Check, CheckCircle2, Copy, Info, IndianRupee, QrCode, ShieldCheck } from 'lucide-react';
import { PageHeader } from './screens';
import { useAppData } from './appdata';
import { api } from './api';
import {
  UPI_APPS, amountInWords, amountText, payeeMobile, paymentRef, upiLink, upiLinkBasic,
} from './upi';

const QUICK = [300, 500, 1000, 2000];

/** Icons cycled over the admin's trust messages so each line gets a small badge. */
const TRUST_ICONS = [ShieldCheck, Info, CheckCircle2];

type Trust = { title: string; items: string[] };

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="copy-row">
      <div><small>{label}</small><b>{value}</b></div>
      <button type="button" className="copy-btn" onClick={copy}>
        {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
      </button>
    </div>
  );
}

function TrustCard({ trust }: { trust: Trust }) {
  if (trust.items.length === 0) return null;
  return (
    <div className="trust-card">
      {trust.title && (
        <div className="trust-head">
          <ShieldCheck size={16} />
          <b>{trust.title}</b>
        </div>
      )}
      <ul>
        {trust.items.map((line, i) => {
          const Icon = TRUST_ICONS[i % TRUST_ICONS.length];
          return (
            <li key={`${i}-${line}`}>
              <span className="trust-ic"><Icon size={13} /></span>
              <span>{line}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AddMoneyScreen({ balance, onBack }: { balance: number; onBack: () => void }) {
  const { settings } = useAppData();
  const dbUpi = settings.upi;
  const trust = settings.trust ?? { title: '', items: [] };
  const [amount, setAmount] = useState('');
  const [stage, setStage] = useState<'amount' | 'pay'>('amount');
  const [utr, setUtr] = useState('');
  const [payer, setPayer] = useState('');
  const [ref, setRef] = useState(paymentRef);
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const [busy, setBusy] = useState(false);

  const amt = Math.round(Number(amount) || 0);
  const min = dbUpi.minDeposit || 1;
  const ready = amt >= min;
  const mobile = dbUpi.mobile || payeeMobile(dbUpi.vpa);
  const pay = { vpa: dbUpi.vpa, name: dbUpi.name, amount: amt, note: dbUpi.note, txnRef: ref };
  const generic = ready ? upiLink(pay, 'any') : '';

  // qrcode is imported lazily: only the payment page needs it.
  useEffect(() => {
    if (!generic) { setQr(''); return; }
    let alive = true;
    (async () => {
      try {
        const mod = (await import('qrcode')) as unknown as {
          toDataURL?: (text: string, opts?: unknown) => Promise<string>;
          default?: { toDataURL: (text: string, opts?: unknown) => Promise<string> };
        };
        const toDataURL = mod.toDataURL ?? mod.default?.toDataURL;
        if (!toDataURL) return;
        const url = await toDataURL(generic, { width: 520, margin: 1 });
        if (alive) setQr(url);
      } catch {
        if (alive) setQr('');
      }
    })();
    return () => { alive = false; };
  }, [generic]);

  const open = () => {
    setError('');
    setSent('');
    setRef(paymentRef());
    setStage('pay');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSent('');
    setBusy(true);
    try {
      await api('POST', '/payments/upi', { amount: amt, utr: utr.trim(), payer: payer.trim() });
      setSent(`Submitted. We will credit ${amountText(amt)} after the admin verifies UTR ${utr.trim()}.`);
      setUtr('');
      setPayer('');
      setAmount('');
      setStage('amount');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="phone sub money">
      <PageHeader title="ADD MONEY" onBack={onBack} right={<span className="ph-pill">₹{balance.toFixed(2)}</span>} />
      <div className="hub">
        <div className="balance-card">
          <span>Available Balance</span>
          <b>{amountText(balance)} <small>INR</small></b>
        </div>

        {!dbUpi.enabled ? (
          <div className="info-box">UPI payments are not set up yet. Please contact support.</div>
        ) : stage === 'amount' ? (
          <>
            <label className="field amount-field">
              <IndianRupee size={22} />
              <input
                type="number"
                inputMode="numeric"
                min={min}
                placeholder={`Enter Amount (min ₹${min})`}
                value={amount}
                onChange={(e) => { setError(''); setSent(''); setAmount(e.target.value); }}
              />
            </label>
            <div className="quick-row">
              {QUICK.map((q) => <button key={q} type="button" onClick={() => { setError(''); setSent(''); setAmount(String(q)); }}>₹{q}</button>)}
            </div>

            {amt > 0 && amt < min && <div className="pay-note warn">Minimum deposit is ₹{min}.</div>}

            <button type="button" className="auth-btn pay-proceed" disabled={!ready} onClick={open}>
              <ShieldCheck size={17} /> PROCEED SECURELY
            </button>

            <TrustCard trust={trust} />
            <div className="pay-note">
              <Info size={14} />
              <span>Next you get the payee name, the exact amount and a QR / UPI app button — then you send us the 12-digit UTR.</span>
            </div>
          </>
        ) : (
          <>
            <button type="button" className="pay-back" onClick={() => setStage('amount')}>← Change amount</button>

            <div className="payee">
              <span className="payee-av"><ShieldCheck size={20} /></span>
              <b>{dbUpi.name} <CheckCircle2 size={14} /></b>
              <small>Verified payee · {mobile || dbUpi.vpa}</small>
            </div>

            <div className="pay-fig"><span>₹</span><b>{amt}</b></div>
            <div className="pay-words">{amountInWords(amt)}</div>
            <div className="ref-pill">Ref {ref}</div>

            <div className="qr-card">
              <div className="qr-head">
                <b>Scan QR to Pay</b>
                <span>₹{amt.toFixed(2)}</span>
              </div>
              {qr
                ? <img src={qr} alt={`UPI QR code to pay ${amountText(amt)}`} />
                : <div className="qr-wait"><QrCode size={40} /><small>Preparing QR…</small></div>}
              <small className="qr-foot">Scan with any UPI app — from this phone or another one. The amount is already filled in.</small>
            </div>

            <div className="apps-title">PAY WITH DIRECT UPI APPS</div>
            <div className="pay-apps">
              {UPI_APPS.map((a) => (
                <a key={a.id} className="pay-app" href={upiLink(pay, a.id)}>{a.label}</a>
              ))}
            </div>

            <a className="auth-btn pay-primary" href={upiLink(pay, 'any')}>PAY {amountText(amt)} WITH UPI</a>
            <a className="pay-alt" href={upiLinkBasic(pay, 'any')}>
              Amount not filled in the app? <b>Open without amount</b> and type it yourself
            </a>

            {/* One <span>: .pay-note is a flex row, so bare <b> tags would each become a column. */}
            <div className="pay-note">
              <Info size={14} />
              <span>
                A <b>Payment Alert</b> about a UPI Risk Policy check is your bank's safety check on a new payee — not a
                failed payment. In that alert tap <b>Pay via Mobile Number</b> and enter{' '}
                {mobile || dbUpi.vpa}, or scan the QR from another phone. Every route reaches {dbUpi.name}.
              </span>
            </div>

            <TrustCard trust={trust} />

            <div className="copy-list">
              {/* Customers pay the number; the UPI address is only the technical target of the link. */}
              {mobile
                ? <CopyRow label="Mobile number" value={mobile} />
                : <CopyRow label="UPI ID" value={dbUpi.vpa} />}
              <CopyRow label="Amount" value={String(amt)} />
              <CopyRow label="Reference" value={ref} />
            </div>

            <form onSubmit={submit}>
              <label className="field">
                <input
                  placeholder="Your UPI ID or mobile number (the one you paid from)"
                  value={payer}
                  autoCapitalize="none"
                  onChange={(e) => { setError(''); setSent(''); setPayer(e.target.value); }}
                />
              </label>
              <label className="field">
                <input
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="12-digit UTR / reference number"
                  value={utr}
                  onChange={(e) => { setError(''); setSent(''); setUtr(e.target.value.replace(/\D/g, '')); }}
                />
              </label>
              <button className="auth-btn" disabled={busy || utr.length !== 12 || !payer.trim()}>
                {busy ? 'SUBMITTING…' : 'I HAVE PAID — SUBMIT UTR'}
              </button>
            </form>
            <div className="pay-note">
              <ShieldCheck size={14} /> Open your UPI app → payment history → copy the 12-digit UTR.
              We ask for the UPI ID / number you paid from so the admin can match your payment before crediting.
            </div>
          </>
        )}

        {error && <div className="info-box bad">{error}</div>}
        {sent && <div className="info-box ok">{sent}</div>}
      </div>
    </div>
  );
}
