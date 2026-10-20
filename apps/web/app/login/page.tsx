'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, User } from '@/lib/api';
import { Logo } from '@/components/Logo';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const { token, user } = await api<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      localStorage.setItem('userToken', token);
      localStorage.setItem('userId', user.id);
      router.push(user.role === 'ADMIN' ? '/admin' : '/dashboard');
    } catch {
      setErr('E-mail ou senha inválidos.');
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-frame">
        <nav className="nav">
          <a href="/"><Logo /></a>
          <a href="/" className="nav-hide" style={{ font: '500 15.5px var(--f-body)', color: 'var(--txt-2)', paddingRight: 16 }}>Ainda não sou cliente</a>
        </nav>
        <main className="auth-main">
          <div className="auth-box">
            <h1 className="display"><span className="accent" style={{ fontSize: '1.14em' }}>Entrar</span></h1>
            <form onSubmit={submit} style={{ width: '100%', display: 'grid', gap: 16, justifyItems: 'stretch' }}>
              <label className="auth-mobile-label" htmlFor="email">E-mail cadastrado</label>
              <div className="auth-input">
                <input id="email" type="email" required autoFocus placeholder="E-mail cadastrado" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <label className="auth-mobile-label" htmlFor="password">Senha</label>
              <div className="auth-input">
                <input id="password" type="password" required placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button className="btn-dark" disabled={busy}>{busy ? 'Entrando...' : 'Entrar'}</button>
              </div>
              {err && <div className="err">{err}</div>}
            </form>
            <a href="/" className="auth-link">Ainda não sou cliente</a>
          </div>
        </main>
      </div>
    </div>
  );
}
