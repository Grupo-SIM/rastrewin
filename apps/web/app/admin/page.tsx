'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, fmtRemaining } from '@/lib/api';
import { Logo } from '@/components/Logo';
import { SiteIcon } from '@/components/SiteIcon';

type AdminRaffle = {
  id: string; title: string; site: string; endsAt: string; winnerName: string | null; winnerUserId: string | null;
  _count: { entries: number };
};
type AdminUser = { id: string; name: string; email: string; plan: string };

// o admin não recebe a cor do site; deriva uma estável a partir do nome
const PALETTE = ['#ff5a36', '#7c3aed', '#16a34a', '#0ea5e9', '#e11d48', '#f59e0b', '#14b8a6', '#6366f1', '#84cc16', '#ec4899'];
const siteColor = (name: string) => PALETTE[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];

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
    <div className="app admin-page">
      <div className="app-top">
        <nav className="nav">
          <a href="/dashboard"><Logo badge="ADMIN" /></a>
          <a href="/dashboard" className="btn-outline">← Dashboard</a>
        </nav>
      </div>
      <main className="app-main admin-main">
        <div className="app-head admin-head">
          <h1 className="display">Admin de sorteios</h1>
          <label className="search">
            <input placeholder="Filtrar por título ou site..." value={q} onChange={(e) => setQ(e.target.value)} />
            <span>{filtered.length} sorteios</span>
          </label>
        </div>
        {error && <div className="err" style={{ marginBottom: 14 }}>{error}</div>}
        <div className="atable">
          <div className="arow head"><span>SORTEIO</span><span>SITE</span><span>STATUS</span><span>GANHADOR</span><span>AÇÕES</span></div>
          {filtered.map((r) => {
            const ms = new Date(r.endsAt).getTime() - now;
            const ended = ms <= 0;
            return (
              <div key={r.id} className="arow">
                <div>
                  <div className="ttl">{r.title}</div>
                  <div className="sub">{r._count.entries} inscritos</div>
                </div>
                <span className="site"><SiteIcon name={r.site} color={siteColor(r.site)} size={22} />{r.site}</span>
                <span className={`pill ${ended ? 'orange' : 'blue'}`} style={{ justifySelf: 'start', fontVariantNumeric: 'tabular-nums' }}>
                  {ended ? 'Encerrado' : fmtRemaining(ms)}
                </span>
                <div>
                  <input
                    className="draft"
                    placeholder={r.winnerName ?? 'Nome do ganhador'}
                    value={drafts[r.id] ?? ''}
                    onChange={(e) => setDrafts({ ...drafts, [r.id]: e.target.value })}
                  />
                  {r.winnerName && <span className="def">Definido: {r.winnerName}{r.winnerUserId ? ' (usuário)' : ''}</span>}
                </div>
                <div className="acts">
                  <button className="abtn" onClick={() => act(`/admin/raffles/${r.id}`, 'PATCH', { winnerName: drafts[r.id] })}>Salvar</button>
                  <button className="abtn o" onClick={() => act(`/admin/raffles/${r.id}/draw`, 'POST')}>Aleatório</button>
                  <select
                    className="aselect"
                    value=""
                    onChange={(e) => {
                      const u = users.find((x) => x.id === e.target.value);
                      if (u) act(`/admin/raffles/${r.id}`, 'PATCH', { winnerName: u.name, winnerUserId: u.id });
                    }}
                  >
                    <option value="">Usuário...</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <button className="abtn t" onClick={() => act(`/admin/raffles/${r.id}/end`, 'POST', { inSeconds: 10 })}>Encerrar em 10s</button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
