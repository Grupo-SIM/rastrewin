import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

export function Field({
	id,
	label,
	hint,
	error,
	children,
}: {
	id: string;
	label: string;
	hint?: ReactNode;
	error?: string;
	children: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-2">
			<Label htmlFor={id}>{label}</Label>
			{children}
			{error ? (
				<p id={`${id}-error`} className="text-destructive text-xs">
					{error}
				</p>
			) : (
				hint && <p className="text-muted-foreground text-xs">{hint}</p>
			)}
		</div>
	);
}
