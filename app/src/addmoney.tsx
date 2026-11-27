// Add money: the amount, then a payment sheet on top of it.
//
// The sheet is the second step: it opens as soon as the customer taps PAY NOW. The admin picks
// in Main Settings what it contains — only the QR code, or only a button that opens a UPI app.
// A UPI payment can never be confirmed by a link, so the customer still sends the 12-digit UTR
// and an admin checks it before the wallet is credited.
import { useEffect, useState, type FormEvent } from 'react';
import { Download, IndianRupee, QrCode, ShieldCheck, X } from 'lucide-react';
import { PageHeader } from './screens';
import { useAppData } from './appdata';
import { api } from './api';
import { amountText, paymentRef, upiLink } from './upi';

const QUICK = [300, 500, 1000, 2000];

export function AddMoneyScreen({ balance, onBack }: { balance: number; onBack: () => void }) {
  const { settings } = useAppData();
  const dbUpi = settings.upi;
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
  const pay = { vpa: dbUpi.vpa, name: dbUpi.name, amount: amt, note: dbUpi.note, txnRef: ref };

  // The QR carries the exact amount the customer typed, so it is built for each payment.
  useEffect(() => {
    if (stage !== 'pay' || dbUpi.type !== 'qr' || !ready) { setQr(''); return; }
    let alive = true;
    (async () => {
      try {
        const mod = (await import('qrcode')) as unknown as {
          toDataURL?: (text: string, opts?: unknown) => Promise<string>;
          default?: { toDataURL: (text: string, opts?: unknown) => Promise<string> };
        };
        const toDataURL = mod.toDataURL ?? mod.default?.toDataURL;
        if (!toDataURL) return;
        const url = await toDataURL(upiLink(pay, 'any'), { width: 520, margin: 1 });
        if (alive) setQr(url);
      } catch {
        if (alive) setQr('');
      }
    })();
    return () => { alive = false; };
    // pay changes on every render; the values below are what the QR actually depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, dbUpi.type, ready, amt, ref]);

  const open = () => {
    setError('');
    setSent('');
    setRef(paymentRef());
    setStage('pay');
  };

  const downloadQr = () => {
    if (!qr) return;
    const a = document.createElement('a');
    a.href = qr;
    a.download = `UPI-QR-${amt}.png`;
    a.click();
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
        ) : (
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
              <ShieldCheck size={17} /> PAY NOW
            </button>
          </>
        )}

        {error && <div className="info-box bad">{error}</div>}
        {sent && <div className="info-box ok">{sent}</div>}
      </div>

      {stage === 'pay' && (
        <div className="pay-sheet" role="dialog" aria-modal="true" aria-label={dbUpi.type === 'qr' ? 'Scan QR to pay' : 'Pay with UPI'}>
          <div className="pay-sheet-card">
            <button type="button" className="pay-sheet-x" onClick={() => setStage('amount')} aria-label="Close">
              <X size={20} />
            </button>

            <div className="pay-brand">
              <span className="pay-brand-av"><ShieldCheck size={20} /></span>
              <div>
                <b>{dbUpi.name}</b>
                <small>Scan &amp; pay instantly</small>
              </div>
              <span className="pay-secure">SECURE</span>
            </div>

            {dbUpi.type === 'qr' ? (
              <>
                <h2>Scan QR to Pay</h2>
                <div className="pay-sheet-amt">Amount to pay: <b>{amountText(amt)}</b></div>
                <div className="pay-qr-wrap">
                  {qr
                    ? <img src={qr} alt={`UPI QR code to pay ${amountText(amt)}`} />
                    : <div className="qr-wait"><QrCode size={40} /><small>Preparing QR…</small></div>}
                </div>
                <button type="button" className="pay-dl" disabled={!qr} onClick={downloadQr}>
                  <Download size={16} /> Download QR
                </button>
                <div className="pay-note">
                  <QrCode size={14} />
                  <span>Scan with any UPI app. The amount {amountText(amt)} is already filled in.</span>
                </div>
              </>
            ) : (
              <>
                <h2>Pay with UPI</h2>
                <a className="auth-btn pay-primary" href={upiLink(pay, 'any')}>PAY {amountText(amt)} WITH UPI</a>
                <a className="pay-alt" href={upiLink({ vpa: dbUpi.vpa, name: dbUpi.name }, 'any')}>
                  Amount not filled in the app? <b>Open without amount</b> and type it yourself
                </a>
              </>
            )}

            <form className="pay-sheet-form" onSubmit={submit}>
              <label className="field">
                <input
                  placeholder="UPI ID or mobile number you paid from"
                  value={payer}
                  autoCapitalize="none"
                  onChange={(e) => { setError(''); setPayer(e.target.value); }}
                />
              </label>
              <label className="field">
                <input
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="12-digit UTR / reference number"
                  value={utr}
                  onChange={(e) => { setError(''); setUtr(e.target.value.replace(/\D/g, '')); }}
                />
              </label>
              <button className="auth-btn" disabled={busy || utr.length !== 12 || !payer.trim()}>
                {busy ? 'SUBMITTING…' : 'I HAVE PAID — SUBMIT UTR'}
              </button>
            </form>
            {error && <div className="info-box bad">{error}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
