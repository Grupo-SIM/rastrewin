import { RadarIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
	return (
		<Link
			href="/painel"
			className={cn(
				"focus-visible:ring-ring/50 flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3",
				className,
			)}
		>
			<span className="bg-primary/15 text-primary ring-primary/30 grid size-8 place-items-center rounded-lg ring-1">
				<RadarIcon className="size-4.5" />
			</span>
			<span className="text-[15px] font-bold tracking-tight">
				rastre<span className="text-primary">win</span>
			</span>
		</Link>
	);
}
