"use client";

import { CircleAlertIcon, LoaderCircleIcon, RefreshCwIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { refreshCampaigns } from "@/app/painel/campanhas/actions";
import { Button } from "@/components/ui/button";
import type { CampaignsView } from "@/lib/campaigns/query";
import { formatDateTime } from "@/lib/time";

/** Quando os dados foram buscados, uso da API e o botão "Atualizar agora" (cooldown de 15 min). */
export function StatusStrip({
	results,
	detail,
	structure,
	timeZone,
}: {
	results: CampaignsView["results"];
	detail: CampaignsView["detail"];
	structure: CampaignsView["structure"];
	timeZone: string;
}) {
	const params = useSearchParams();
	const [pending, start] = useTransition();
	const fetched = results.map(r => r.fetchedAt).filter(Boolean) as string[];
	const oldest = fetched.sort()[0];
	const usage = Math.max(0, ...results.map(r => r.usagePct ?? 0));
	const notices = results.filter(r => r.notice);

	return (
		<div className="bg-card/50 flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
			<div className="flex flex-col gap-1">
				<span>
					{oldest ? (
						<>
							Dados da Meta de <span className="num">{formatDateTime(oldest, timeZone)}</span>
							{results.some(r => r.stale) && (
								<span className="text-muted-foreground"> · atualizando em segundo plano</span>
							)}
						</>
					) : (
						"Ainda sem dados da Meta para este período."
					)}
				</span>
				<span className="text-muted-foreground text-xs">
					Cache de 1 h (12 h para períodos passados) · uso da API da Meta:{" "}
					<span className="num">{usage.toFixed(0)}%</span> · máx. 20 consultas/h por conta
				</span>
				{detail.truncated && (
					<span className="text-amber flex items-start gap-1.5 text-xs">
						<CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
						{detail.incomplete
							? "A Meta devolveu mais de 5.000 linhas (anúncio × dia) e os totais da conta não vieram: o gasto mostrado está abaixo do real. Tente “Atualizar agora” ou use um período menor."
							: "A Meta devolveu mais de 5.000 linhas (anúncio × dia). Os totais estão corretos; o detalhe por anúncio está incompleto. Use um período menor para ver tudo."}
					</span>
				)}
				{structure.notices.map(n => (
					<span
						key={`estrutura-${n.adAccountId}`}
						className="text-amber flex items-start gap-1.5 text-xs"
					>
						<CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
						{results.length > 1 ? `${n.label}: ` : ""}Situação das campanhas indisponível agora.{" "}
						{n.notice}
					</span>
				))}
				{structure.truncated && (
					<span className="text-amber flex items-start gap-1.5 text-xs">
						<CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" />A conta tem mais itens do que
						o painel lê de uma vez: alguns aparecem sem a situação.
					</span>
				)}
				{notices.map(r => (
					<span key={r.adAccountId} className="text-amber flex items-start gap-1.5 text-xs">
						<CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" /> {r.label}: {r.notice}
					</span>
				))}
			</div>
			<Button
				variant="outline"
				className="h-10 shrink-0"
				disabled={pending}
				onClick={() =>
					start(async () => {
						const res = await refreshCampaigns({
							ate: params.get("ate"),
							conta: params.get("conta"),
							de: params.get("de"),
							periodo: params.get("periodo"),
						});
						if (res.ok) toast.success(res.message);
						else toast.warning(res.message);
					})
				}
			>
				{pending ? <LoaderCircleIcon className="animate-spin" /> : <RefreshCwIcon />}
				Atualizar agora
			</Button>
		</div>
	);
}
