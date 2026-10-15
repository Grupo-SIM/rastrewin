const SITES: [string, string, string][] = [
  ['SorteioMax', '#ff5a36', '🎯'], ['PrêmioFácil', '#7c3aed', '🎁'], ['LuckyBR', '#16a34a', '🍀'],
  ['GanheJá', '#0ea5e9', '⚡'], ['MegaRifa', '#e11d48', '🎰'], ['TopPrêmios', '#f59e0b', '🏆'],
  ['SorteiaAí', '#14b8a6', '🎲'], ['CasaDoPrêmio', '#6366f1', '🏠'], ['RifaBrasil', '#84cc16', '🇧🇷'],
  ['PremiaMais', '#ec4899', '💎'],
];

export function LogoStrip() {
  const items = [...SITES, ...SITES];
  return (
    <div className="strip">
      <div className="strip-track">
        {items.map(([name, color, emoji], i) => (
          <span key={i} className="badge" style={{ background: color }}>
            {emoji} {name}
          </span>
        ))}
      </div>
    </div>
  );
}
