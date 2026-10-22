'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

const field: React.CSSProperties = {
  height: 52, borderRadius: 999, border: 0, outline: 'none', padding: '0 20px', width: '100%',
  font: '500 16px var(--f-body)', boxShadow: '0 0 0 1px rgba(0,0,0,.12)', background: '#fff', color: 'var(--ink)',
};

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (next.length < 8) return setErr('A nova senha deve ter pelo menos 8 caracteres.');
    if (next !== confirm) return setErr('A confirmação não coincide com a nova senha.');
    if (next === current) return setErr('A nova senha deve ser diferente da atual.');
    setBusy(true);
    try {
      await api('/auth/change-password', {
        method: 'POST', admin: true, body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setDone(true);
    } catch (e) {
      const msg = (e as Error).message;
      setErr(msg.includes('Senha atual incorreta') ? 'Senha atual incorreta.' : 'Não foi possível alterar a senha. Tente de novo.');
    }
    setBusy(false);
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10,12,20,.72)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: 32, maxWidth: 420, width: '100%', display: 'grid', gap: 16 }}>
        <h2 className="display" style={{ fontSize: 24, textAlign: 'center' }}>Alterar senha</h2>
        {done ? (
          <>
            <p style={{ color: 'var(--mut)', fontSize: 15, textAlign: 'center' }}>Senha alterada com sucesso.</p>
            <button className="btn-dark" onClick={onClose}>Fechar</button>
          </>
        ) : (
          <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
            <input style={field} type="password" required autoFocus placeholder="Senha atual" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            <input style={field} type="password" required minLength={8} maxLength={72} placeholder="Nova senha" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            <input style={field} type="password" required minLength={8} maxLength={72} placeholder="Confirmar nova senha" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {err && <div className="err">{err}</div>}
            <button className="btn-dark" disabled={busy}>{busy ? 'Salvando...' : 'Alterar senha'}</button>
            <button type="button" className="btn-outline" onClick={onClose}>Cancelar</button>
          </form>
        )}
      </div>
    </div>
  );
}
