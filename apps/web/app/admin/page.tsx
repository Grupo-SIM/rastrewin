'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, fmtRemaining } from '@/lib/api';
import { Logo } from '@/components/Logo';
import { SiteIcon } from '@/components/SiteIcon';
import { UserPicker } from '@/components/UserPicker';

type AdminRaffle = {
  id: string; title: string; prize: string; site: string; endsAt: string; winnerName: string | null; winnerUserId: string | null;
  _count: { entries: number };
};
type AdminUser = {
  id: string; name: string; email: string; plan: string; phone: string; cpf: string; pix: string | null; city: string; paidAt: string;
};

const PLAN_PRICE: Record<string, number> = { basico: 150, pro: 500, vip: 1000 };
const PLAN_NAME: Record<string, string> = { basico: 'Básico', pro: 'Pro', vip: 'VIP' };
const fmtDate = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

// o admin não recebe a cor do site; deriva uma estável a partir do nome
const PALETTE = ['#ff5a36', '#7c3aed', '#16a34a', '#0ea5e9', '#e11d48', '#f59e0b', '#14b8a6', '#6366f1', '#84cc16', '#ec4899'];
const siteColor = (name: string) => PALETTE[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];

/** Baixa a lista de clientes filtrada como CSV (separador ;, compatível com Excel pt-BR). */
function exportClientsCsv(clients: AdminUser[]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ['Nome', 'E-mail', 'Telefone', 'Pix', 'CPF', 'Cidade', 'Plano', 'Valor', 'Pago em'];
  const rows = clients.map((u) => [
    u.name, u.email, u.phone, u.pix ?? '', u.cpf, u.city,
    PLAN_NAME[u.plan] ?? u.plan, String(PLAN_PRICE[u.plan] ?? ''), fmtDate(u.paidAt),
  ]);
  const csv = '﻿' + [header, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function WhatsAppIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 4.54 0 8.23 3.69 8.23 8.23s-3.7 8.24-8.23 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07s.89 2.4 1.01 2.56c.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.23-.16-.48-.29Z" />
    </svg>
  );
}

/** Link wa.me com mensagem pronta. Telefone sem DDI é tratado como brasileiro (+55). */
function fillMessage(tpl: string, u: { name: string }, r: { title: string; prize: string; site: string }) {
  return tpl
    .replaceAll('{nome}', u.name.split(' ')[0])
    .replaceAll('{sorteio}', r.title)
    .replaceAll('{premio}', r.prize)
    .replaceAll('{site}', r.site);
}

function waLink(tpl: string, u: AdminUser, r: AdminRaffle) {
  let phone = u.phone.replace(/\D/g, '');
  if (phone.length <= 11) phone = '55' + phone;
  return `https://wa.me/${phone}?text=${encodeURIComponent(fillMessage(tpl, u, r))}`;
}

export default function Admin() {
  const [raffles, setRaffles] = useState<AdminRaffle[]>([]);
  const order = useRef<string[]>([]); // posição das linhas fica fixa entre recargas (evita "pulos" ao editar)
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'raffles' | 'clients'>('raffles');
  const [waMsg, setWaMsg] = useState('');
  const [waDraft, setWaDraft] = useState('');
  const [waDefault, setWaDefault] = useState('');
  const [waOpen, setWaOpen] = useState(false);
  const [waSaved, setWaSaved] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [r, u] = await Promise.all([
        api<AdminRaffle[]>('/admin/raffles', { admin: true }),
        api<AdminUser[]>('/admin/users', { admin: true }),
      ]);
      const known = new Set(order.current);
      const fresh = r.map((x) => x.id).filter((id) => !known.has(id));
      order.current = [...order.current.filter((id) => r.some((x) => x.id === id)), ...fresh];
      const byId = new Map(r.map((x) => [x.id, x]));
      setRaffles(order.current.map((id) => byId.get(id)!));
      setUsers(u);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    api<{ text: string; defaultText: string }>('/admin/whatsapp-message', { admin: true })
      .then((m) => { setWaMsg(m.text); setWaDraft(m.text); setWaDefault(m.defaultText); })
      .catch(() => {});
  }, []);

  async function saveMsg(text: string) {
    try {
      const m = await api<{ text: string }>('/admin/whatsapp-message', { method: 'PUT', body: JSON.stringify({ text }), admin: true });
      setWaMsg(m.text);
      setWaDraft(m.text);
      setWaSaved(true);
      setTimeout(() => setWaSaved(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [load]);

  async function act(path: string, method: string, body?: object) {
    try {
      await api(path, { method, body: body ? JSON.stringify(body) : undefined, admin: true });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const userOptions = users.map((u) => ({ id: u.id, name: u.name, sub: `${u.email} · ${PLAN_NAME[u.plan] ?? u.plan}` }));
  const needle = q.toLowerCase();
  const isEnded = (r: AdminRaffle) => new Date(r.endsAt).getTime() <= now;
  const filtered = raffles.filter((r) => !isEnded(r) && (r.title + r.site).toLowerCase().includes(needle));
  const clients = users.filter((u) => (u.name + u.email + u.cpf + u.phone + (u.pix ?? '')).toLowerCase().includes(needle));
  const revenue = users.reduce((a, u) => a + (PLAN_PRICE[u.plan] ?? 0), 0);

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
          <h1 className="display">Admin</h1>
          <label className="search">
            <input placeholder={tab === 'raffles' ? 'Filtrar por título ou site...' : 'Filtrar por nome, e-mail, CPF, telefone ou Pix...'} value={q} onChange={(e) => setQ(e.target.value)} />
            <span>{tab === 'raffles' ? `${filtered.length} sorteios` : `${clients.length} clientes`}</span>
          </label>
        </div>
        <div className="atabs">
          <button className={tab === 'raffles' ? 'on' : ''} onClick={() => setTab('raffles')}>Sorteios</button>
          <button className={tab === 'clients' ? 'on' : ''} onClick={() => setTab('clients')}>Clientes ({users.length})</button>
          {tab === 'clients' && (
            <span className="atabs-sum">
              Receita mensal: R$ {revenue.toLocaleString('pt-BR')}
              <button className="abtn o" style={{ marginLeft: 12 }} onClick={() => exportClientsCsv(clients)}>Exportar CSV</button>
            </span>
          )}
        </div>
        {error && <div className="err" style={{ marginBottom: 14 }}>{error}</div>}
        {tab === 'raffles' && (
          <div className="wa-card">
            <button className="wa-head" onClick={() => setWaOpen(!waOpen)} aria-expanded={waOpen}>
              <span className="wa-btn sm"><WhatsAppIcon /></span>
              <span className="wa-title">Mensagem do WhatsApp para o ganhador</span>
              <span className="wa-chev">{waOpen ? '▲' : '▼'}</span>
            </button>
            {waOpen && (
              <div className="wa-body">
                <textarea value={waDraft} onChange={(e) => setWaDraft(e.target.value)} rows={4} maxLength={1000} aria-label="Texto da mensagem" />
                <div className="wa-vars">
                  Variáveis:
                  {['{nome}', '{sorteio}', '{premio}', '{site}'].map((v) => (
                    <button key={v} type="button" onClick={() => setWaDraft((d) => d + v)}>{v}</button>
                  ))}
                </div>
                <div className="wa-prev"><b>Prévia:</b> {fillMessage(waDraft, { name: 'Maria Silva' }, raffles[0] ?? { title: 'Sorteio exemplo', prize: 'Prêmio exemplo', site: 'Site' })}</div>
                <div className="acts">
                  <button className="abtn" disabled={!waDraft.trim() || waDraft === waMsg} onClick={() => saveMsg(waDraft.trim())}>Salvar mensagem</button>
                  <button className="abtn o" disabled={waDraft === waDefault} onClick={() => setWaDraft(waDefault)}>Usar padrão</button>
                  {waSaved && <span className="def" style={{ margin: 0 }}>Salvo!</span>}
                </div>
              </div>
            )}
          </div>
        )}
        {tab === 'clients' ? (
          <div className="atable">
            <div className="arow clients head"><span>NOME</span><span>E-MAIL</span><span>TELEFONE</span><span>PIX</span><span>CPF</span><span>PLANO</span></div>
            {clients.map((u) => (
              <div key={u.id} className="arow clients">
                <div>
                  <div className="ttl">{u.name}</div>
                  <div className="sub">Pago em {fmtDate(u.paidAt)}</div>
                </div>
                <span className="cell" title={u.email}>{u.email}</span>
                <span className="cell">{u.phone}</span>
                <span className="cell" title={u.pix ?? ''}>{u.pix || '—'}</span>
                <span className="cell">{u.cpf}</span>
                <span className="pill blue" style={{ justifySelf: 'start' }}>{PLAN_NAME[u.plan] ?? u.plan} · R$ {PLAN_PRICE[u.plan] ?? '?'}</span>
              </div>
            ))}
            {clients.length === 0 && <div className="arow"><span className="sub">Nenhum cliente encontrado.</span></div>}
          </div>
        ) : (
        <div className="atable">
          <div className="arow head"><span>SORTEIO</span><span>SITE</span><span>STATUS</span><span>GANHADOR</span><span>AÇÕES</span></div>
          {filtered.map((r) => {
            const ms = new Date(r.endsAt).getTime() - now;
            const ended = ms <= 0;
            return (
              <div key={r.id} className="arow">
                <div>
                  <input
                    className="draft title"
                    value={titles[r.id] ?? r.title}
                    onChange={(e) => setTitles({ ...titles, [r.id]: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    onBlur={() => {
                      const t = (titles[r.id] ?? r.title).trim();
                      setTitles(({ [r.id]: _, ...rest }) => rest);
                      if (t && t !== r.title) act(`/admin/raffles/${r.id}`, 'PATCH', { title: t });
                    }}
                    aria-label="Nome do sorteio"
                  />
                  <div className="sub">{r._count.entries > 0 ? `${r._count.entries} inscritos · ` : ''}clique no nome para editar</div>
                </div>
                <span className="site"><SiteIcon name={r.site} color={siteColor(r.site)} size={22} />{r.site}</span>
                <span className={`pill ${ended ? 'orange' : 'blue'}`} style={{ justifySelf: 'start', fontVariantNumeric: 'tabular-nums' }}>
                  {ended ? 'Encerrado' : fmtRemaining(ms)}
                </span>
                <div className="winner-cell">
                  <UserPicker
                    value={r.winnerUserId ?? ''}
                    fallbackLabel={r.winnerUserId ? null : r.winnerName}
                    options={userOptions}
                    onChange={(id) => {
                      const u = users.find((x) => x.id === id);
                      if (u) act(`/admin/raffles/${r.id}`, 'PATCH', { winnerName: u.name, winnerUserId: u.id });
                    }}
                  />
                  {(() => {
                    const w = r.winnerUserId ? users.find((x) => x.id === r.winnerUserId) : undefined;
                    return w ? (
                      <a className="wa-btn" href={waLink(waMsg, w, r)} target="_blank" rel="noopener noreferrer" title={`Enviar WhatsApp para ${w.name}`} aria-label={`Enviar WhatsApp para ${w.name}`}>
                        <WhatsAppIcon />
                      </a>
                    ) : null;
                  })()}
                  {r.winnerName && (
                    <button className="wa-x" title="Remover ganhador" aria-label="Remover ganhador" onClick={() => act(`/admin/raffles/${r.id}`, 'PATCH', { winnerName: '', winnerUserId: '' })}>×</button>
                  )}
                </div>
                <div className="acts">
                  <button className="abtn t" onClick={() => act(`/admin/raffles/${r.id}/end`, 'POST', { inSeconds: 10 })}>Encerrar em 10s</button>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </main>
    </div>
  );
}
