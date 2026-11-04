"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyButton({
	value,
	label = "Copiar",
	className,
}: {
	value: string;
	label?: string;
	className?: string;
}) {
	const [copied, setCopied] = useState(false);
	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			className={cn("h-9 shrink-0", className)}
			onClick={async () => {
				try {
					await navigator.clipboard.writeText(value);
					setCopied(true);
					setTimeout(() => setCopied(false), 1500);
				} catch {
					toast.error("Não foi possível copiar. Selecione e copie manualmente.");
				}
			}}
		>
			{copied ? <CheckIcon className="text-primary" /> : <CopyIcon />}
			{copied ? "Copiado" : label}
		</Button>
	);
}
