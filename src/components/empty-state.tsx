import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { GlassCard } from "@/components/glass-card";

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <GlassCard className="items-center px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/25">
        <Icon className="size-5" />
      </span>
      <div className="max-w-sm">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </GlassCard>
  );
}
