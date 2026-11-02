import type { LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
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
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: keyof typeof tones;
}) {
  return (
    <GlassCard size="sm" className="gap-2 px-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] leading-tight font-medium tracking-wide text-muted-foreground uppercase sm:text-xs">
          {label}
        </span>
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-md ring-1", tones[tone])}>
          <Icon className="size-3.5" />
        </span>
      </div>
      <div className="num text-2xl font-semibold sm:text-[1.65rem]">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </GlassCard>
  );
}
