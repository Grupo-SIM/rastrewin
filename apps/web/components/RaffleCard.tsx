'use client';
import { useEffect, useRef, useState } from 'react';
import { api, fmtRemaining, Raffle } from '@/lib/api';

export function RaffleCard({ r, now, userId }: { r: Raffle; now: number; userId: string }) {
  const [names, setNames] = useState<string[]>([]);
  const offset = useRef(0);
  const loading = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  const hover = useRef(false);

  async function more() {
    if (loading.current) return;
    loading.current = true;
    try {
      const res = await api<{ items: string[]; nextOffset: number }>(`/raffles/${r.id}/participants?offset=${offset.current}&limit=30`);
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

  const remaining = new Date(r.endsAt).getTime() - now;
  const ended = remaining <= 0;
  const isMe = ended && r.winnerUserId === userId;

  return (
    <div className="card raffle">
      <span className="badge" style={{ background: r.siteColor }}>{r.siteEmoji} {r.site}</span>
      <h3>{r.title}</h3>
      <div style={{ color: 'var(--mut)', fontSize: 13 }}>
        {r.participants.toLocaleString('pt-BR')} participantes · você está dentro ✔
      </div>
      <div className="timer">{ended ? 'Encerrado' : fmtRemaining(remaining)}</div>
      {ended ? (
        r.winnerName ? (
          <div className={`winner ${isMe ? 'me' : ''}`}>
            {isMe ? '🎉 VOCÊ GANHOU!' : '🏆 Ganhador'}<br />{r.winnerName}
          </div>
        ) : (
          <div className="pending">⏳ Apurando resultado...</div>
        )
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
          {names.map((n, i) => <div key={i}>{i + 1}. {n}</div>)}
        </div>
      )}
    </div>
  );
}
