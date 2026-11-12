import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { ConfigTabs } from "@/components/config/config-tabs";
import { HealthPanel } from "@/components/config/health-panel";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getConfigView } from "@/lib/config/queries";
import { safeErrorMessage } from "@/lib/errors";
import { getHealthView } from "@/lib/health/queries";

export const metadata: Metadata = { title: "Configurações" };

export default function ConfigPage() {
	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Configurações"
				description="Contas GA4, pixels Meta, contas de anúncio, webhook e a saúde do sistema. Os segredos ficam cifrados e aparecem mascarados."
			/>
			<Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
				<ConfigContent />
			</Suspense>
		</div>
	);
}

async function ConfigContent() {
	// getConfigView valida a sessão (readAsUser) e lê com RLS.
	const config = await getConfigView();
	return (
		<ConfigTabs
			config={config}
			health={
				<Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
					<HealthSection timeZone={config.general.timezone} />
				</Suspense>
			}
		/>
	);
}

async function HealthSection({ timeZone }: { timeZone: string }) {
	try {
		return <HealthPanel view={await getHealthView()} timeZone={timeZone} />;
	} catch (err) {
		// Uma falha aqui não pode levar junto o resto das Configurações.
		unstable_rethrow(err);
		console.error("[saúde] aba falhou", safeErrorMessage(err));
		return (
			<p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
				Não foi possível carregar a saúde do sistema agora. Recarregue a página; se continuar, confira
				os logs do app (<code className="text-xs">grep saúde</code>).
			</p>
		);
	}
}
