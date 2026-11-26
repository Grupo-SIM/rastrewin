import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isAdmin } from "@/lib/dal";

/** "Ir para Configurações" nos estados vazios. O Colaborador não acessa Configurações: vê um aviso. */
export async function ConfigButton() {
	if (!(await isAdmin()))
		return <p className="text-muted-foreground text-sm">Peça a um administrador para configurar.</p>;
	return (
		<Button asChild className="h-11">
			<Link href="/painel/config">Ir para Configurações</Link>
		</Button>
	);
}
