import type { Origin } from "@/lib/tracking/referrer";

/**
 * Origem de um evento/visitante: UTM em tinta normal; sem UTM, o site de onde veio (domínio no
 * title, ou visível com withHost); sem nada, "Direto / sem referência", apagado.
 */
export function OriginText({ origin, withHost = false }: { origin: Origin; withHost?: boolean }) {
	if (origin.kind === "utm") return <span>{origin.label}</span>;
	if (origin.kind === "direto") return <span className="text-muted-foreground">{origin.label}</span>;
	return (
		<span title={origin.detail ?? undefined}>
			{origin.label}
			<span className="text-muted-foreground">
				{" "}
				· sem UTM
				{withHost && origin.detail && origin.detail !== origin.label ? ` · ${origin.detail}` : ""}
			</span>
		</span>
	);
}
