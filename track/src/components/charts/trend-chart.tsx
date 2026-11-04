"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompact, formatDayShort, formatInt, formatMoney } from "@/lib/dashboard/format";
import type { DailyPoint } from "@/lib/dashboard/overview";

/*
 * Tendência de UMA série (um eixo só). Linha 2px + área a ~10%, crosshair e tooltip
 * (valor em destaque, data em segundo plano). Cor por papel: var(--viz-N).
 */
export function TrendChart({
	data,
	kind = "int",
	currency = "BRL",
	color = "var(--viz-1)",
	label,
	height = 220,
}: {
	data: DailyPoint[];
	kind?: "int" | "money";
	currency?: string;
	color?: string;
	label: string;
	height?: number;
}) {
	const fmt = (v: number) => (kind === "money" ? formatMoney(v, currency) : formatInt(v));
	const tick = (v: number) => (kind === "money" ? formatMoney(v, currency, true) : formatCompact(v));
	const empty = data.every(d => d.value === 0);

	return (
		<div className="relative" style={{ height }} role="img" aria-label={`${label} por dia`}>
			{empty && (
				<p className="text-muted-foreground absolute inset-0 z-10 grid place-items-center text-sm">
					Sem dados no período
				</p>
			)}
			<ResponsiveContainer width="100%" height="100%">
				<AreaChart data={data} margin={{ bottom: 0, left: 0, right: 8, top: 8 }}>
					<CartesianGrid vertical={false} stroke="var(--viz-grid)" strokeWidth={1} />
					<XAxis
						dataKey="day"
						tickFormatter={formatDayShort}
						tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
						axisLine={{ stroke: "var(--viz-axis)" }}
						tickLine={false}
						minTickGap={28}
						interval="preserveStartEnd"
					/>
					<YAxis
						tickFormatter={tick}
						tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
						axisLine={false}
						tickLine={false}
						width={kind === "money" ? 64 : 40}
						allowDecimals={false}
					/>
					<Tooltip
						cursor={{ stroke: "var(--viz-axis)", strokeWidth: 1 }}
						content={({ active, payload }) => {
							if (!active || !payload?.length) return null;
							const p = payload[0].payload as DailyPoint;
							return (
								<div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 shadow-md">
									<div className="num text-sm font-semibold">{fmt(p.value)}</div>
									<div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
										<span
											aria-hidden
											className="inline-block h-0.5 w-3 rounded"
											style={{ background: color }}
										/>
										{label} · {formatDayShort(p.day)}
									</div>
								</div>
							);
						}}
					/>
					<Area
						type="linear"
						dataKey="value"
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
