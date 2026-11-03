"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDayShort, formatMoney } from "@/lib/dashboard/format";

/*
 * Duas séries na MESMA unidade (R$) e num ÚNICO eixo — nunca eixo duplo.
 * Legenda sempre visível; tooltip lista todas as séries do dia (valor em destaque).
 */
export type Series = { key: string; label: string; color: string };

export function MultiTrendChart({
  data,
  series,
  currency = "BRL",
  height = 240,
}: {
  data: Record<string, number | string>[];
  series: Series[];
  currency?: string;
  height?: number;
}) {
  const empty = data.every((d) => series.every((s) => Number(d[s.key] ?? 0) === 0));
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-4 text-sm" aria-label="Legenda">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-4 rounded" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="relative" style={{ height }} role="img" aria-label={series.map((s) => s.label).join(" e ") + " por dia"}>
        {empty && <p className="absolute inset-0 z-10 grid place-items-center text-sm text-muted-foreground">Sem dados no período</p>}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
              tickFormatter={(v: number) => formatMoney(v, currency, true)}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <Tooltip
              cursor={{ stroke: "var(--viz-axis)", strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as Record<string, number | string>;
                return (
                  <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
                    <div className="mb-1 text-xs text-muted-foreground">{formatDayShort(String(row.day))}</div>
                    {series.map((s) => (
                      <div key={s.key} className="flex items-center justify-between gap-4 text-sm">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span aria-hidden className="h-0.5 w-3 rounded" style={{ background: s.color }} />
                          {s.label}
                        </span>
                        <span className="num font-semibold">{formatMoney(Number(row[s.key] ?? 0), currency)}</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            {series.map((s) => (
              <Line
                key={s.key}
                type="linear"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2, fill: s.color }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
