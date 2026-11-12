"use client";

import { ChevronDownIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatInt } from "@/lib/dashboard/format";

export interface CityRow {
	key: string;
	city: string;
	/** Estado (Brasil) ou nome do país (exterior). */
	place: string;
	visitors: number;
}

const STEP = 20;

/**
 * Cidades do período, das maiores para as menores. Mostra 20 e revela mais 20 a cada clique,
 * sem recarregar a página (a lista já veio inteira, até o teto da consulta). A lista rola dentro do
 * cartão para não esticar o mapa ao lado; ao revelar mais, ela rola até a primeira cidade nova.
 */
export function CitiesTable({ rows, total }: { rows: CityRow[]; total: number }) {
	const [shown, setShown] = useState(STEP);
	const boxRef = useRef<HTMLDivElement>(null);
	const visible = rows.slice(0, shown);
	const remaining = rows.length - visible.length;

	function showMore() {
		const first = shown; // índice da primeira cidade nova
		setShown(n => n + STEP);
		requestAnimationFrame(() => {
			const box = boxRef.current;
			const row = box?.querySelectorAll("tbody tr")[first] as HTMLElement | undefined;
			const head = box?.querySelector("thead")?.offsetHeight ?? 0;
			if (box && row) box.scrollTo({ behavior: "smooth", top: row.offsetTop - head });
		});
	}
	return (
		<div className="flex flex-col gap-3">
			<div ref={boxRef} className="max-h-96 overflow-auto">
				<table className="w-full text-sm">
					<thead className="bg-card sticky top-0">
						<tr className="text-muted-foreground border-b text-left text-xs">
							<th scope="col" className="py-2 pr-3 font-medium">
								Cidade
							</th>
							<th scope="col" className="py-2 pr-3 font-medium">
								Estado / país
							</th>
							<th scope="col" className="py-2 text-right font-medium">
								Visitantes
							</th>
						</tr>
					</thead>
					<tbody>
						{visible.map(c => (
							<tr key={c.key} className="border-b last:border-0">
								<td className="py-1.5 pr-3">{c.city}</td>
								<td className="text-muted-foreground py-1.5 pr-3">{c.place}</td>
								<td className="num py-1.5 text-right">{formatInt(c.visitors)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
				<span>
					Mostrando <span className="num">{formatInt(visible.length)}</span> de{" "}
					<span className="num">{formatInt(total)}</span> cidade(s)
					{total > rows.length && ` (a lista vai até as ${formatInt(rows.length)} maiores)`}
				</span>
				{remaining > 0 && (
					<Button variant="outline" className="h-10" onClick={() => showMore()}>
						<ChevronDownIcon />
						Ver mais {formatInt(Math.min(STEP, remaining))}
					</Button>
				)}
			</div>
		</div>
	);
}
