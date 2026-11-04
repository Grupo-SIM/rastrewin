"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatInt, formatPct, ratio } from "@/lib/dashboard/format";

/*
 * Funil por PESSOAS (Visitou ⊇ Checkout ⊇ Comprou): barras horizontais com rampa ORDINAL
 * de um tom (validada com --ordinal), % da etapa anterior e % do topo ao lado.
 */
const RAMP = ["var(--viz-fun-1)", "var(--viz-fun-2)", "var(--viz-fun-3)"];

export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
	const top = steps[0]?.value ?? 0;
	return (
		<ol className="flex flex-col gap-3">
			{steps.map((step, i) => {
				const prev = i === 0 ? null : steps[i - 1].value;
				const fromPrev = prev === null ? null : ratio(step.value, prev);
				const fromTop = ratio(step.value, top);
				const width = top ? Math.max(step.value ? 1.5 : 0, (step.value / top) * 100) : 0;
				return (
					<li key={step.label}>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="focus-visible:ring-ring/50 grid grid-cols-[5.5rem_1fr] items-center gap-3 rounded-md outline-none focus-visible:ring-3 sm:grid-cols-[6.5rem_1fr_9rem]">
									<span className="text-muted-foreground text-sm">{step.label}</span>
									<span className="bg-muted/50 relative h-6 overflow-hidden rounded-[4px]">
										<span
											className="absolute inset-y-0 left-0 rounded-[4px]"
											style={{ background: RAMP[i], width: `${width}%` }}
										/>
									</span>
									<span className="col-start-2 flex items-baseline justify-between gap-2 text-sm sm:col-start-3 sm:justify-end">
										<span className="num font-semibold">{formatInt(step.value)}</span>
										{fromPrev !== null && (
											<span className="num text-muted-foreground text-xs">
												{formatPct(fromPrev)} da etapa
											</span>
										)}
									</span>
								</div>
							</TooltipTrigger>
							<TooltipContent side="top">
								<span className="num font-semibold">{formatInt(step.value)}</span>
								<span className="ml-1.5 opacity-75">
									{step.label} · {formatPct(fromTop)} do topo
									{fromPrev !== null ? ` · ${formatPct(fromPrev)} da etapa anterior` : ""}
								</span>
							</TooltipContent>
						</Tooltip>
					</li>
				);
			})}
		</ol>
	);
}
