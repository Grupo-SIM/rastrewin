import { FlaskConicalIcon } from "lucide-react";
import Link from "next/link";
import { param, type SearchParams, type TestExcluded } from "@/lib/dashboard/context";

const plural = (n: number, one: string, many: string) =>
	`${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;

/**
 * Nota dos relatórios (plano 0008): visitantes de teste do período ficaram fora dos números.
 * Não aparece quando não há nenhum. O link abre Eventos no mesmo período, só com os testes.
 */
export function TestExcludedNote({ data, searchParams }: { data: TestExcluded; searchParams: SearchParams }) {
	if (!data.visitors) return null;
	const query = new URLSearchParams({ envio: "teste" });
	for (const key of ["periodo", "de", "ate"]) {
		const value = param(searchParams, key);
		if (value) query.set(key, value);
	}
	const what = data.events
		? `${plural(data.visitors, "visitante", "visitantes")} de teste (${plural(data.events, "evento", "eventos")})`
		: `${plural(data.visitors, "visitante", "visitantes")} de teste`;
	return (
		<p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
			<FlaskConicalIcon className="size-3.5 shrink-0" style={{ color: "var(--test)" }} aria-hidden />
			<span>
				{what} {data.visitors === 1 ? "ficou" : "ficaram"} fora destes números.
			</span>
			<Link
				href={`/painel/eventos?${query}`}
				className="text-primary underline-offset-4 hover:underline"
			>
				Ver em Eventos
			</Link>
		</p>
	);
}
