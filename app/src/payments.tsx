// Add money lives in ./addmoney (the two-step UPI checkout); withdraw and history are here.
import { useEffect, useState, type FormEvent } from 'react';
import { IndianRupee } from 'lucide-react';
import { PageHeader } from './screens';
import { useAppData } from './appdata';
import { api, type MyPayments } from './api';
import { amountText, cleanVpa, isValidVpa } from './upi';

export { AddMoneyScreen } from './addmoney';

const statusClass = (s: string) => (s === 'approved' || s === 'paid' ? 'ok' : s === 'rejected' ? 'bad' : 'wait');

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
