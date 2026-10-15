'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, Raffle, User } from '@/lib/api';
import { LogoStrip } from '@/components/LogoStrip';
import { Console } from '@/components/Console';
import { RaffleCard } from '@/components/RaffleCard';

type Tab = 'all' | 'open' | 'ended' | 'won';
const PAGE = 12;

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState<Tab>('all');
  const [shown, setShown] = useState(PAGE);
  const [extra, setExtra] = useState<string[]>([]);
  const [toasts, setToasts] = useState<{ id: string; text: string; me: boolean }[]>([]);
  const notified = useRef<Set<string> | null>(null);

  const load = useCallback(async (uid: string) => {
    setRaffles(await api<Raffle[]>(`/raffles?userId=${uid}`));
  }, []);

  useEffect(() => {
    const uid = localStorage.getItem('userId');
    if (!uid) return void router.replace('/');
    api<User>(`/users/${uid}`).then(setUser).catch(() => router.replace('/'));
    load(uid);
    const poll = setInterval(() => load(uid), 3000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    // "descoberta" periódica de novos sorteios
    const discover = setInterval(async () => {
      try {
        const found = await api<Raffle[]>(`/raffles/discover?userId=${uid}`, { method: 'POST' });
        setExtra((e) => [...e, ...found.map((r) => `Inscrito em: ${r.title} (${r.site}) ✔`)].slice(-3));
        load(uid);
      } catch {}
    }, 25000);
    return () => { clearInterval(poll); clearInterval(tick); clearInterval(discover); };
  }, [router, load]);

  const mine = useMemo(() => raffles.filter((r) => r.entered), [raffles]);

  // avisa quando um sorteio termina e tem ganhador definido
  useEffect(() => {
    if (!user) return;
    const done = mine.filter((r) => r.ended && r.winnerName);
    if (notified.current === null) {
      notified.current = new Set(done.map((r) => r.id)); // não avisa o que já estava encerrado ao abrir
      return;
    }
    const fresh = done.filter((r) => !notified.current!.has(r.id));
    if (!fresh.length) return;
    fresh.forEach((r) => notified.current!.add(r.id));
    setToasts((t) => [
      ...t,
      ...fresh.map((r) => {
        const me = r.winnerUserId === user.id;
        const text = me
          ? `🎉 VOCÊ GANHOU: ${r.prize} (${r.site})!`
          : `🏆 ${r.winnerName} ganhou ${r.title}`;
        return { id: r.id, me, text };
      }),
    ]);
  }, [mine, user]);
  const isOpen = (r: Raffle) => new Date(r.endsAt).getTime() > now;
  const visible = useMemo(() => {
    const list = mine.filter((r) => {
      if (tab === 'open') return isOpen(r);
      if (tab === 'ended') return !isOpen(r);
      if (tab === 'won') return !isOpen(r) && r.winnerUserId === user?.id;
      return true;
    });
    // em andamento primeiro (por tempo restante), depois encerrados
    return list.sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || +new Date(a.endsAt) - +new Date(b.endsAt));
    // eslint-disable-next-line
  }, [mine, tab, user, Math.floor(now / 5000)]);

  const open = mine.filter(isOpen).length;
  const won = mine.filter((r) => !isOpen(r) && r.winnerUserId === user?.id).length;

  // scroll infinito da lista de sorteios
  useEffect(() => {
    const onScroll = () => {
      if (window.innerHeight + window.scrollY > document.body.offsetHeight - 400) setShown((s) => s + PAGE);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!user) return null;

  return (
    <>
      <div className="wrap topbar">
        <b style={{ fontSize: 20 }}>🎯 SorteioPilot</b>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ color: 'var(--mut)' }}>Olá, {user.name.split(' ')[0]} · plano {user.plan}</span>
          <a href="/admin" className="btn ghost sm">Admin</a>
          <button className="btn ghost sm" onClick={() => { localStorage.removeItem('userId'); router.push('/'); }}>Sair</button>
        </div>
      </div>
      <LogoStrip />
      <main className="wrap">
        <div className="stats">
          <div className="card stat"><b>{mine.length}</b><span>sorteios que você participa</span></div>
          <div className="card stat"><b>{open}</b><span>em andamento</span></div>
          <div className="card stat"><b>{mine.length - open}</b><span>encerrados</span></div>
          <div className="card stat"><b style={{ color: 'var(--ok)' }}>{won}</b><span>prêmios ganhos</span></div>
        </div>

        <div className="tabs">
          {([['all', 'Todos'], ['open', 'Em andamento'], ['ended', 'Encerrados'], ['won', 'Ganhei']] as [Tab, string][]).map(([k, label]) => (
            <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => { setTab(k); setShown(PAGE); }}>{label}</button>
          ))}
        </div>

        <div className="raffles">
          {visible.slice(0, shown).map((r) => <RaffleCard key={r.id} r={r} now={now} userId={user.id} />)}
        </div>
      </main>
      <div style={{ position: 'fixed', right: 16, bottom: 16, display: 'grid', gap: 8, zIndex: 60, maxWidth: 360 }}>
        {toasts.slice(-4).map((t) => (
          <div key={t.id} className={`winner ${t.me ? 'me' : ''}`} style={{ cursor: 'pointer' }}
            onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
            {t.text}
          </div>
        ))}
      </div>
      <Console extra={extra} />
    </>
  );
}
