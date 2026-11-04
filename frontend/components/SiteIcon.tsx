import { siteInfo } from "@/lib/sites";

/** Logo do site (quando existe) ou inicial sobre a cor da marca. */
export function SiteIcon({ name, color, size = 24 }: { name: string; color?: string; size?: number }) {
	const s = siteInfo(name, color);
	const radius = Math.round(size * 0.29);
	if (s.logo) {
		return (
			<span
				className={`site-ico logo ${s.full ? "full" : ""}`}
				style={{ borderRadius: radius, height: size, width: size }}
			>
				<img src={s.logo} alt="" width={size} height={size} loading="lazy" />
			</span>
		);
	}
	return (
		<span
			className="site-ico"
			style={{
				background: s.color,
				borderRadius: radius,
				fontSize: Math.max(9, Math.round(size * 0.45)),
				height: size,
				width: size,
			}}
		>
			{name[0]}
		</span>
	);
}
