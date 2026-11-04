"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatPct, formatValue, type ValueKind } from "@/lib/dashboard/format";

/*
 * Barra segmentada ALTA (28px): um todo dividido em até 6 partes, lido de relance.
 * Cor por ENTIDADE (a mesma forma de pagamento tem sempre a mesma cor), 2px de vão entre blocos,
 * % dentro do bloco só se couber; legenda com os nomes; tooltip por bloco.
 */
export function SegmentedBar({
	parts,
	kind = "money",
	currency = "BRL",
}: {
	parts: { key: string; label: string; value: number; color: string }[];
	kind?: ValueKind;
	currency?: string;
}) {
	const format = (n: number) => formatValue(n, kind, currency);
	const total = parts.reduce((s, p) => s + p.value, 0);
	if (!total)
		return <p className="text-muted-foreground py-6 text-center text-sm">Sem vendas no período</p>;
	const visible = parts.filter(p => p.value > 0);
	return (
		<div className="flex flex-col gap-3">
			<div
				className="flex h-7 gap-[2px]"
				role="img"
				aria-label={visible.map(p => `${p.label} ${formatPct(p.value / total)}`).join(", ")}
			>
				{visible.map(p => {
					const share = p.value / total;
					return (
						<Tooltip key={p.key}>
							<TooltipTrigger asChild>
								<div
									className="focus-visible:ring-ring/50 flex h-full min-w-1 items-center overflow-hidden rounded-[4px] px-2 outline-none hover:brightness-110 focus-visible:ring-3"
									style={{ background: p.color, width: `${share * 100}%` }}
								>
									{share >= 0.14 && (
										<span className="num text-xs font-semibold text-white">
											{formatPct(share)}
										</span>
									)}
								</div>
							</TooltipTrigger>
							<TooltipContent side="top">
								<span className="num font-semibold">{format(p.value)}</span>
								<span className="ml-1.5 opacity-75">
									{p.label} · {formatPct(share)}
								</span>
							</TooltipContent>
						</Tooltip>
					);
				})}
			</div>
			<ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
				{visible.map(p => (
					<li key={p.key} className="flex items-center gap-1.5">
						<span
							aria-hidden
							className="size-2.5 rounded-[3px]"
							style={{ background: p.color }}
						/>
						{p.label}
					</li>
				))}
			</ul>
		</div>
	);
}
