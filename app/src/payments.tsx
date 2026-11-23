// Add money (UPI intent, no payment gateway) and withdraw requests.
//
// A UPI link only opens the payment app; it cannot tell us whether the customer paid.
// So adding money always ends with the customer sending us the 12-digit UTR, which an
// admin checks in the dashboard before the wallet is credited. Nothing is credited here.
import { useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, IndianRupee, QrCode, ShieldCheck } from 'lucide-react';
import { PageHeader } from './screens';
import { useAppData } from './appdata';
import { api, type MyPayments } from './api';
import {
  UPI_APPS, amountText, cleanVpa, deviceOf, isValidVpa, payeeMobile, upiLink, upiLinkBasic,
} from './upi';

const QUICK = [300, 500, 1000, 2000];

/** A copy-to-clipboard row used by the manual payment fallback. */
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

const statusClass = (s: string) => (s === 'approved' || s === 'paid' ? 'ok' : s === 'rejected' ? 'bad' : 'wait');

export function AddMoneyScreen({ balance, onBack }: { balance: number; onBack: () => void }) {
  const { settings } = useAppData();
  const upi = settings.upi;
  const [amount, setAmount] = useState('');
  const [utr, setUtr] = useState('');
  const [payer, setPayer] = useState('');
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const [busy, setBusy] = useState(false);

  const amt = Math.round(Number(amount) || 0);
  const min = upi.minDeposit || 1;
  const ready = amt >= min;
  const desktop = deviceOf() === 'other';
  const pay = { vpa: upi.vpa, name: upi.name, amount: amt, note: upi.note };
  const generic = ready ? upiLink(pay, 'any') : '';
  const mobile = payeeMobile(upi.vpa);

  // The QR is desktop-only; qrcode is imported lazily so phones never download it.
  useEffect(() => {
    if (!desktop || !generic) { setQr(''); return; }
    let alive = true;
    (async () => {
      try {
        const mod = (await import('qrcode')) as unknown as {
          toDataURL?: (text: string, opts?: unknown) => Promise<string>;
          default?: { toDataURL: (text: string, opts?: unknown) => Promise<string> };
        };
        const toDataURL = mod.toDataURL ?? mod.default?.toDataURL;
        if (!toDataURL) return;
        const url = await toDataURL(generic, { width: 320, margin: 2 });
        if (alive) setQr(url);
      } catch {
        if (alive) setQr('');
      }
    })();
    return () => { alive = false; };
  }, [desktop, generic]);

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

        {!upi.enabled ? (
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

            {ready && (
              <>
                <div className="pay-amount">
                  <span>Pay exactly</span>
                  <b>{amountText(amt)}</b>
                  <small>to {upi.name} · {upi.vpa}</small>
                </div>

                <a className="auth-btn pay-primary" href={upiLink(pay, 'any')}>PAY {amountText(amt)} WITH UPI</a>
                <div className="pay-or">or open a specific app</div>
                <div className="pay-apps">
                  {UPI_APPS.map((a) => (
                    <a key={a.id} className="pay-app" href={upiLink(pay, a.id)}>{a.label}</a>
                  ))}
                </div>
                <a className="pay-alt" href={upiLinkBasic(pay, 'any')}>
                  Amount not filled in the app? <b>Open without amount</b> and type it yourself
                </a>

                {desktop && (
                  <div className="pay-qr">
                    {qr
                      ? <><img src={qr} alt="UPI QR code" /><small>Scan with any UPI app</small></>
                      : <><QrCode size={44} /><small>Preparing QR…</small></>}
                  </div>
                )}

                <div className="copy-list">
                  <CopyRow label="UPI ID" value={upi.vpa} />
                  {mobile && <CopyRow label="Mobile number" value={mobile} />}
                  <CopyRow label="Amount" value={String(amt)} />
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
          </>
        )}
      </div>
    </div>
  );
}

export function WithdrawScreen({ balance, onBack }: { balance: number; onBack: () => void }) {
  const { settings, refreshMe } = useAppData();
  const upi = settings.upi;
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'upi' | 'bank'>('upi');
  const [upiId, setUpiId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  const amt = Math.round(Number(amount) || 0);
  const min = upi.minWithdraw || 1;
  const vpa = cleanVpa(upiId);
  const badVpa = method === 'upi' && vpa.length > 0 && !isValidVpa(vpa);
  const canSubmit = !busy && amt >= min && (method === 'upi'
    ? isValidVpa(vpa)
    : accountName.trim().length > 1 && /^\d{6,20}$/.test(accountNo) && /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(ifsc.trim()));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setDone('');
    setBusy(true);
    try {
      await api('POST', '/withdrawals', {
        amount: amt,
        method,
        ...(method === 'upi' ? { upi: vpa } : { accountName: accountName.trim(), accountNo, ifsc: ifsc.trim().toUpperCase() }),
      });
      setDone(`Withdraw request sent. ${amountText(amt)} is on hold until the admin processes it.`);
      setAmount('');
      await refreshMe();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="phone sub money">
      <PageHeader title="WITHDRAW" onBack={onBack} right={<span className="ph-pill">₹{balance.toFixed(2)}</span>} />
      <div className="hub">
        <div className="balance-card">
          <span>Available Balance</span>
          <b>{amountText(balance)} <small>INR</small></b>
        </div>

        <div className="pay-note">Minimum withdrawal is ₹{min}. The amount is held from your balance as soon as you submit.</div>

        <label className="field amount-field">
          <IndianRupee size={22} />
          <input
            type="number"
            inputMode="numeric"
            min={min}
            placeholder="Enter Amount"
            value={amount}
            onChange={(e) => { setError(''); setDone(''); setAmount(e.target.value); }}
          />
        </label>

        <div className="seg">
          <button type="button" className={method === 'upi' ? 'on' : ''} onClick={() => setMethod('upi')}>UPI</button>
          <button type="button" className={method === 'bank' ? 'on' : ''} onClick={() => setMethod('bank')}>Bank</button>
        </div>

        <form onSubmit={submit}>
          {method === 'upi' ? (
            <label className="field">
              <input
                placeholder="Your UPI ID (name@bank)"
                value={upiId}
                autoCapitalize="none"
                onChange={(e) => { setError(''); setDone(''); setUpiId(e.target.value); }}
              />
            </label>
          ) : (
            <>
              <label className="field">
                <input placeholder="Account holder name" value={accountName} onChange={(e) => { setError(''); setDone(''); setAccountName(e.target.value); }} />
              </label>
              <label className="field">
                <input placeholder="Account number" inputMode="numeric" value={accountNo} onChange={(e) => { setError(''); setDone(''); setAccountNo(e.target.value.replace(/\D/g, '')); }} />
              </label>
              <label className="field">
                <input placeholder="IFSC code (e.g. HDFC0001234)" value={ifsc} autoCapitalize="characters" onChange={(e) => { setError(''); setDone(''); setIfsc(e.target.value.toUpperCase()); }} />
              </label>
            </>
          )}

          {badVpa && <div className="pay-note warn">That UPI ID does not look right. It should look like name@bank.</div>}
          {amt > 0 && amt < min && <div className="pay-note warn">Minimum withdrawal is ₹{min}.</div>}
          {amt > balance && <div className="pay-note warn">You only have ₹{balance}.</div>}

          <button className="auth-btn" disabled={!canSubmit || amt > balance}>
            {busy ? 'SUBMITTING…' : 'REQUEST WITHDRAWAL'}
          </button>
        </form>

        {error && <div className="info-box bad">{error}</div>}
        {done && <div className="info-box ok">{done}</div>}
      </div>
    </div>
  );
}

export function FundHistoryScreen({ kind, onBack }: { kind: 'deposit' | 'withdraw'; onBack: () => void }) {
  const [data, setData] = useState<MyPayments | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api<MyPayments>('GET', '/payments/mine')
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError((e as Error).message); });
    return () => { alive = false; };
  }, []);

  const rows = !data ? [] : kind === 'deposit'
    ? data.deposits.map((d) => ({ id: d.id, amount: d.amount, date: d.date, status: d.status, note: `UTR ${d.utr}${d.payer ? ` · from ${d.payer}` : ''}${d.remark ? ` · ${d.remark}` : ''}` }))
    : data.withdrawals.map((w) => ({ id: w.id, amount: w.amount, date: w.date, status: w.status, note: w.method === 'upi' ? `UPI ${w.upi ?? ''}` : `Bank ${w.accountNo ? `••${w.accountNo.slice(-4)}` : ''}` }));

  return (
    <div className="phone sub money">
      <PageHeader
        title={kind === 'deposit' ? 'ADD FUND HISTORY' : 'WITHDRAW HISTORY'}
        onBack={onBack}
      />
      <div className="hub">
        {error && <div className="info-box bad">{error}</div>}
        {!error && !data && <div className="pay-note">Loading…</div>}
        {data && rows.length === 0 && (
          <div className="empty"><h3>Nothing yet</h3><p>{kind === 'deposit' ? 'Your top-ups will appear here.' : 'Your withdrawal requests will appear here.'}</p></div>
        )}
        {rows.length > 0 && (
          <div className="hist-list">
            {rows.map((r) => (
              <div className="hist-row" key={r.id}>
                <div><b>{amountText(r.amount)}</b><small>{r.date}</small></div>
                <div className="hist-right">
                  <span className={`st ${statusClass(r.status)}`}>{r.status}</span>
                  <small>{r.note}</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
