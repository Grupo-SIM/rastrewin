'use client';
import { useEffect, useRef, useState } from 'react';
import { api, fmtRemaining, Raffle } from '@/lib/api';
import { SiteIcon } from '@/components/SiteIcon';

export function RaffleCard({ r, now, userId }: { r: Raffle; now: number; userId: string }) {
  const [names, setNames] = useState<string[]>([]);
  const [me, setMe] = useState<{ index: number; name: string } | null>(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{ index: number; name: string; me: boolean }[] | null>(null);
  const [searching, setSearching] = useState(false);
  const offset = useRef(0);
  const loading = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  const hover = useRef(false);

  async function more() {
    if (loading.current) return;
    loading.current = true;
    try {
      const res = await api<{ items: string[]; nextOffset: number; me: { index: number; name: string } | null }>(
        `/raffles/${r.id}/participants?offset=${offset.current}&limit=30&userId=${userId}`,
      );
      if (res.me) setMe(res.me);
      offset.current = res.nextOffset;
      setNames((n) => [...n, ...res.items]);
    } finally {
      loading.current = false;
    }
  }
  useEffect(() => { more(); /* eslint-disable-next-line */ }, [r.id]);

  // rolagem automática: a lista parece não ter fim
  useEffect(() => {
    const t = setInterval(() => {
      const el = box.current;
      if (!el || hover.current) return;
      el.scrollTop += 1;
      if (el.scrollTop + el.clientHeight > el.scrollHeight - 60) more();
    }, 40);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [r.id]);

  // busca por nome (com pequeno atraso para não consultar a cada tecla)
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setFound(null); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await api<{ results: { index: number; name: string; me: boolean }[] }>(
          `/raffles/${r.id}/participants/search?q=${encodeURIComponent(term)}&userId=${userId}`,
        );
        setFound(res.results);
      } catch {
        setFound([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, r.id, userId]);

  const remaining = new Date(r.endsAt).getTime() - now;
  const ended = remaining <= 0;
  const urgent = !ended && remaining < 300000;
  const isMe = ended && r.winnerUserId === userId && !!r.winnerName;

  const pill = !ended
    ? urgent ? { t: 'Termina já', c: 'orange' } : { t: 'Ao vivo', c: 'blue' }
    : isMe ? { t: 'Você ganhou', c: 'green' } : r.winnerName ? { t: 'Encerrado', c: 'grey' } : { t: 'Apurando', c: 'grey' };

  return (
    <div className={`rcard ${urgent ? 'urgent' : ''}`}>
      <div className="top">
        <span className="site"><SiteIcon name={r.site} color={r.siteColor} size={24} />{r.site}</span>
        <span className={`pill ${pill.c}`}>{pill.t}</span>
      </div>
      <div>
        <h3>{r.title}</h3>
        <div className="meta">{r.participants.toLocaleString('pt-BR')} participantes · você está dentro ✔</div>
      </div>
      {!ended && (
        <>
          <div>
            <div className={`timer ${urgent ? 'urgent' : ''}`}>{fmtRemaining(remaining)}</div>
            <div className="timer-lbl">termina em</div>
          </div>
          <div className="psearch">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="7" cy="7" r="4.8" /><path d="M11 11l3 3" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome na lista..." aria-label="Buscar nome na lista" />
            {q ? (
              <button type="button" onClick={() => setQ('')} aria-label="Limpar busca">×</button>
            ) : me ? (
              <button type="button" className="mine" onClick={() => setQ(me.name.split(' ')[0])}>Meu nome</button>
            ) : null}
          </div>
          {found !== null || searching ? (
            <div className="plist results">
              {searching && <div className="hint">Buscando...</div>}
              {!searching && found?.length === 0 && <div className="hint">Nenhum nome encontrado</div>}
              {!searching && found?.map((f) => (
                <div key={f.index} className={f.me ? 'me' : ''}><span>#{f.index + 1}</span>{f.name}{f.me && <em>você</em>}</div>
              ))}
            </div>
          ) : (
          <div
            className="plist"
            ref={box}
            onMouseEnter={() => (hover.current = true)}
            onMouseLeave={() => (hover.current = false)}
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.scrollTop + el.clientHeight > el.scrollHeight - 40) more();
            }}
          >
            {names.map((n, i) => {
              const mine = me?.name === n;
              return <div key={i} className={mine ? 'me' : ''}><span>#{i + 1}</span>{n}{mine && <em>você</em>}</div>;
            })}
          </div>
          )}
        </>
      )}
      {ended && isMe && (
        <div className="res-me"><div><span className="big">Você ganhou!</span><span className="sub">{r.winnerName}</span></div></div>
      )}
      {ended && !isMe && r.winnerName && (
        <div className="win-wrap">
          <div className="win">
            <span className="win-av">{r.winnerName[0]}</span>
            <div className="win-txt"><span className="k">GANHADOR</span><span className="v">{r.winnerName}</span></div>
            <span className="win-tag">Sorteado</span>
          </div>
        </div>
      )}
      {ended && !r.winnerName && (
        <div className="res pending"><i className="dot blue" />Apurando resultado...</div>
      )}
    </div>
  );
}
