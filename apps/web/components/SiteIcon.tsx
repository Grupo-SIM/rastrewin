import { siteInfo } from '@/lib/sites';

/** Logo do site (quando existe) ou inicial sobre a cor da marca. */
export function SiteIcon({ name, color, size = 24 }: { name: string; color?: string; size?: number }) {
  const s = siteInfo(name, color);
  const radius = Math.round(size * 0.29);
  if (s.logo) {
    return (
      <span className={`site-ico logo ${s.full ? 'full' : ''}`} style={{ width: size, height: size, borderRadius: radius }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={s.logo} alt="" width={size} height={size} loading="lazy" />
      </span>
    );
  }
  return (
    <span className="site-ico" style={{ width: size, height: size, borderRadius: radius, background: s.color, fontSize: Math.max(9, Math.round(size * 0.45)) }}>
      {name[0]}
    </span>
  );
}
