'use client';
import { useEffect, useState } from 'react';

const MSGS = [
  'Buscando sorteios...', 'Cadastrando você nos melhores sorteios...', 'Sorteios encontrados!',
  'Calculando melhores probabilidades...', 'Verificando regulamentos...', 'Preenchendo formulário automaticamente...',
  'Confirmando sua participação...', 'Analisando concorrência...', 'Priorizando sorteios com menos participantes...',
  'Monitorando resultados em tempo real...', 'Novo sorteio detectado!', 'Inscrição confirmada ✔',
];

export type RobotLine = { s: string; t: string };

const pad = (n: number) => String(n).padStart(2, '0');
const clock = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };

/** Linhas do "robô": mensagens genéricas rotativas, com horário. */
export function useRobotLines(): RobotLine[] {
  const [lines, setLines] = useState<RobotLine[]>([]);

  useEffect(() => {
    setLines([{ s: MSGS[0], t: clock() }]);
    let i = 1;
    const t = setInterval(() => setLines((l) => [...l, { s: MSGS[i++ % MSGS.length], t: clock() }].slice(-5)), 2200);
    return () => clearInterval(t);
  }, []);

  return lines;
}

export function Console({ lines }: { lines: RobotLine[] }) {
  const [open, setOpen] = useState(false); // barra mobile expandida
  const [min, setMin] = useState(false); // card desktop minimizado
  const lastLine = lines[lines.length - 1];
  const last = lastLine?.s ?? '';
  const lastKey = `${lastLine?.t ?? ''}${last}`;
  return (
    <>
      <div className={`console ${min ? 'min' : ''}`}>
        <div className="hd">
          <span>Atividade do robô</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="pill orange"><i className="dot orange" />Ao vivo</span>
            <button className="con-toggle" onClick={() => setMin((m) => !m)} aria-label={min ? 'Expandir robô' : 'Minimizar robô'} aria-expanded={!min}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5l4 4 4-4" /></svg>
            </button>
          </span>
        </div>
        <div className="con-body">
          <div className="con-inner">
            {lines.map((l, i) => (
              <div key={l.t + i} className="ln" style={{ opacity: i === lines.length - 1 ? 1 : 0.55 }}>
                <span className="ok">✓</span><span className="s">{l.s}</span><span className="tm">{l.t}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="con-ticker">
          <div className="con-ticker-inner">
            <div key={lastKey} className="ln tick"><span className="ok">✓</span><span className="s">{last}</span></div>
          </div>
        </div>
      </div>
      <div className="console-m" onClick={() => setOpen((o) => !o)} role="button" aria-expanded={open}>
        <div className="bar">
          <span className="pill green" style={{ fontSize: 11.5 }}><i className="dot green" />robô</span>
          <span key={lastKey} className="s tick">{last}</span>
          <span className="ar">{open ? '▾' : '▴'}</span>
        </div>
        <div className={`con-body ${open ? 'open' : ''}`}>
          <div className="con-inner more">
            {lines.map((l, i) => (
              <div key={i} style={{ opacity: i === lines.length - 1 ? 1 : 0.55 }}><span className="ok">✓</span>{l.s}</div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
