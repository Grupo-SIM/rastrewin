"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ComponentProps, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/*
 * "Voltar" da Jornada do visitante. Os links que abrem a jornada guardam de onde se veio
 * (endereço com filtros) na sessão do navegador; o botão volta exatamente para lá.
 * Aberta direto pelo endereço (sem origem guardada), vai para `fallback`.
 */
const KEY = "trck:jornada-voltar";

/** Guarda a tela atual como destino do "Voltar" da jornada. */
export function rememberReturn() {
	try {
		sessionStorage.setItem(KEY, location.pathname + location.search);
	} catch {
		// sem sessionStorage (modo privado restrito): o Voltar usa o destino padrão
	}
}

/** Link para uma jornada que guarda a tela atual para o "Voltar". */
export function JourneyLink({ onClick, ...props }: ComponentProps<typeof Link>) {
	return (
		<Link
			{...props}
			onClick={e => {
				rememberReturn();
				onClick?.(e);
			}}
		/>
	);
}

function labelFor(path: string): string {
	if (path.startsWith("/painel/eventos")) return "Voltar para Eventos";
	if (path.startsWith("/painel/faturamento")) return "Voltar para Faturamento";
	if (path.startsWith("/painel/visitante/")) return "Voltar ao visitante anterior";
	return "Voltar";
}

export function BackButton({ fallback }: { fallback: string }) {
	const router = useRouter();
	const [target, setTarget] = useState<string | null>(null);
	// Lido depois de montar (sessionStorage não existe no servidor).
	useEffect(() => {
		try {
			const saved = sessionStorage.getItem(KEY);
			if (saved?.startsWith("/painel") && saved !== location.pathname + location.search)
				setTarget(saved);
		} catch {
			// idem
		}
	}, []);
	return (
		<Button
			type="button"
			variant="ghost"
			className="text-muted-foreground hover:text-foreground -ml-3 h-10 self-start"
			onClick={() => router.push(target ?? fallback)}
		>
			<ArrowLeftIcon /> {target ? labelFor(target) : "Voltar para Eventos"}
		</Button>
	);
}
