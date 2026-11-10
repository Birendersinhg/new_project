import { useRef, useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes } from 'react';
import { User, Phone, Lock, ArrowLeft } from 'lucide-react';
import type { LucideIcon } from './types';
import { getUsers, saveUser, hashPassword } from './storage';

const DEMO_OTP = '123456';

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

type Mode = 'register' | 'login';
type Step = 'details' | 'otp' | 'password';

export default function Auth({ onAuthed }: { onAuthed: (mobile: string) => void }) {
  const [mode, setMode] = useState<Mode>('register');
  const [step, setStep] = useState<Step>('details');
  const [form, setForm] = useState({ name: '', mobile: '', otp: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => { setError(''); setForm({ ...form, [k]: e.target.value }); };
  const mobileOk = /^[6-9]\d{9}$/.test(form.mobile);

  const switchMode = (m: Mode) => { setMode(m); setStep('details'); setError(''); setForm({ ...form, otp: '', password: '', confirm: '' }); };

  const sendOtp = (e: FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return setError('Please enter your name');
    if (!mobileOk) return setError('Enter a valid 10-digit mobile number');
    if (getUsers()[form.mobile]) return setError('This number is already registered. Please login.');
    setStep('otp');
  };

  const verifyOtp = (e: FormEvent) => {
    e.preventDefault();
    if (form.otp !== DEMO_OTP) return setError('Wrong OTP. Please try again.');
    setError('');
    setStep('password');
  };

  const createAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    setBusy(true);
    const hash = await hashPassword(form.mobile, form.password);
    saveUser(form.mobile, { name: form.name.trim(), hash });
    setBusy(false);
    onAuthed(form.mobile);
  };

  const login = async (e: FormEvent) => {
    e.preventDefault();
    if (!mobileOk) return setError('Enter a valid 10-digit mobile number');
    const user = getUsers()[form.mobile];
    setBusy(true);
    const hash = await hashPassword(form.mobile, form.password);
    setBusy(false);
    if (!user || user.hash !== hash) return setError('Incorrect mobile number or password');
    onAuthed(form.mobile);
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
            <button className="auth-btn">SEND OTP</button>
          </form>
        )}

        {mode === 'register' && step === 'otp' && (
          <form onSubmit={verifyOtp}>
            <OtpBoxes value={form.otp} onChange={(otp: string) => { setError(''); setForm({ ...form, otp }); }} />
            <div className="auth-hint">Demo mode: no SMS is sent. Use OTP <b>{DEMO_OTP}</b>.</div>
            {error && <div className="auth-error">{error}</div>}
            <button className="auth-btn" disabled={form.otp.length < 6}>VERIFY OTP</button>
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
