'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, User } from '@/lib/api';

const PLANS = [
  { id: 'basico', name: 'Básico', price: 'R$ 19/mês', desc: '50 sorteios' },
  { id: 'pro', name: 'Pro', price: 'R$ 39/mês', desc: '200 sorteios' },
  { id: 'vip', name: 'VIP', price: 'R$ 79/mês', desc: 'Ilimitado' },
];

const empty = { name: '', email: '', cpf: '', phone: '', city: '', plan: 'pro' };

export default function Landing() {
  const router = useRouter();
  const [step, setStep] = useState<'form' | 'checkout'>('form');
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function pay() {
    setBusy(true);
    setErr('');
    try {
      // MOCK: aqui entra o checkout real depois. Por ora, "pagamento aprovado" cria o usuário.
      const user = await api<User>('/users', { method: 'POST', body: JSON.stringify(f) });
      localStorage.setItem('userId', user.id);
      router.push('/dashboard');
    } catch (e) {
      setErr('Não foi possível concluir. A API está rodando? ' + (e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <div className="wrap topbar">
        <b style={{ fontSize: 20 }}>🎯 SorteioPilot</b>
        <a href="/login" className="btn ghost sm">Já sou cliente</a>
      </div>
      <main className="wrap">
        <section className="hero">
          <div>
            <h1>Entre em <span>centenas de sorteios</span> sem mover um dedo.</h1>
            <p>Cadastre seus dados uma única vez. Nossa plataforma encontra os melhores sorteios, inscreve você automaticamente e avisa quando houver resultado.</p>
            <div className="steps" style={{ gridTemplateColumns: '1fr', margin: '24px 0 0' }}>
              <div className="card">1. Você preenche seus dados</div>
              <div className="card">2. Nós buscamos e inscrevemos você nos sorteios</div>
              <div className="card">3. Você acompanha tudo em tempo real</div>
            </div>
          </div>

          <div className="card">
            {step === 'form' ? (
              <form
                onSubmit={(e) => { e.preventDefault(); setStep('checkout'); }}
                style={{ display: 'grid', gap: 12 }}
              >
                <h2 style={{ margin: 0 }}>Comece agora</h2>
                <div><label>Nome completo</label><input required minLength={2} value={f.name} onChange={set('name')} /></div>
                <div><label>E-mail</label><input required type="email" value={f.email} onChange={set('email')} /></div>
                <div className="grid2">
                  <div><label>CPF</label><input required minLength={11} value={f.cpf} onChange={set('cpf')} placeholder="000.000.000-00" /></div>
                  <div><label>Telefone</label><input required minLength={8} value={f.phone} onChange={set('phone')} placeholder="(11) 99999-9999" /></div>
                </div>
                <div><label>Cidade</label><input required value={f.city} onChange={set('city')} /></div>
                <div>
                  <label>Plano</label>
                  <div className="plans">
                    {PLANS.map((p) => (
                      <div key={p.id} className={`plan ${f.plan === p.id ? 'on' : ''}`} onClick={() => setF({ ...f, plan: p.id })}>
                        <b>{p.name}</b><div style={{ fontSize: 13 }}>{p.price}</div>
                        <div style={{ fontSize: 12, color: 'var(--mut)' }}>{p.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <button className="btn">Continuar para o pagamento</button>
              </form>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                <h2 style={{ margin: 0 }}>Pagamento</h2>
                <div className="pending">
                  🧩 Espaço reservado para o checkout.<br />
                  Plano <b>{PLANS.find((p) => p.id === f.plan)?.name}</b> · {PLANS.find((p) => p.id === f.plan)?.price}
                </div>
                {err && <div style={{ color: '#f87171', fontSize: 13 }}>{err}</div>}
                <button className="btn" onClick={pay} disabled={busy}>
                  {busy ? 'Processando...' : 'Simular pagamento aprovado'}
                </button>
                <button className="btn ghost" onClick={() => setStep('form')} disabled={busy}>Voltar</button>
              </div>
            )}
          </div>
        </section>

        <section className="stats" style={{ marginBottom: 40 }}>
          <div className="card stat"><b>+500</b><span>sorteios monitorados</span></div>
          <div className="card stat"><b>+40</b><span>sites parceiros</span></div>
          <div className="card stat"><b>24h</b><span>inscrições automáticas</span></div>
          <div className="card stat"><b>100%</b><span>acompanhamento em tempo real</span></div>
        </section>

        <section className="steps" style={{ margin: '0 0 40px' }}>
          {[
            ['⚡ Automático', 'Você cadastra uma vez e o robô inscreve você em novos sorteios o dia todo.'],
            ['📊 Probabilidades', 'Priorizamos sorteios com menos concorrência para aumentar suas chances.'],
            ['🔔 Resultado ao vivo', 'Acompanhe contadores e veja o ganhador assim que o sorteio termina.'],
          ].map(([t, d]) => (
            <div key={t} className="card"><b>{t}</b><p style={{ fontSize: 15, margin: '8px 0 0' }}>{d}</p></div>
          ))}
        </section>

        <section style={{ marginBottom: 50 }}>
          <h2>Perguntas frequentes</h2>
          {[
            ['Preciso fazer algo depois de pagar?', 'Não. Após o pagamento você já é inscrito e acompanha tudo pelo painel.'],
            ['Quantos sorteios posso participar?', 'Depende do plano: 50, 200 ou ilimitados, com novos sorteios entrando o tempo todo.'],
            ['Como sei se ganhei?', 'O painel mostra o ganhador de cada sorteio quando o contador termina.'],
          ].map(([q, a]) => (
            <details key={q} className="card" style={{ marginBottom: 8 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{q}</summary>
              <p style={{ color: 'var(--mut)', marginBottom: 0 }}>{a}</p>
            </details>
          ))}
        </section>
      </main>
      <footer className="wrap" style={{ color: 'var(--mut)', padding: '20px 0 40px', fontSize: 13 }}>
        © SorteioPilot · ambiente de teste com dados fictícios
      </footer>
    </>
  );
}
