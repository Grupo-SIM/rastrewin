export function Logo({ badge, src = "/logos/Logo%20Rastrewinatt.svg" }: { badge?: string; src?: string }) {
	return (
		<span className="logo">
			<img src={src} alt="Rastrewin" />
			{badge && <span className="admin-badge">{badge}</span>}
		</span>
	);
}
