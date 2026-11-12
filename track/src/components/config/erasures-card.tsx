"use client";

import { CircleCheckIcon, LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { markErasureGaDone } from "@/app/painel/config/actions";
import { GlassCard } from "@/components/glass-card";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ErasureView } from "@/lib/config/types";
import { formatDateTime } from "@/lib/time";
import { CopyButton } from "./copy-button";

const COUNT_LABELS: [string, string][] = [
	["visitors", "visitante(s)"],
	["events", "evento(s)"],
	["videos", "play(s) de vídeo"],
	["purchases", "compra(s) anonimizada(s)"],
];

function GaDoneButton({ id }: { id: number }) {
	const [pending, start] = useTransition();
	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			className="h-9 self-start"
			disabled={pending}
			onClick={() =>
				start(async () => {
					const r = await markErasureGaDone(id);
					if (r.ok) toast.success(r.message);
					else toast.error(r.error);
				})
			}
		>
			{pending && <LoaderCircleIcon className="animate-spin" />}
			Concluído no GA4
		</Button>
	);
}

/** Exclusões pedidas pelos titulares (formulário do site → backend → track). */
export function ErasuresCard({ erasures, timeZone }: { erasures: ErasureView[]; timeZone: string }) {
	return (
		<GlassCard>
			<CardHeader>
				<CardTitle className="font-semibold">Exclusões de dados (titulares)</CardTitle>
				<CardDescription>
					Pedidos feitos no formulário de privacidade do site, confirmados pelo email da pessoa. O
					track apaga visitante, eventos e plays e anonimiza as compras na hora. Falta só o GA4: ele
					não tem como apagar por aqui.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				{erasures.length === 0 ? (
					<p className="text-muted-foreground text-sm">Nenhum pedido de exclusão até agora.</p>
				) : (
					<ul className="flex flex-col gap-3">
						{erasures.map(e => {
							const counts = COUNT_LABELS.map(
								([k, label]) => `${e.counts[k] ?? 0} ${label}`,
							).join(" · ");
							return (
								<li key={e.id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
									<div className="flex flex-wrap items-baseline justify-between gap-2">
										<span className="num font-medium">
											{formatDateTime(e.createdAt, timeZone)}
										</span>
										<span className="text-muted-foreground text-xs">{counts}</span>
									</div>
									{e.gaClientIds.length > 0 ? (
										<div className="flex flex-col gap-2">
											<p className="text-amber flex items-start gap-2 text-xs">
												<TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
												Apague no GA4: Explorar › Explorador de usuários, procure cada
												client_id abaixo e use “Excluir usuário”. Depois marque como
												concluído (a lista é apagada daqui).
											</p>
											<pre className="bg-muted/50 overflow-x-auto rounded-md border p-2 font-mono text-xs">
												{e.gaClientIds.join("\n")}
											</pre>
											<div className="flex flex-wrap gap-2">
												<CopyButton
													value={e.gaClientIds.join("\n")}
													label="Copiar client_ids"
												/>
												<GaDoneButton id={e.id} />
											</div>
										</div>
									) : (
										<p className="text-muted-foreground flex items-center gap-2 text-xs">
											<CircleCheckIcon
												className="size-3.5 shrink-0"
												style={{ color: "var(--status-good)" }}
											/>
											{e.gaDoneAt
												? `GA4 concluído em ${formatDateTime(e.gaDoneAt, timeZone)}.`
												: "Nada a apagar no GA4."}
										</p>
									)}
								</li>
							);
						})}
					</ul>
				)}
				<p className="text-muted-foreground text-xs">
					A Meta não oferece como apagar eventos já recebidos pela Conversions API; a política de
					privacidade avisa isso. O que o track guarda para honrar a exclusão é só o hash do
					email/telefone, por 30 dias (vendas que ainda estavam a caminho chegam anonimizadas).
				</p>
			</CardContent>
		</GlassCard>
	);
}
