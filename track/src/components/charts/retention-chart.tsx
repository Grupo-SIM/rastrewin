"use client";

import {
	Area,
	AreaChart,
	CartesianGrid,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { formatInt, formatPct } from "@/lib/dashboard/format";
import { formatClock, type RetentionPoint } from "@/lib/dashboard/video-stats";

/*
 * Curva de retenção de UM vídeo (uma série, um eixo): eixo x = ponto do vídeo em %, eixo y = % dos plays
 * que chegaram ali. Linha 2px + área ~10% em var(--viz-1), crosshair + tooltip. Sem legenda (série única:
 * o título do cartão nomeia). Marcação do botão (CTA) em tinta de texto, com rótulo.
 */
export function RetentionChart({
	data,
	durationS,
	ctaS,
	height = 260,
}: {
	data: RetentionPoint[];
	durationS: number;
	ctaS: number | null;
	height?: number;
}) {
	const color = "var(--viz-1)";
	const at = (pct: number) => (durationS > 0 ? ` (${formatClock((pct / 100) * durationS)})` : "");
	const ctaPct = ctaS !== null && durationS > 0 ? Math.min(100, (ctaS / durationS) * 100) : null;
	const empty = data.every(d => d.plays === 0);

	return (
		<div className="relative" style={{ height }} role="img" aria-label="Curva de retenção do vídeo">
			{empty && (
				<p className="text-muted-foreground absolute inset-0 z-10 grid place-items-center text-sm">
					Sem plays no período
				</p>
			)}
			<ResponsiveContainer width="100%" height="100%">
				<AreaChart data={data} margin={{ bottom: 0, left: 0, right: 12, top: 16 }}>
					<CartesianGrid vertical={false} stroke="var(--viz-grid)" strokeWidth={1} />
					<XAxis
						dataKey="pct"
						type="number"
						domain={[0, 100]}
						ticks={[0, 25, 50, 75, 100]}
						tickFormatter={(v: number) => `${v}%`}
						tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
						axisLine={{ stroke: "var(--viz-axis)" }}
						tickLine={false}
					/>
					<YAxis
						domain={[0, 1]}
						ticks={[0, 0.25, 0.5, 0.75, 1]}
						tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
						tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
						axisLine={false}
						tickLine={false}
						width={40}
					/>
					{ctaPct !== null && (
						<ReferenceLine
							x={ctaPct}
							stroke="var(--muted-foreground)"
							strokeDasharray="4 4"
							label={{
								fill: "var(--muted-foreground)",
								fontSize: 11,
								position: "insideTopRight",
								value: `Botão${at(ctaPct)}`,
							}}
						/>
					)}
					<Tooltip
						cursor={{ stroke: "var(--viz-axis)", strokeWidth: 1 }}
						content={({ active, payload }) => {
							if (!active || !payload?.length) return null;
							const p = payload[0].payload as RetentionPoint;
							return (
								<div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 shadow-md">
									<div className="num text-sm font-semibold">
										{formatPct(p.share)} ainda assistindo
									</div>
									<div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
										<span
											aria-hidden
											className="inline-block h-0.5 w-3 rounded"
											style={{ background: color }}
										/>
										aos {p.pct}% do vídeo{at(p.pct)} · {formatInt(p.plays)} play(s)
									</div>
								</div>
							);
						}}
					/>
					<Area
						type="linear"
						dataKey="share"
						stroke={color}
						strokeWidth={2}
						fill={color}
						fillOpacity={0.1}
						activeDot={{ fill: color, r: 4, stroke: "var(--card)", strokeWidth: 2 }}
						isAnimationActive={false}
					/>
				</AreaChart>
			</ResponsiveContainer>
		</div>
	);
}
