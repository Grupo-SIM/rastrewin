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
			<span className="bg-primary/10 text-primary ring-primary/25 grid size-12 place-items-center rounded-xl ring-1">
				<Icon className="size-5" />
			</span>
			<div className="max-w-sm">
				<h2 className="text-base font-semibold">{title}</h2>
				<p className="text-muted-foreground mt-1 text-sm">{description}</p>
			</div>
			{children}
		</GlassCard>
	);
}
