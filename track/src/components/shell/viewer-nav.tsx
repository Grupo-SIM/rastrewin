import type { ReactNode } from "react";
import { isAdmin } from "@/lib/dal";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";

/*
 * Menus com os itens do nível de quem está logado. Ficam atrás de <Suspense> no layout
 * (o fallback é o menu sem os itens de administrador), então o shell continua estático.
 */
export async function ViewerSidebar({ footer }: { footer?: ReactNode }) {
	return <Sidebar footer={footer} isAdmin={await isAdmin()} />;
}

export async function ViewerMobileNav({ footer }: { footer?: ReactNode }) {
	return <MobileNav footer={footer} isAdmin={await isAdmin()} />;
}
