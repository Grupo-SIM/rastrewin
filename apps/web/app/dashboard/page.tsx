'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, Raffle, User } from '@/lib/api';
import { LogoStrip } from '@/components/LogoStrip';
import { Console, useRobotLines } from '@/components/Console';
import { Logo } from '@/components/Logo';
import { Tabs } from '@/components/Tabs';
import { Toast, ToastData } from '@/components/Toast';
import { RaffleCard } from '@/components/RaffleCard';
import { PhoneVerifyModal } from '@/components/PhoneVerifyModal';
import { ChangePasswordModal } from '@/components/ChangePasswordModal';

type Tab = 'all' | 'open' | 'ended' | 'won';
const PAGE = 12;
const TOAST_GAP_MS = 45 * 1000; // intervalo mínimo entre dois avisos de resultado

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState<Tab>('all');
  const [shown, setShown] = useState(PAGE);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [queue, setQueue] = useState<ToastData[]>([]);
  // o primeiro aviso espera 20 segundos depois de entrar na plataforma
  const lastToast = useRef(Date.now() - TOAST_GAP_MS + 20_000);
  const [pwOpen, setPwOpen] = useState(false);
  // o modal de verificação abre a cada entrada na página, pode ser fechado e volta 1h depois de fechado
  const [verifyOpen, setVerifyOpen] = useState(true);
  useEffect(() => {
    if (verifyOpen) return;
    const t = setTimeout(() => setVerifyOpen(true), 60 * 60 * 1000);
    return () => clearTimeout(t);
  }, [verifyOpen]);
  const notified = useRef<Set<string> | null>(null);
  const lines = useRobotLines();

  // 1ª chamada do dia baixa tudo desde a meia-noite do usuário; as seguintes só trazem o que mudou (sorteios novos
  // ou recém-terminados) e juntam pelo id: a plataforma abre até 5.000 sorteios por dia, não dá para rebaixar a lista a cada 3 s
  const cursor = useRef<{ day: number; at: number } | null>(null);
  const load = useCallback(async (uid: string) => {
    const d = new Date();
    const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const delta = cursor.current && cursor.current.day === midnight ? cursor.current.at - 15_000 : null;
    const fetchedAt = Date.now();
    const rows = await api<Raffle[]>(`/raffles?userId=${uid}&since=${new Date(midnight).toISOString()}${delta ? `&after=${delta}` : ''}`);
    cursor.current = { day: midnight, at: fetchedAt };
    setRaffles((prev) => {
      if (!delta) return rows;
      const byId = new Map(prev.map((r) => [r.id, r]));
      rows.forEach((r) => byId.set(r.id, r));
      return [...byId.values()];
    });
  }, []);

  useEffect(() => {
    const uid = localStorage.getItem('userId');
    if (!uid) return void router.replace('/');
    api<User>(`/users/${uid}`).then(setUser).catch(() => router.replace('/'));
    load(uid);
    // reinscreve já na abertura (ex.: após o banco ser recriado), sem esperar o ciclo de 25s
    api(`/raffles/discover?userId=${uid}`, { method: 'POST' }).then(() => load(uid)).catch(() => {});
    const poll = setInterval(() => load(uid), 3000);
    const userPoll = setInterval(() => api<User>(`/users/${uid}`).then(setUser).catch(() => {}), 3000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    // "descoberta" periódica de novos sorteios
    const discover = setInterval(async () => {
      try {
        await api<Raffle[]>(`/raffles/discover?userId=${uid}`, { method: 'POST' });
        load(uid);
      } catch {}
    }, 25000);
    return () => { clearInterval(poll); clearInterval(userPoll); clearInterval(tick); clearInterval(discover); };
  }, [router, load]);

  // Tudo zera à meia-noite do usuário: só entram os sorteios que começaram hoje (os que ele ganhou ficam sempre)
  const mine = useMemo(() => {
    const d = new Date(now);
    const today = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return raffles.filter((r) => r.entered && (new Date(r.startsAt).getTime() >= today || r.winnerUserId === user?.id));
    // eslint-disable-next-line
  }, [raffles, user, Math.floor(now / 60000)]);

  // o contador zerou mas o ganhador ainda não chegou: busca já, sem esperar o próximo ciclo
  useEffect(() => {
    const uid = localStorage.getItem('userId');
    if (uid && mine.some((r) => new Date(r.endsAt).getTime() <= now && !r.winnerName)) load(uid);
  }, [now, mine, load]);

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
    // entram numa fila: os do próprio usuário vão na frente e a fila guarda no máximo 3 avisos
    setQueue((q) => {
      const add = fresh.map((r): ToastData => ({
        id: r.id, me: r.winnerUserId === user.id, winner: r.winnerName ?? '', prize: r.title, site: r.site, color: r.siteColor,
      }));
      const all = [...q, ...add];
      return [...all.filter((x) => x.me), ...all.filter((x) => !x.me)].slice(0, 3);
    });
  }, [mine, user]);

  // libera um aviso por vez, 1 a cada 45 segundos; no máximo 2 na tela no celular (3 no desktop)
  useEffect(() => {
    if (!queue.length) return;
    const mobile = window.matchMedia('(max-width: 860px)').matches;
    if (toasts.length >= (mobile ? 2 : 3)) return; // volta a rodar quando um aviso some
    const wait = Math.max(0, lastToast.current + TOAST_GAP_MS - Date.now());
    const t = setTimeout(() => {
      lastToast.current = Date.now();
      setToasts((x) => [...x, queue[0]]);
      setQueue((q) => q.slice(1));
    }, wait);
    return () => clearTimeout(t);
  }, [queue, toasts]);
  const isOpen = (r: Raffle) => new Date(r.endsAt).getTime() > now;
  const visible = useMemo(() => {
    const list = mine.filter((r) => {
      if (tab === 'open') return isOpen(r);
      if (tab === 'ended') return !isOpen(r);
      if (tab === 'won') return !isOpen(r) && r.winnerUserId === user?.id;
      return true;
    });
    // em andamento primeiro (por tempo restante), depois encerrados (mais recentes primeiro)
    return list.sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || (isOpen(a) ? +new Date(a.endsAt) - +new Date(b.endsAt) : +new Date(b.endsAt) - +new Date(a.endsAt)));
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

  if (user.status === 'EXPIRED') {
    return (
      <div className="app" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', textAlign: 'center', gap: 12, padding: 24 }}>
        <Logo />
        <h1 className="display" style={{ fontSize: 28 }}>Sua assinatura venceu</h1>
        <p style={{ color: 'var(--mut)', maxWidth: 420 }}>Renove para continuar participando dos sorteios. Seu histórico e inscrições continuam salvos.</p>
        {user.checkoutUrl && <a href={user.checkoutUrl} target="_blank" rel="noopener noreferrer" className="btn-rainbow" style={{ marginTop: 8, textDecoration: 'none' }}>Renovar assinatura</a>}
      </div>
    );
  }

  if (user.status !== 'ACTIVE') {
    return (
      <div className="app" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', textAlign: 'center', gap: 12, padding: 24 }}>
        <Logo />
        <h1 className="display" style={{ fontSize: 28 }}>Aguardando confirmação do pagamento</h1>
        <p style={{ color: 'var(--mut)', maxWidth: 420 }}>Assim que o pagamento for aprovado, seu plano é liberado automaticamente e esta página atualiza sozinha.</p>
      </div>
    );
  }

  const countOf = (k: Tab) => mine.filter((r) => {
    if (k === 'open') return isOpen(r);
    if (k === 'ended') return !isOpen(r);
    if (k === 'won') return !isOpen(r) && r.winnerUserId === user.id;
    return true;
  }).length;
  const stats = [
    { l: 'sorteios que você participa hoje', v: mine.length, c: 'var(--ink)', bg: '#fff' },
    { l: 'em andamento', v: open, c: 'var(--ink)', bg: 'var(--blue-bg)' },
    { l: 'encerrados', v: mine.length - open, c: 'var(--ink)', bg: 'var(--line)' },
    { l: 'prêmios ganhos', v: won, c: 'var(--green-fg)', bg: 'var(--green-bg)' },
  ];
  const first = user.name.split(' ')[0];
  const lastLine = lines[lines.length - 1]?.s ?? '';

  return (
    <div className="app">
      {!user.phoneVerified && (
        <PhoneVerifyModal userId={user.id} open={verifyOpen} onClose={() => setVerifyOpen(false)} onVerified={() => setUser((u) => (u ? { ...u, phoneVerified: true } : u))} />
      )}
      {pwOpen && <ChangePasswordModal onClose={() => setPwOpen(false)} />}
      <div className="app-top">
        <nav className="nav">
          <a href="/dashboard"><Logo /></a>
          <div className="app-status">
            <span className="pill green"><i className="dot green" />IA em execução</span>
            <span className="txt">{lastLine}</span>
          </div>
          <div className="app-user">
            <span className="hi">Olá, {first} · plano {user.plan}</span>
            {user.role === 'ADMIN' && <a href="/admin" className="lnk">Admin</a>}
            <button className="lnk" onClick={() => setPwOpen(true)} style={{ background: 'none', border: 0, cursor: 'pointer' }}>Alterar senha</button>
            <button className="btn-outline" onClick={() => { localStorage.removeItem('userId'); localStorage.removeItem('userToken'); router.push('/'); }}>Sair</button>
          </div>
        </nav>
      </div>
      <main className="app-main">
        <div className="app-head">
          <div>
            <span className="hello" style={{ display: 'none' }}>Olá, {first} · plano {user.plan}</span>
            <h1 className="display">Seus <span className="accent">sorteios</span></h1>
          </div>
          <div className="stat-row">
            {stats.map((s) => (
              <div key={s.l} className="stat" style={{ background: s.bg }}><b style={{ color: s.c }}>{s.v}</b><span>{s.l}</span></div>
            ))}
          </div>
        </div>

        <div className="toolbar">
          <Tabs
            value={tab}
            onChange={(k) => { setTab(k); setShown(PAGE); }}
            items={(['all', 'open', 'ended', 'won'] as Tab[]).map((k) => ({ key: k, label: { all: 'Todos', open: 'Em andamento', ended: 'Encerrados', won: 'Ganhei' }[k], count: countOf(k) }))}
          />
          <LogoStrip />
        </div>

        {tab === 'won' && visible.length === 0 && (
          <div className="won-empty">
            <b>Você ainda não ganhou nenhum sorteio</b>
          </div>
        )}

        <div className={`raffles ${tab === 'won' ? 'compact' : ''}`}>
          {visible.slice(0, shown).map((r) => <RaffleCard key={r.id} r={r} now={now} userId={user.id} />)}
        </div>
      </main>
      <div className="toasts">
        {toasts.map((t) => (
          <Toast key={t.id} t={t} onClose={() => setToasts((x) => x.filter((y) => y.id !== t.id))} />
        ))}
      </div>
      <Console lines={lines} />
    </div>
  );
}
