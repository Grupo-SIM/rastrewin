import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { USERS_DESCRIPTION } from "@/components/users/copy";
import { UsersView } from "@/components/users/users-view";
import { requireAdmin } from "@/lib/dal";
import { listUsers } from "@/lib/users/data";

export const metadata: Metadata = { title: "Usuários" };

export default function UsuariosPage() {
	// O cabeçalho (com "Adicionar usuário") vem junto com a lista, que é dinâmica.
	return (
		<Suspense
			fallback={
				<div className="flex flex-col gap-5">
					<PageHeader title="Usuários" description={USERS_DESCRIPTION} />
					<Skeleton className="h-96 rounded-xl" />
				</div>
			}
		>
			<UsersContent />
		</Suspense>
	);
}

async function UsersContent() {
	// Só Administrador: Colaborador é redirecionado para /painel (listUsers também confere).
	await requireAdmin();
	const view = await listUsers();
	return <UsersView view={view} />;
}
