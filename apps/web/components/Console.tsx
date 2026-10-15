'use client';
import { useEffect, useState } from 'react';

const MSGS = [
  'Buscando sorteios...', 'Cadastrando você nos melhores sorteios...', 'Sorteios encontrados!',
  'Calculando melhores probabilidades...', 'Verificando regulamentos...', 'Preenchendo formulário automaticamente...',
  'Confirmando sua participação...', 'Analisando concorrência...', 'Priorizando sorteios com menos participantes...',
  'Monitorando resultados em tempo real...', 'Novo sorteio detectado!', 'Inscrição confirmada ✔',
];

export function Console({ extra }: { extra: string[] }) {
  const [lines, setLines] = useState<string[]>([MSGS[0]]);
  useEffect(() => {
    let i = 1;
    const t = setInterval(() => setLines((l) => [...l, MSGS[i++ % MSGS.length]].slice(-5)), 2200);
    return () => clearInterval(t);
  }, []);
  const all = [...lines, ...extra].slice(-6);
  return (
    <div className="console">
      <div className="hd"><span>● robô em execução</span><span>SorteioPilot</span></div>
      {all.map((l, i) => <div key={i} className="ln">&gt; {l}</div>)}
    </div>
  );
}
