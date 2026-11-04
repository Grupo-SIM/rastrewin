"use client";

import { CopyButton } from "@/components/config/copy-button";

/** JSON legível (fonte mono), com rolagem e botão de copiar. Conteúdo entra como TEXTO. */
export function JsonBlock({ value, empty = "Nada registrado." }: { value: unknown; empty?: string }) {
  if (value === null || value === undefined) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  const text = JSON.stringify(value, null, 2);
  return (
    <div className="relative">
      <pre className="num max-h-[50dvh] overflow-auto rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed whitespace-pre-wrap break-all">{text}</pre>
      <CopyButton value={text} label="Copiar" className="absolute top-2 right-2 h-8 bg-card/90" />
    </div>
  );
}
