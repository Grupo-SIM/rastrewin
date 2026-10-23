'use client';
import { useEffect, useState } from 'react';
import { api, fmtRemaining, User } from '@/lib/api';
import { Logo } from '@/components/Logo';
import { SiteIcon } from '@/components/SiteIcon';
import { SITES as ALL_SITES } from '@/lib/sites';
import { isValidCpf, maskCpf, maskPhone } from '@/lib/mask';

const PLANS = [
  { id: 'basico', name: 'Básico', price: 'R$ 150/ano', desc: 'até 500 sorteios/dia' },
  { id: 'pro', name: 'Pro', price: 'R$ 500/ano', desc: 'até 2.000 sorteios/dia' },
  { id: 'vip', name: 'VIP', price: 'R$ 1000/ano', desc: 'até 5.000 sorteios/dia' },
];

const STEPS = [
  { n: '01', t: 'Você se cadastra uma vez', bg: 'radial-gradient(120% 90% at 100% 0%,#e3f0ff 0%,#f1f7ff 45%,rgba(241,247,255,0) 100%)', c: '#3b82f6' },
  { n: '02', t: 'A IA te inscreve todos os dias', bg: 'radial-gradient(120% 90% at 100% 0%,#ffe9d4 0%,#fff5ec 45%,rgba(255,245,236,0) 100%)', c: '#ff8a1f' },
  { n: '03', t: 'Você acompanha tudo em tempo real', bg: 'radial-gradient(120% 90% at 100% 0%,#dcfbe6 0%,#effdf3 45%,rgba(239,253,243,0) 100%)', c: '#16a34a' },
];

const SITES: [string, string][] = ALL_SITES.slice(0, 10).map((x) => [x.name, x.color]);
const SCATTER = [['3%', '8%', '-6deg'], ['8%', '38%', '4deg'], ['6%', '62%', '3deg'], ['20%', '82%', '-5deg'], ['74%', '6%', '5deg'],
  ['84%', '26%', '-4deg'], ['70%', '66%', '-3deg'], ['86%', '84%', '6deg'], ['40%', '4%', '-2deg'], ['44%', '88%', '3deg']];

const LOG = [
  'Buscando sorteios...', 'Cadastrando você nos melhores sorteios...', 'Sorteios encontrados!', 'Calculando melhores probabilidades...',
  'Verificando regulamentos...', 'Preenchendo formulário automaticamente...', 'Confirmando sua participação...', 'Inscrição confirmada ✔',
];

const FAQ = [
  ['Preciso fazer algo depois de pagar?', 'Não. Após o pagamento você já é inscrito e acompanha tudo pelo painel.'],
  ['Quantos sorteios posso participar?', 'Depende do plano: até 500, 2.000 ou 5.000 sorteios por dia, com novos sorteios entrando o tempo todo.'],
  ['Como sei se ganhei?', 'O painel mostra o ganhador de cada sorteio quando o contador termina.'],
];

const empty = { name: '', email: '', cpf: '', phone: '', pix: '', city: '', plan: 'pro' };
const pad = (n: number) => String(n).padStart(2, '0');
const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

export default function Landing() {
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [heroEmail, setHeroEmail] = useState('');
  const [tick, setTick] = useState(0);
  const [lines, setLines] = useState<{ s: string; t: string }[]>([]);
  const [demoEnd] = useState(() => Date.now() + (2 * 3600 + 14 * 60) * 1000);

  useEffect(() => {
    setLines([{ s: LOG[0], t: clock(new Date()) }]);
    let i = 1;
    const a = setInterval(() => setTick((t) => t + 1), 1000);
    const b = setInterval(() => setLines((l) => [...l, { s: LOG[i++ % LOG.length], t: clock(new Date()) }].slice(-5)), 2200);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);

  const [cpfErr, setCpfErr] = useState('');
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const v = k === 'cpf' ? maskCpf(raw) : k === 'phone' ? maskPhone(raw) : raw;
    if (k === 'cpf') setCpfErr('');
    setF({ ...f, [k]: v });
  };
  function start(e: React.FormEvent) {
    e.preventDefault();
    if (heroEmail) setF((x) => ({ ...x, email: heroEmail }));
    document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function submitAndCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidCpf(f.cpf)) return void setCpfErr('CPF inválido.');
    setBusy(true);
    setErr('');
    // abre a aba já no clique (gesto do usuário), senão o navegador bloqueia o popup
    // depois que a resposta da API chegar.
    const checkoutTab = window.open('', '_blank');
    try {
      const user = await api<User & { checkoutUrl: string }>('/users', { method: 'POST', body: JSON.stringify(f) });
      localStorage.setItem('userId', user.id);
      if (checkoutTab) checkoutTab.location.href = user.checkoutUrl;
      else window.location.href = user.checkoutUrl;
    } catch (e) {
      checkoutTab?.close();
      setErr('Não foi possível concluir. A API está rodando? ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const demoMs = demoEnd - Date.now();
  void tick;

  return (
    <div className="shell">
      {/* HERO */}
      <div className="hero-frame">
        <div className="hero-photos" aria-hidden>
          <div className="ph a cut" style={{ backgroundImage: "url(/prizes/iphone.webp)" }} />
          <div className="ph b cut" style={{ backgroundImage: "url(/prizes/viagem.webp)" }} />
          <div className="ph c cut" style={{ backgroundImage: "url(/prizes/moto.webp)" }} />
          <div className="ph d cut" style={{ backgroundImage: "url(/prizes/pix.webp)" }} />
        </div>
        <nav className="nav">
          <a href="/"><Logo /></a>
          <a href="#planos" className="nav-hide" style={{ display: 'flex', alignItems: 'center', gap: 10, font: '600 15px var(--f-body)', color: 'var(--ink-2)' }}>
            <span className="pill blue" style={{ fontSize: 13 }}>Novo</span>+149.000 sorteios monitorados ↓
          </a>
          <div className="nav-links">
            <a href="/login" className="plain"><span className="nav-hide">Já sou cliente</span><span className="m-only">Entrar</span></a>
            <a href="#planos" className="btn-rainbow sm">Começar</a>
          </div>
        </nav>

        <div className="hero-body">
          <span className="tag">Nós inscrevemos você.</span>
          <h1 className="display">Entre em <span className="accent">milhares</span> de sorteios sem mover um dedo.</h1>
          <p className="lead">Cadastre seus dados uma única vez. Nossa plataforma encontra os melhores sorteios, inscreve você automaticamente e avisa quando houver resultado.</p>
          <form className="hero-input" onSubmit={start}>
            <input type="email" placeholder="seu melhor e-mail" value={heroEmail} onChange={(e) => setHeroEmail(e.target.value)} aria-label="E-mail" />
            <button className="btn-rainbow">Começar</button>
          </form>
          <a href="#planos" className="plan-chip">
            <span className="pro">Pro</span>
            <span style={{ display: 'grid', gap: 3 }}>
              <span className="t">Plano Pro<span className="badge-pop">POPULAR</span></span>
              <span className="s">até 2.000 sorteios/dia · R$ 500/ano</span>
            </span>
            <span style={{ fontSize: 22, color: 'var(--txt-2)', marginLeft: 18 }}>→</span>
          </a>
        </div>
        <div className="hero-photos" aria-hidden>
          <div className="mob"><div className="ph a cut" style={{ backgroundImage: "url(/prizes/iphone.webp)" }} /><div className="ph b cut" style={{ backgroundImage: "url(/prizes/viagem.webp)" }} /><div className="ph c cut" style={{ backgroundImage: "url(/prizes/moto.webp)" }} /><div className="ph d cut" style={{ backgroundImage: "url(/prizes/pix.webp)" }} /></div>
        </div>
      </div>

      {/* COMO FUNCIONA */}
      <section className="section">
        <div className="sec-head">
          <span className="eyebrow">Como funciona</span>
          <h2 className="display">Três passos. Depois é com a IA.</h2>
        </div>
        <div className="steps3">
          {STEPS.map((s) => (
            <div key={s.n} className="step" style={{ background: s.bg }}>
              <div><span className="n" style={{ color: s.c }}>{s.n}</span><span className="t">{s.t}</span></div>
            </div>
          ))}
        </div>
      </section>

      {/* AUTOMÁTICO */}
      <section className="section feat stage-left">
        <div className="feat-copy">
          <span className="feat-tag" style={{ background: 'var(--orange-bg)', color: 'var(--orange-fg)' }}>Oportunidades</span>
          <h2 className="display">Mais de <span className="accent">4 milhões</span> de sorteios acontecem todos os meses.</h2>
          <p className="copy">Nossa IA varre as principais redes sociais e o Google para monitorar, verificar regulamentos e inscrever você nas melhores oportunidades do mercado.</p>
          <div className="dots-wrap" style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
            <div className="dots">{['Instagram', 'Facebook', 'TikTok', ...ALL_SITES.map((s) => s.name).filter((n) => !['Instagram', 'Facebook', 'TikTok'].includes(n))].slice(0, 5).map((n) => <SiteIcon key={n} name={n} size={34} />)}</div>
            <span style={{ font: '500 15px var(--f-body)', color: 'var(--mut)' }}>15 sites e redes mapeados</span>
          </div>
        </div>
        <div className="feat-stage" style={{ background: 'radial-gradient(120% 90% at 100% 0%,#ffe9d4 0%,#fff5ec 45%,rgba(255,245,236,0) 100%)' }}>
          <div className="stage-card" style={{ width: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ font: '600 18px var(--f-body)', color: 'var(--txt-2)' }}>IA em execução</span>
              <span className="pill orange" style={{ fontSize: 13 }}><i className="dot orange" />Ao vivo</span>
            </div>
            <div style={{ display: 'grid', gap: 2 }}>
              {lines.map((l, i) => (
                <div key={l.t + i} className="log-row" style={{ opacity: i === lines.length - 1 ? 1 : 0.55 }}>
                  <span className="ck">✓</span><span className="s">{l.s}</span><span className="tm">{l.t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PROBABILIDADES */}
      <section className="section feat">
        <div className="feat-copy">
          <span className="feat-tag" style={{ background: 'var(--blue-bg)', color: 'var(--ink-2)' }}>Chance real</span>
          <h2 className="display">A IA entra onde você tem <span className="accent">mais probabilidade</span>.</h2>
          <p className="copy">Enquanto a maioria das pessoas disputa sorteios de influenciadores com milhões de comentários, nós encontramos as oportunidades escondidas que ninguém está vendo.</p>
          <div className="checks">
            {['Foco em prêmios de alto valor (PIX, carros, motos, eletrônicos, viagens, etc)', '+100 mil sorteios analisados diariamente', 'Acompanhamento 100% transparente e em tempo real'].map((c) => (
              <div key={c}><span>✓</span>{c}</div>
            ))}
          </div>
        </div>
        <div className="feat-stage hide-m" style={{ height: 520, background: 'radial-gradient(120% 90% at 0% 0%,#e3f0ff 0%,#f1f7ff 45%,rgba(241,247,255,0) 100%)' }}>
          <div className="stage-card" style={{ width: 380, padding: 26, gap: 18, justifyItems: 'center', textAlign: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, font: '600 14px var(--f-body)', color: 'var(--txt-2)' }}>
              <SiteIcon name="GanheJá" size={22} />GanheJá
            </span>
            <span style={{ font: '600 22px var(--f-display)', letterSpacing: '-.03em', color: 'var(--ink)' }}>Sorteio R$ 10.000 no PIX</span>
            <span className="demo-timer">{fmtRemaining(demoMs)}</span>
            <span style={{ font: '500 14px var(--f-body)', color: 'var(--mut)', marginTop: -8 }}>termina em</span>
            <div style={{ width: '100%', display: 'grid', gap: 8 }}>
              <div className="demo-row"><span>Participantes</span><b style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{(233901 + tick * 3).toLocaleString('pt-BR')}</b></div>
              <div className="demo-row"><span>Sua inscrição</span><span className="pill green" style={{ fontSize: 13, padding: '2px 8px', borderRadius: 6 }}>Confirmada</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* RESULTADO AO VIVO */}
      <section className="scatter">
        {SITES.map(([n, c], i) => (
          <span key={n} className="chip" style={{ left: SCATTER[i][0], top: SCATTER[i][1], transform: `rotate(${SCATTER[i][2]})` }}>
            <SiteIcon name={n} color={c} size={30} />{n}
          </span>
        ))}
        <div className="center">
          <span style={{ font: '500 16px var(--f-body)', color: 'var(--mut)' }}>Resultado ao vivo</span>
          <h2 className="display">Veja o ganhador assim que o <span className="accent">sorteio termina</span>.</h2>
          <p style={{ maxWidth: 480, font: '400 18px/1.5 var(--f-body)', color: 'var(--ink-soft)' }}>Monitoramos dezenas de portais e redes em paralelo para que você acompanhe o status e os vencedores de cada inscrição.</p>
          <a href="#planos" className="btn-dark" style={{ marginTop: 8 }}>Comece agora</a>
        </div>
      </section>

      {/* PLANOS / CADASTRO */}
      <section id="planos" className="section plans-sec" style={{ paddingTop: 110, scrollMarginTop: 20 }}>
        <div className="intro" style={{ display: 'grid', gap: 20, paddingTop: 24, alignContent: 'start' }}>
          <span style={{ font: '500 16px var(--f-body)', color: 'var(--mut)' }} className="hide-m">Planos</span>
          <h2 className="display" style={{ fontSize: 56 }}>Bônus Exclusivo</h2>
          <p style={{ font: '400 18px/1.55 var(--f-body)', color: 'var(--ink-soft)', maxWidth: 400 }}>Assine a IA e receba até 100% em cashback.</p>
          <p style={{ font: '400 16px/1.55 var(--f-body)', color: 'var(--ink-soft)', maxWidth: 400, marginTop: -10 }}>Assine agora e receba até R$ 250 de volta instantaneamente para utilizar como quiser no app Vale Bônus.</p>
          <div style={{ display: 'grid', gap: 14, color: 'var(--ink-2)', font: '500 18px/1.35 var(--f-body)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}><span style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: '50%', background: 'var(--blue-bg)', fontSize: 18 }}>✓</span><span><strong>Básico:</strong> R$ 150 de <strong style={{ color: '#2f9e5b' }}>cashback</strong> (100% de volta)</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}><span style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: '50%', background: 'var(--blue-bg)', fontSize: 18 }}>✓</span><span><strong>Pro:</strong> R$ 250 de <strong style={{ color: '#2f9e5b' }}>cashback</strong> na hora</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}><span style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: '50%', background: 'var(--blue-bg)', fontSize: 18 }}>✓</span><span><strong>VIP:</strong> R$ 250 de <strong style={{ color: '#2f9e5b' }}>cashback</strong> na hora</span></div>
          </div>
        </div>
        <div className="plans-card">
          <form className="form-grid" onSubmit={submitAndCheckout}>
            <div className="plan-pick">
              {PLANS.map((p) => (
                <button type="button" key={p.id} className={`plan-opt ${f.plan === p.id ? 'on' : ''}`} onClick={() => setF({ ...f, plan: p.id })}>
                  <span className="top"><b>{p.name}</b>{p.id === 'pro' && <span className="badge-pop" style={{ fontSize: 9.5 }}>POPULAR</span>}</span>
                  <span className="desc">{p.desc}</span>
                  <span className="price">{p.price}</span>
                </button>
              ))}
            </div>
            <div className="field"><label>Nome completo</label><input required minLength={2} value={f.name} onChange={set('name')} autoComplete="name" /></div>
            <div className="field"><label>E-mail</label><input required type="email" value={f.email} onChange={set('email')} autoComplete="email" /></div>
            <div className="row2">
              <div className="field">
                <label>CPF</label>
                <input required minLength={14} inputMode="numeric" value={f.cpf} onChange={set('cpf')} placeholder="000.000.000-00" />
                {cpfErr && <span className="err" style={{ fontSize: 13 }}>{cpfErr}</span>}
              </div>
              <div className="field"><label>Telefone</label><input required minLength={14} type="tel" value={f.phone} onChange={set('phone')} placeholder="(11) 99999-9999" autoComplete="tel" /></div>
            </div>
            <div className="field"><label>Chave Pix <span style={{ color: 'var(--mut)', fontWeight: 500 }}>(para receber prêmios em dinheiro)</span></label><input required minLength={3} value={f.pix} onChange={set('pix')} placeholder="CPF, e-mail, telefone ou chave aleatória" /></div>
            <div className="field"><label>Cidade</label><input required value={f.city} onChange={set('city')} autoComplete="address-level2" /></div>
            {err && <div className="err">{err}</div>}
            <button className="btn-rainbow" style={{ marginTop: 6 }} disabled={busy}>{busy ? 'Abrindo pagamento...' : 'Continuar para o pagamento'}</button>
          </form>
        </div>
      </section>

      {/* FAQ */}
      <section className="section faq-sec">
        <h2 className="display">Perguntas frequentes</h2>
        <div className="faq-list">
          {FAQ.map(([q, a]) => (
            <details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>
          ))}
        </div>
      </section>

      <footer className="foot">
        <span className="foot-brand">
          <Logo src="/logos/Logo%20Rastrewin%2001.png" />
          <span>© Rastrewin</span>
        </span>
        <span style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <a href="/termos">Termos de Uso</a>
          <a href="/login">Já sou cliente</a>
        </span>
      </footer>
    </div>
  );
}
