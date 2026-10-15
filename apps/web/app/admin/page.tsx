'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type AdminRaffle = {
  id: string; title: string; site: string; endsAt: string; winnerName: string | null; winnerUserId: string | null;
  _count: { entries: number };
};
type AdminUser = { id: string; name: string; email: string; plan: string };

export default function Admin() {
  const [raffles, setRaffles] = useState<AdminRaffle[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [now, setNow] = useState(Date.now());
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [r, u] = await Promise.all([
        api<AdminRaffle[]>('/admin/raffles', { admin: true }),
        api<AdminUser[]>('/admin/users', { admin: true }),
      ]);
      setRaffles(r);
      setUsers(u);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [load]);

  async function act(path: string, method: string, body?: object) {
    await api(path, { method, body: body ? JSON.stringify(body) : undefined, admin: true });
    await load();
  }

  const filtered = raffles.filter((r) => (r.title + r.site).toLowerCase().includes(q.toLowerCase()));

  return (
    <main className="wrap">
      <div className="topbar">
        <b style={{ fontSize: 20 }}>🛠️ Admin de sorteios</b>
        <a href="/dashboard" className="btn ghost sm">← Dashboard</a>
      </div>
      {error && <div className="card" style={{ color: '#f87171' }}>{error}</div>}
      <div className="card" style={{ marginBottom: 14 }}>
        <input placeholder="Filtrar por título ou site..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr><th>Sorteio</th><th>Site</th><th>Status</th><th>Ganhador</th><th>Ações</th></tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const ms = new Date(r.endsAt).getTime() - now;
              const ended = ms <= 0;
              return (
                <tr key={r.id}>
                  <td>{r.title}<div style={{ color: 'var(--mut)', fontSize: 12 }}>{r._count.entries} inscritos</div></td>
                  <td>{r.site}</td>
                  <td>{ended ? <span style={{ color: 'var(--warn)' }}>Encerrado</span> : `${Math.floor(ms / 1000)}s`}</td>
                  <td style={{ minWidth: 240 }}>
                    <input
                      placeholder={r.winnerName ?? 'Nome do ganhador'}
                      value={drafts[r.id] ?? ''}
                      onChange={(e) => setDrafts({ ...drafts, [r.id]: e.target.value })}
                    />
                    {r.winnerName && <div style={{ fontSize: 12, color: 'var(--ok)' }}>Definido: {r.winnerName}{r.winnerUserId ? ' (usuário)' : ''}</div>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn sm" onClick={() => act(`/admin/raffles/${r.id}`, 'PATCH', { winnerName: drafts[r.id] })}>Salvar</button>{' '}
                    <button className="btn ghost sm" onClick={() => act(`/admin/raffles/${r.id}/draw`, 'POST')}>Aleatório</button>{' '}
                    <select
                      style={{ width: 130, padding: 6, fontSize: 13 }}
                      value=""
                      onChange={(e) => {
                        const u = users.find((x) => x.id === e.target.value);
                        if (u) act(`/admin/raffles/${r.id}`, 'PATCH', { winnerName: u.name, winnerUserId: u.id });
                      }}
                    >
                      <option value="">Usuário...</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>{' '}
                    <button className="btn ghost sm" onClick={() => act(`/admin/raffles/${r.id}/end`, 'POST', { inSeconds: 10 })}>Encerrar em 10s</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
