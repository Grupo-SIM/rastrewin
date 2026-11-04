import { ArrowDownRightIcon, ArrowUpRightIcon, InfoIcon, MinusIcon, type LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDelta } from "@/lib/dashboard/format";
import { cn } from "@/lib/utils";

const tones = {
  primary: "bg-primary/12 text-primary ring-primary/25",
  cyan: "bg-cyan/12 text-cyan ring-cyan/25",
  amber: "bg-amber/12 text-amber ring-amber/25",
} as const;

export function KpiCard({
  label,
  value,
  hint,
  info,
  delta,
  icon: Icon,
  tone = "primary",
  className,
}: {
  className?: string;
  label: string;
  value: string;
  hint?: string;
  /** Definição da métrica (ⓘ) */
  info?: string;
  /** Variação vs período anterior; goodWhenUp define a cor */
  delta?: { value: number | null; goodWhenUp?: boolean };
  icon: LucideIcon;
  tone?: keyof typeof tones;
}) {
  const d = delta?.value;
  const good = d === null || d === undefined || d === 0 ? null : (d > 0) === (delta?.goodWhenUp ?? true);
  const DeltaIcon = d === null || d === undefined || d === 0 ? MinusIcon : d > 0 ? ArrowUpRightIcon : ArrowDownRightIcon;

  return (
    <GlassCard size="sm" className={cn("min-w-0 gap-2 px-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 text-[11px] leading-tight font-medium tracking-wide text-muted-foreground uppercase sm:text-xs">
          {label}
          {info && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label={`O que é: ${label}`} className="-m-1 grid size-6 shrink-0 place-items-center rounded-md hover:text-foreground">
                  <InfoIcon className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-64 normal-case tracking-normal">
                {info}
              </TooltipContent>
            </Tooltip>
          )}
        </span>
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-md ring-1", tones[tone])}>
          <Icon className="size-3.5" />
        </span>
      </div>
      {/* Número nunca quebra: valores longos usam fonte menor no celular */}
      <div
        className={cn(
          "num leading-tight font-semibold whitespace-nowrap",
          value.length <= 9 && "text-2xl xl:text-[1.65rem]",
          value.length > 9 && value.length <= 13 && "text-[1.05rem] min-[400px]:text-xl sm:text-2xl xl:text-[1.5rem]",
          value.length > 13 && "text-[0.95rem] min-[400px]:text-lg sm:text-xl xl:text-[1.35rem]",
        )}
      >
        {value}
      </div>
      {delta && (
        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium",
              good === true && "text-[var(--status-good)]",
              good === false && "text-destructive",
              good === null && "text-muted-foreground",
            )}
          >
            <DeltaIcon className="size-3.5" aria-hidden />
            <span className="num">{formatDelta(d ?? null)}</span>
          </span>
          <span className="whitespace-nowrap text-muted-foreground" title="Comparado com o período anterior de mesmo tamanho">vs anterior</span>
        </div>
      )}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </GlassCard>
  );
}
