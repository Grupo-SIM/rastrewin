import { SiteIcon } from "@/components/SiteIcon";
import { SITES } from "@/lib/sites";

export function LogoStrip() {
	return (
		<div className="strip" aria-hidden>
			<div className="strip-track">
				{[...SITES, ...SITES].map((s, i) => (
					<span key={i} className="strip-chip">
						<SiteIcon name={s.name} size={18} />
						{s.name}
					</span>
				))}
			</div>
		</div>
	);
}
