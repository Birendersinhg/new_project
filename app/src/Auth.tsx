import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes } from 'react';
import { User, Phone, Lock, ArrowLeft } from 'lucide-react';
import type { LucideIcon } from './types';
import { api } from './api';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { icon: LucideIcon };

function Field({ icon: Icon, ...props }: FieldProps) {
  return (
    <label className="field">
      <Icon size={20} />
      <input {...props} />
    </label>
  );
}

function OtpBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  const set = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1);
    const next = digits.slice();
    next[i] = d;
    onChange(next.join(''));
    if (d && i < 5) refs.current[i + 1]?.focus();
  };

  return (
    <div className="otp-row">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className="otp-box"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={(e) => set(i, e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus(); }}
        />
      ))}
    </div>
  );
}

const RESEND_SECONDS = 30;

type Mode = 'register' | 'login';
type Step = 'details' | 'otp' | 'password';

export default function Auth({ onAuthed }: { onAuthed: (token: string) => void }) {
  const [mode, setMode] = useState<Mode>('register');
  const [step, setStep] = useState<Step>('details');
  const [form, setForm] = useState({ name: '', mobile: '', otp: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoOtp, setDemoOtp] = useState('');
  const [ticket, setTicket] = useState('');
  const [resendIn, setResendIn] = useState(0);

  // Counts down the "Resend OTP" wait (the server also blocks resends for 30 seconds).
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const update = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => { setError(''); setForm({ ...form, [k]: e.target.value }); };
  const mobileOk = /^[6-9]\d{9}$/.test(form.mobile);

  const switchMode = (m: Mode) => { setMode(m); setStep('details'); setError(''); setForm({ ...form, otp: '', password: '', confirm: '' }); };

  // Shows the server's error message instead of throwing.
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try { await fn(); } catch (err) { setError((err as Error).message); }
    setBusy(false);
  };

  const requestOtp = () => run(async () => {
    const r = await api<{ demoOtp?: string }>('POST', '/auth/otp', { name: form.name.trim(), mobile: form.mobile });
    setDemoOtp(r.demoOtp ?? '');
    setForm((f) => ({ ...f, otp: '' }));
    setResendIn(RESEND_SECONDS);
    setStep('otp');
  });

  const sendOtp = (e: FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return setError('Please enter your name');
    if (!mobileOk) return setError('Enter a valid 10-digit mobile number');
    requestOtp();
  };

  const verifyOtp = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const r = await api<{ ticket: string }>('POST', '/auth/verify', { mobile: form.mobile, otp: form.otp });
      setTicket(r.ticket);
      setStep('password');
    });
  };

  const createAccount = (e: FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    run(async () => {
      const r = await api<{ token: string }>('POST', '/auth/register', { ticket, password: form.password });
      onAuthed(r.token);
    });
  };

  const login = (e: FormEvent) => {
    e.preventDefault();
    if (!mobileOk) return setError('Enter a valid 10-digit mobile number');
    run(async () => {
      const r = await api<{ token: string }>('POST', '/auth/login', { mobile: form.mobile, password: form.password });
      onAuthed(r.token);
    });
  };

  const titles: Record<'login' | Step, [string, string]> = {
    login: ['Welcome Back', 'Login to continue'],
    details: ['Create Account', 'Register with your name and mobile number'],
    otp: ['Verify OTP', `Enter the 6-digit code for +91 ${form.mobile}`],
    password: ['Set Password', 'Choose a password for your account'],
  };
  const [title, sub] = mode === 'login' ? titles.login : titles[step];

  return (
    <div className="phone auth">
      <div className="auth-hero">
        <h1>Kalyan</h1>
        <p>Play for fun - free points only</p>
      </div>

      <div className="auth-card">
        {mode === 'register' && step !== 'details' && (
          <button className="auth-back" onClick={() => { setError(''); setStep(step === 'otp' ? 'details' : 'otp'); }}>
            <ArrowLeft size={20} /> Back
          </button>
        )}
        <h2>{title}</h2>
        <p className="auth-sub">{sub}</p>

        {mode === 'login' && (
          <form onSubmit={login}>
            <Field icon={Phone} type="tel" inputMode="numeric" maxLength={10} placeholder="Mobile number" value={form.mobile} onChange={update('mobile')} />
            <Field icon={Lock} type="password" placeholder="Password" value={form.password} onChange={update('password')} />
            {error && <div className="auth-error">{error}</div>}
            <button className="auth-btn" disabled={busy}>LOGIN</button>
          </form>
        )}

        {mode === 'register' && step === 'details' && (
          <form onSubmit={sendOtp}>
            <Field icon={User} type="text" placeholder="Enter your name" value={form.name} onChange={update('name')} />
            <Field icon={Phone} type="tel" inputMode="numeric" maxLength={10} placeholder="Mobile number" value={form.mobile} onChange={update('mobile')} />
            {error && <div className="auth-error">{error}</div>}
            <button className="auth-btn" disabled={busy}>SEND OTP</button>
          </form>
        )}

        {mode === 'register' && step === 'otp' && (
          <form onSubmit={verifyOtp}>
            <OtpBoxes value={form.otp} onChange={(otp: string) => { setError(''); setForm({ ...form, otp }); }} />
            {demoOtp && <div className="auth-hint">Test mode: no SMS is sent yet. Use OTP <b>{demoOtp}</b>.</div>}
            {error && <div className="auth-error">{error}</div>}
            <button className="auth-btn" disabled={busy || form.otp.length < 6}>VERIFY OTP</button>
            <div className="auth-switch" style={{ marginTop: 14 }}>
              Didn&apos;t get it?{' '}
              {resendIn > 0
                ? <span>Resend in {resendIn}s</span>
                : <button type="button" disabled={busy} onClick={requestOtp}>Resend OTP</button>}
            </div>
          </form>
        )}

        {mode === 'register' && step === 'password' && (
          <form onSubmit={createAccount}>
            <Field icon={Lock} type="password" placeholder="Password (min 6 characters)" value={form.password} onChange={update('password')} />
            <Field icon={Lock} type="password" placeholder="Confirm password" value={form.confirm} onChange={update('confirm')} />
            {error && <div className="auth-error">{error}</div>}
            <button className="auth-btn" disabled={busy}>CREATE ACCOUNT</button>
          </form>
        )}

        <div className="auth-switch">
          {mode === 'register'
            ? <>Already have an account? <button onClick={() => switchMode('login')}>Login</button></>
            : <>New here? <button onClick={() => switchMode('register')}>Register</button></>}
        </div>
      </div>
    </div>
  );
}
