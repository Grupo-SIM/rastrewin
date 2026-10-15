'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, User } from '@/lib/api';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const user = await api<User>('/users/login', { method: 'POST', body: JSON.stringify({ email }) });
      localStorage.setItem('userId', user.id);
      router.push('/dashboard');
    } catch {
      setErr('E-mail não encontrado. Faça seu cadastro na página inicial.');
      setBusy(false);
    }
  }

  return (
    <>
      <div className="wrap topbar">
        <a href="/"><b style={{ fontSize: 20 }}>🎯 SorteioPilot</b></a>
      </div>
      <main className="wrap" style={{ display: 'grid', placeItems: 'center', paddingTop: 60 }}>
        <form className="card" onSubmit={submit} style={{ width: 380, maxWidth: '100%', display: 'grid', gap: 14 }}>
          <h2 style={{ margin: 0 }}>Entrar</h2>
          <div>
            <label>E-mail cadastrado</label>
            <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {err && <div style={{ color: '#f87171', fontSize: 13 }}>{err}</div>}
          <button className="btn" disabled={busy}>{busy ? 'Entrando...' : 'Entrar'}</button>
          <a href="/" style={{ color: 'var(--mut)', fontSize: 14, textAlign: 'center' }}>Ainda não sou cliente</a>
        </form>
      </main>
    </>
  );
}
