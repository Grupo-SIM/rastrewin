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
type Summary = { open: number; ended: number; total: number; won: number };
type Page = { items: Raffle[]; total: number; nextOffset: number | null };
const PAGE = 24; // sorteios por página
const REFRESH_MS = 5000; // contagens e páginas já carregadas
const RESULTS_MS = 5000; // checagem de resultados novos (avisos)
const TOAST_GAP_MS = 4 * 1000; // intervalo mínimo entre dois avisos (só espaça rajadas; cada sorteio encerrado gera o seu)

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<Raffle[]>([]); // só a(s) página(s) carregada(s) da aba atual
  const [total, setTotal] = useState(0); // total de sorteios da aba atual
  const [summary, setSummary] = useState<Summary>({ open: 0, ended: 0, total: 0, won: 0 });
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState<Tab>('all');
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [queue, setQueue] = useState<ToastData[]>([]);
  const lastToast = useRef(0);
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

  // A plataforma abre até 5.000 sorteios por dia: nada de baixar a lista inteira. Tudo é paginado e só o que está
  // na tela é atualizado (contagens + páginas já carregadas), uma chamada por vez e pausando com a aba escondida.
  const tabRef = useRef<Tab>('all');
  const itemsRef = useRef<Raffle[]>([]);
  const totalRef = useRef(0);
  const busy = useRef(false);
  const uidRef = useRef<string | null>(null);
  itemsRef.current = items;
  totalRef.current = total;

  const midnightIso = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
  };
  const listUrl = (tab: Tab, offset: number, limit: number) =>
    `/raffles?userId=${uidRef.current}&since=${midnightIso()}&tab=${tab}&offset=${offset}&limit=${limit}`;

  const refresh = useCallback(async () => {
    if (!uidRef.current || busy.current) return;
    busy.current = true;
    const tab = tabRef.current;
    try {
      const limit = Math.min(200, Math.max(PAGE, itemsRef.current.length));
      const [sum, page] = await Promise.all([
        api<Summary>(`/raffles/summary?userId=${uidRef.current}&since=${midnightIso()}`),
        api<Page>(listUrl(tab, 0, limit)),
      ]);
      if (tabRef.current !== tab) return; // trocou de aba no meio da chamada
      setSummary(sum);
      setItems(page.items);
      setTotal(page.total);
      setLoaded(true);
    } catch {
      /* tenta de novo no próximo ciclo */
    } finally {
      busy.current = false;
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!uidRef.current || busy.current || itemsRef.current.length >= totalRef.current) return;
    busy.current = true;
    const tab = tabRef.current;
    try {
      const page = await api<Page>(listUrl(tab, itemsRef.current.length, PAGE));
      if (tabRef.current !== tab) return;
      setItems((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...page.items.filter((r) => !seen.has(r.id))];
      });
      setTotal(page.total);
    } catch {
      /* idem */
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    const uid = localStorage.getItem('userId');
    if (!uid) return void router.replace('/');
    uidRef.current = uid;
    api<User>(`/users/${uid}`).then(setUser).catch(() => router.replace('/'));
    refresh();
    const onScreen = () => document.visibilityState === 'visible';
    const poll = setInterval(() => onScreen() && refresh(), REFRESH_MS);
    const userPoll = setInterval(() => onScreen() && api<User>(`/users/${uid}`).then(setUser).catch(() => {}), 20000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const onVisible = () => onScreen() && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(poll); clearInterval(userPoll); clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [router, refresh]);

  // trocar de aba zera a lista e busca a primeira página dela
  useEffect(() => {
    tabRef.current = tab;
    setItems([]);
    setTotal(0);
    setLoaded(false);
    busy.current = false;
    refresh();
  }, [tab, refresh]);

  // avisos de resultado: a cada 5 s olha os 8 encerrados mais recentes; todo sorteio que acabou ganha o seu aviso
  useEffect(() => {
    if (!user || user.status !== 'ACTIVE') return;
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const page = await api<Page>(`/raffles?userId=${user.id}&since=${midnightIso()}&tab=ended&offset=0&limit=8`);
        const done = page.items.filter((r) => r.winnerName);
        if (notified.current === null) {
          notified.current = new Set(done.map((r) => r.id)); // não avisa o que já estava encerrado ao abrir
          return;
        }
        const fresh = done.filter((r) => !notified.current!.has(r.id));
        if (!fresh.length) return;
        fresh.forEach((r) => notified.current!.add(r.id));
        // entram numa fila: os do próprio usuário vão na frente e a fila guarda no máximo 8 avisos
        setQueue((q) => {
          const add = fresh.map((r): ToastData => ({
            id: r.id, me: r.winnerUserId === user.id, winner: r.winnerName ?? '', prize: r.title, site: r.site, color: r.siteColor,
          }));
          const all = [...q, ...add];
          return [...all.filter((x) => x.me), ...all.filter((x) => !x.me)].slice(0, 8);
        });
      } catch {
        /* idem */
      }
    };
    check();
    const t = setInterval(check, RESULTS_MS);
    return () => clearInterval(t);
  }, [user?.id, user?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // libera um aviso por vez, com pelo menos 4 s entre eles; no máximo 2 na tela no celular (3 no desktop)
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
  // scroll infinito: perto do fim, pede a próxima página ao servidor
  useEffect(() => {
    const onScroll = () => {
      if (window.innerHeight + window.scrollY > document.body.offsetHeight - 400) loadMore();
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [loadMore]);

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

  const countOf = (k: Tab) => ({ all: summary.total, open: summary.open, ended: summary.ended, won: summary.won }[k]);
  const stats = [
    { l: 'sorteios que você participa hoje', v: summary.total, c: 'var(--ink)', bg: '#fff' },
    { l: 'em andamento', v: summary.open, c: 'var(--ink)', bg: 'var(--blue-bg)' },
    { l: 'encerrados', v: summary.ended, c: 'var(--ink)', bg: 'var(--line)' },
    { l: 'prêmios ganhos', v: summary.won, c: 'var(--green-fg)', bg: 'var(--green-bg)' },
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
            onChange={setTab}
            items={(['all', 'open', 'ended', 'won'] as Tab[]).map((k) => ({ key: k, label: { all: 'Todos', open: 'Em andamento', ended: 'Encerrados', won: 'Ganhei' }[k], count: countOf(k) }))}
          />
          <LogoStrip />
        </div>

        {tab === 'won' && loaded && total === 0 && (
          <div className="won-empty">
            <b>Você ainda não ganhou nenhum sorteio</b>
          </div>
        )}

        <div className={`raffles ${tab === 'won' ? 'compact' : ''}`}>
          {items.map((r) => <RaffleCard key={r.id} r={r} now={now} userId={user.id} />)}
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
