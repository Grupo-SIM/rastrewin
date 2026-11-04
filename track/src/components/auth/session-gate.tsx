import type { ReactNode } from "react";
import { requireSession } from "@/lib/dal";

/** Renderiza o conteúdo do painel só com sessão válida (validada no servidor). */
export async function SessionGate({ children }: { children: ReactNode }) {
	await requireSession();
	return children;
}
