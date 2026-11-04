"use client";

import { CopyButton } from "@/components/config/copy-button";

/** JSON legível (fonte mono), com rolagem e botão de copiar. Conteúdo entra como TEXTO. */
export function JsonBlock({ value, empty = "Nada registrado." }: { value: unknown; empty?: string }) {
	if (value === null || value === undefined)
		return <p className="text-muted-foreground py-6 text-center text-sm">{empty}</p>;
	const text = JSON.stringify(value, null, 2);
	return (
		<div className="relative">
			<pre className="num bg-muted/40 max-h-[50dvh] overflow-auto rounded-lg border p-3 text-xs leading-relaxed break-all whitespace-pre-wrap">
				{text}
			</pre>
			<CopyButton value={text} label="Copiar" className="bg-card/90 absolute top-2 right-2 h-8" />
		</div>
	);
}
