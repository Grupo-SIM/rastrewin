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
import { shownParticipation } from '@/lib/participation';
import { PhoneVerifyModal } from '@/components/PhoneVerifyModal';
import { ChangePasswordModal } from '@/components/ChangePasswordModal';

type Tab = 'all' | 'open' | 'ended' | 'won' | 'ineligible';
const PAGE = 12;

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState<Tab>('all');
  const [shown, setShown] = useState(PAGE);
  const [toasts, setToasts] = useState<ToastData[]>([]);
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

  const load = useCallback(async (uid: string) => {
    setRaffles(await api<Raffle[]>(`/raffles?userId=${uid}`));
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

  const mine = useMemo(() => raffles.filter((r) => r.entered), [raffles]);

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
    setToasts((t) => [
      ...t,
      ...fresh.map((r): ToastData => ({
        id: r.id, me: r.winnerUserId === user.id && !r.winnerIneligible, winner: r.winnerName ?? '', prize: r.title, site: r.site, color: r.siteColor,
      })),
    ]);
  }, [mine, user]);
  const isOpen = (r: Raffle) => new Date(r.endsAt).getTime() > now;
  const visible = useMemo(() => {
    const list = mine.filter((r) => {
      if (tab === 'open') return isOpen(r);
      if (tab === 'ended') return !isOpen(r);
      if (tab === 'won') return !isOpen(r) && r.winnerUserId === user?.id && !r.winnerIneligible;
      if (tab === 'ineligible') return !isOpen(r) && r.winnerUserId === user?.id && r.winnerIneligible;
      return true;
    });
    // em andamento primeiro (por tempo restante), depois encerrados (mais recentes primeiro)
    return list.sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || (isOpen(a) ? +new Date(a.endsAt) - +new Date(b.endsAt) : +new Date(b.endsAt) - +new Date(a.endsAt)));
    // eslint-disable-next-line
  }, [mine, tab, user, Math.floor(now / 5000)]);

  const open = mine.filter(isOpen).length;
  const won = mine.filter((r) => !isOpen(r) && r.winnerUserId === user?.id && !r.winnerIneligible).length;

  // chance de ganhar ao menos um prêmio participando de N sorteios no dia: 1 - (1 - p)^N, onde p é a
  // chance média de um sorteio (média de 1/participantes dos abertos) e N é o mesmo número exibido em
  // "sorteios que você participa hoje". O aumento é comparado com participar de um único sorteio (chance p).
  const boost = useMemo(() => {
    const ps = mine.filter(isOpen).map((r) => 1 / Math.max(1, r.participants));
    if (ps.length < 2) return null;
    const p = ps.reduce((a, x) => a + x, 0) / ps.length;
    const n = shownParticipation(user?.plan ?? '', now) ?? ps.length;
    if (n < 2) return null;
    const all = -Math.expm1(n * Math.log1p(-p));
    return { pct: (all / p - 1) * 100, n };
    // eslint-disable-next-line
  }, [mine, user, Math.floor(now / 5000)]);

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
    if (k === 'won') return !isOpen(r) && r.winnerUserId === user.id && !r.winnerIneligible;
    if (k === 'ineligible') return !isOpen(r) && r.winnerUserId === user.id && r.winnerIneligible;
    return true;
  }).length;
  const stats = [
    { l: 'sorteios que você participa hoje', v: shownParticipation(user.plan, now) ?? mine.length, c: 'var(--ink)', bg: '#fff' },
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
            items={(['all', 'open', 'ended', 'won', 'ineligible'] as Tab[]).map((k) => ({ key: k, label: { all: 'Todos', open: 'Em andamento', ended: 'Encerrados', won: 'Ganhei', ineligible: 'Inelegíveis' }[k], count: countOf(k) }))}
          />
          <LogoStrip />
        </div>

        {tab === 'won' && visible.length === 0 && (
          <div className="won-empty">
            <b>Você ainda não ganhou nenhum sorteio</b>
            {boost ? (
              <span>
                mas sua probabilidade de ganhar aumentou em <em>{boost.pct.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })}%</em> por participar de {boost.n} sorteios hoje, em vez de apenas 1.
              </span>
            ) : (
              <span>continue participando: quanto mais sorteios, maior a sua chance.</span>
            )}
          </div>
        )}

        <div className={`raffles ${tab === 'won' || tab === 'ineligible' ? 'compact' : ''}`}>
          {visible.slice(0, shown).map((r) => <RaffleCard key={r.id} r={r} now={now} userId={user.id} />)}
        </div>
      </main>
      <div className="toasts">
        {toasts.slice(-3).map((t) => (
          <Toast key={t.id} t={t} onClose={() => setToasts((x) => x.filter((y) => y.id !== t.id))} />
        ))}
      </div>
      <Console lines={lines} />
    </div>
  );
}
