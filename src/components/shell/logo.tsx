import { RadarIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/painel"
      className={cn("flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50", className)}
    >
      <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
        <RadarIcon className="size-4.5" />
      </span>
      <span className="text-[15px] font-bold tracking-tight">
        rastre<span className="text-primary">win</span>
      </span>
    </Link>
  );
}
