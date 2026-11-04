import type { ComponentProps } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Card padrão do painel: fundo translúcido + blur leve. */
export function GlassCard({ className, ...props }: ComponentProps<typeof Card>) {
	return (
		<Card
			className={cn(
				"bg-card/80 ring-border/80 dark:bg-card/60 backdrop-blur-md backdrop-saturate-150",
				className,
			)}
			{...props}
		/>
	);
}
