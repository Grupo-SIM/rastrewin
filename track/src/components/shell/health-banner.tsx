import { ChevronRightIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { safeErrorMessage } from "@/lib/errors";
import { getHealthIssues } from "@/lib/health/queries";

/**
 * Faixa no topo do painel quando algo dos bastidores precisa de atenção (repasses do backend,
 * envios à Meta/GA4, limpeza diária, tamanho do banco). Leva à aba Configurações › Saúde.
 */
export async function HealthBanner() {
	let issues: Awaited<ReturnType<typeof getHealthIssues>>;
	try {
		issues = await getHealthIssues();
	} catch (err) {
		// O aviso nunca pode derrubar a tela: sem ele, a página segue normal.
		unstable_rethrow(err);
		console.error("[saúde] faixa de aviso falhou", safeErrorMessage(err));
		return null;
	}
	if (!issues?.length) return null;
	const [first, ...rest] = issues;
	return (
		<Link
			href="/painel/config?aba=saude"
			className="bg-amber/10 border-amber/30 hover:bg-amber/15 mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors"
		>
			<TriangleAlertIcon className="text-amber mt-0.5 size-4 shrink-0" aria-hidden />
			<span className="min-w-0 flex-1">
				<span className="font-medium">{first.title}</span>
				{rest.length > 0 && (
					<span className="text-muted-foreground">
						{" "}
						· e mais {rest.length === 1 ? "1 ponto" : `${rest.length} pontos`}
					</span>
				)}
			</span>
			<span className="text-muted-foreground hidden shrink-0 items-center gap-0.5 text-xs sm:inline-flex">
				Ver detalhes <ChevronRightIcon className="size-3.5" aria-hidden />
			</span>
			<ChevronRightIcon
				className="text-muted-foreground mt-0.5 size-4 shrink-0 sm:hidden"
				aria-hidden
			/>
		</Link>
	);
}
