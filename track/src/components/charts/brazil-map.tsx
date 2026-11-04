"use client";

import { type MouseEvent, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { formatInt, formatMoney } from "@/lib/dashboard/format";
import type { UfStat } from "@/lib/dashboard/geo";
import { IBGE_UF, UF_NAME } from "@/lib/geo/br-states";
import { cn } from "@/lib/utils";
import brUfTopo from "./geo/br-uf.topo.json";

// A v5 lê TopoJSON em tempo de execução (detecta type "Topology"); a tipagem só aceita GeoJSON.
const brUf = brUfTopo as unknown as Parameters<typeof Geographies>[0]["geography"];

/*
 * Coropleta do Brasil por UF (malha oficial do IBGE). Escala SEQUENCIAL de um tom (6 degraus);
 * estado sem dados fica neutro. Tooltip por estado (mouse e teclado), legenda da escala.
 */
const STEPS = [
	"var(--viz-seq-1)",
	"var(--viz-seq-2)",
	"var(--viz-seq-3)",
	"var(--viz-seq-4)",
	"var(--viz-seq-5)",
	"var(--viz-seq-6)",
];
type Metric = "visitors" | "purchases" | "revenue";

export function BrazilMap({ data, currency = "BRL" }: { data: UfStat[]; currency?: string }) {
	const metrics: { key: Metric; label: string; format: (n: number) => string }[] = [
		{ format: formatInt, key: "visitors", label: "Visitantes" },
		{ format: formatInt, key: "purchases", label: "Compras" },
		{ format: n => formatMoney(n, currency), key: "revenue", label: "Receita" },
	];
	const [metric, setMetric] = useState<Metric>(metrics[0].key);
	const [hover, setHover] = useState<{ uf: string; x: number; y: number } | null>(null);
	const current = metrics.find(m => m.key === metric)!;
	const byUf = new Map(data.map(d => [d.uf, d]));
	const max = Math.max(0, ...data.map(d => d[metric]));
	const stepOf = (v: number) =>
		v <= 0 || max <= 0 ? -1 : Math.min(STEPS.length - 1, Math.floor((v / max) * STEPS.length - 1e-9));

	const place = (e: MouseEvent<SVGPathElement>, uf: string) => {
		const box = (e.currentTarget.ownerSVGElement?.parentElement as HTMLElement).getBoundingClientRect();
		setHover({ uf, x: e.clientX - box.left, y: e.clientY - box.top });
	};
	const hovered = hover ? byUf.get(hover.uf) : null;

	return (
		<div className="flex flex-col gap-3">
			<div
				role="radiogroup"
				aria-label="Métrica do mapa"
				className="bg-muted/60 inline-flex w-fit gap-1 rounded-lg p-1"
			>
				{metrics.map(m => (
					<button
						key={m.key}
						role="radio"
						aria-checked={metric === m.key}
						onClick={() => setMetric(m.key)}
						className={cn(
							"text-muted-foreground h-9 rounded-md px-3 text-sm font-medium transition-colors",
							metric === m.key && "bg-background text-foreground shadow-sm",
						)}
					>
						{m.label}
					</button>
				))}
			</div>

			<div className="relative mx-auto w-full max-w-xl">
				<ComposableMap
					projection="geoMercator"
					projectionConfig={{ center: [-54, -15], scale: 680 }}
					width={600}
					height={560}
					className="h-auto w-full"
				>
					<Geographies geography={brUf}>
						{({ geographies }) =>
							geographies.map(geo => {
								const uf = IBGE_UF[String(geo.properties?.codarea)] ?? "";
								const value = byUf.get(uf)?.[metric] ?? 0;
								const step = stepOf(value);
								const label = `${UF_NAME[uf] ?? uf}: ${current.format(value)}`;
								return (
									<Geography
										key={geo.rsmKey}
										geography={geo}
										tabIndex={0}
										aria-label={label}
										onMouseMove={e => place(e, uf)}
										onMouseLeave={() => setHover(null)}
										onFocus={e => {
											const r = (e.currentTarget as SVGPathElement).getBBox();
											setHover({ uf, x: (r.x + r.width / 2) * 0.6, y: r.y * 0.6 });
										}}
										onBlur={() => setHover(null)}
										fill={step < 0 ? "var(--muted)" : STEPS[step]}
										stroke="var(--card)"
										strokeWidth={0.8}
										className="cursor-default transition-[stroke,stroke-width] outline-none hover:stroke-[var(--foreground)] hover:[stroke-width:1.4] focus-visible:stroke-[var(--foreground)] focus-visible:[stroke-width:1.6]"
									/>
								);
							})
						}
					</Geographies>
				</ComposableMap>
				{hover && (
					<div
						className="bg-popover text-popover-foreground pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg border px-3 py-2 shadow-md"
						style={{ left: hover.x, top: hover.y }}
					>
						<div className="num text-sm font-semibold">
							{current.format(hovered?.[metric] ?? 0)}
						</div>
						<div className="text-muted-foreground text-xs">
							{UF_NAME[hover.uf] ?? hover.uf} · {current.label}
						</div>
					</div>
				)}
			</div>

			<div
				className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs"
				aria-label="Escala"
			>
				<span className="flex items-center gap-1">
					<span className="bg-muted size-3 rounded-[3px]" /> sem dados
				</span>
				<span className="ml-2">0</span>
				<span className="flex gap-[2px]">
					{STEPS.map(c => (
						<span key={c} className="h-3 w-6 rounded-[3px]" style={{ background: c }} />
					))}
				</span>
				<span className="num">{current.format(max)}</span>
			</div>
		</div>
	);
}
