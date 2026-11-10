import type { FormEvent } from 'react';
import { Dices } from 'lucide-react';
import { Field } from './ui';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const submit = (e: FormEvent) => { e.preventDefault(); onLogin(); };
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-top">
          <h5>Welcome Back !</h5>
          <p>Sign in to continue to Admin Console.</p>
          <div className="login-logo"><Dices size={30} /></div>
        </div>
        <form className="login-body" onSubmit={submit}>
          <Field label="Email"><input className="input" type="email" placeholder="Enter email" defaultValue="admin@example.com" /></Field>
          <Field label="Password"><input className="input" type="password" placeholder="Enter password" defaultValue="password" /></Field>
          <button className="btn block" type="submit" style={{ padding: 11, marginTop: 6 }}>Log In</button>
        </form>
      </div>
    </div>
  );
}
