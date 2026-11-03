"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatPct, formatValue, type ValueKind } from "@/lib/dashboard/format";

/*
 * Barras horizontais ordenadas, UMA cor (comparar magnitude entre categorias sem ordem natural).
 * Barra <= 20px, ponta arredondada 4px, valor na ponta, tooltip por barra (o hit target é a linha toda).
 */
export function RankedBars({
  items,
  color = "var(--viz-1)",
  kind = "int",
  currency = "BRL",
  max: maxItems = 12,
}: {
  items: { label: string; value: number }[];
  color?: string;
  kind?: ValueKind;
  currency?: string;
  max?: number;
}) {
  const format = (n: number) => formatValue(n, kind, currency);
  const shown = items.slice(0, maxItems);
  const top = Math.max(1, ...shown.map((i) => i.value));
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!shown.length) return <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no período</p>;

  return (
    <ul className="flex flex-col gap-1.5" role="list">
      {shown.map((item) => (
        <li key={item.label}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                tabIndex={0}
                className="group grid grid-cols-[minmax(6rem,10rem)_1fr_auto] items-center gap-3 rounded-md px-1 py-1 outline-none hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="truncate text-sm">{item.label}</span>
                <span className="h-4 rounded-r-[4px] bg-muted/50" aria-hidden>
                  <span
                    className="block h-full rounded-r-[4px] transition-[filter] group-hover:brightness-110"
                    style={{ width: `${Math.max(1, (item.value / top) * 100)}%`, background: color }}
                  />
                </span>
                <span className="num min-w-12 text-right text-sm">{format(item.value)}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <span className="num font-semibold">{format(item.value)}</span>
              <span className="ml-1.5 opacity-75">
                {item.label} · {formatPct(total ? item.value / total : null)} do total
              </span>
            </TooltipContent>
          </Tooltip>
        </li>
      ))}
    </ul>
  );
}
