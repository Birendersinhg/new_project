import { useState, type FormEvent } from 'react';
import { Dices } from 'lucide-react';
import { Field } from './ui';
import { api } from './api';

export default function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<{ token: string }>('POST', '/admin/login', { email, password });
      onLogin(r.token);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-top">
          <h5>Welcome Back !</h5>
          <p>Sign in to continue to Admin Console.</p>
          <div className="login-logo"><Dices size={30} /></div>
        </div>
        <form className="login-body" onSubmit={submit}>
          <Field label="Email"><input className="input" type="email" placeholder="Enter email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          <Field label="Password"><input className="input" type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
          {error && <div style={{ color: 'var(--danger)', fontSize: '.85rem', marginBottom: 10 }}>{error}</div>}
          <button className="btn block" type="submit" disabled={busy} style={{ padding: 11, marginTop: 6 }}>{busy ? 'Signing in...' : 'Log In'}</button>
        </form>
      </div>
    </div>
  );
}
