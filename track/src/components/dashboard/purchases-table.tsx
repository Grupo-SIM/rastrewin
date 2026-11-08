"use client";

import { ChevronRightIcon, LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { loadPurchaseDetail } from "@/app/painel/faturamento/actions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PurchaseDetail } from "@/lib/dashboard/details";
import { formatMoney } from "@/lib/dashboard/format";
import type { PurchaseRow } from "@/lib/dashboard/revenue";
import { formatDateTime } from "@/lib/time";
import { JsonBlock } from "./json-block";
import { DeliveryStatus, PurchaseStatus } from "./status-badge";

const MATCH_LABEL: Record<string, string> = {
	email: "Email",
	phone: "Telefone",
	trck_user_id: "Visitante (src)",
};
const PAYMENT_LABEL: Record<string, string> = { BOLETO: "Boleto", CREDIT_CARD: "Cartão", PIX: "PIX" };

export function PurchasesTable({ rows, timeZone }: { rows: PurchaseRow[]; timeZone: string }) {
	const [open, setOpen] = useState(false);
	const [detail, setDetail] = useState<PurchaseDetail | null>(null);
	const [loading, startLoading] = useTransition();

	function show(row: PurchaseRow) {
		setDetail(null);
		setOpen(true);
		startLoading(async () => setDetail(await loadPurchaseDetail(row.id)));
	}

	if (!rows.length)
		return (
			<p className="text-muted-foreground py-10 text-center text-sm">
				Nenhuma compra com esses filtros.
			</p>
		);
	const origin = (r: PurchaseRow) => [r.utmSource, r.utmCampaign].filter(Boolean).join(" · ") || "—";

	return (
		<>
			<div className="hidden overflow-x-auto md:block">
				<table className="w-full text-sm">
					<thead>
						<tr className="text-muted-foreground border-b text-left text-xs">
							<th scope="col" className="py-2 pr-3 font-medium">
								Data
							</th>
							<th scope="col" className="py-2 pr-3 font-medium">
								Produto / pedido
							</th>
							<th scope="col" className="py-2 pr-3 text-right font-medium">
								Valor
							</th>
							<th scope="col" className="py-2 pr-3 font-medium">
								Status
							</th>
							<th scope="col" className="py-2 pr-3 font-medium">
								Origem
							</th>
							<th scope="col" className="py-2 pr-3 font-medium">
								Ligada por
							</th>
							<th scope="col" className="py-2 pr-3 font-medium">
								Envio
							</th>
							<th scope="col" className="py-2">
								<span className="sr-only">Detalhes</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{rows.map(r => (
							<tr
								key={r.id}
								className="hover:bg-accent/50 cursor-pointer border-b last:border-0"
								onClick={() => show(r)}
							>
								<td className="num text-muted-foreground py-2 pr-3 whitespace-nowrap">
									{formatDateTime(r.date, timeZone)}
								</td>
								<td className="max-w-56 py-2 pr-3">
									<span className="block truncate font-medium">{r.product ?? "—"}</span>
									<span className="num text-muted-foreground block truncate text-xs">
										{r.transactionId}
									</span>
								</td>
								<td className="num py-2 pr-3 text-right whitespace-nowrap">
									{formatMoney(r.value, r.currency)}
								</td>
								<td className="py-2 pr-3">
									<PurchaseStatus status={r.status} />
								</td>
								<td className="text-muted-foreground max-w-48 truncate py-2 pr-3">
									{origin(r)}
								</td>
								<td className="text-muted-foreground py-2 pr-3">
									{r.matchedBy ? (MATCH_LABEL[r.matchedBy] ?? r.matchedBy) : "Não ligada"}
								</td>
								<td className="py-2 pr-3">
									<span className="flex flex-col gap-0.5">
										<span className="flex items-center gap-1.5">
											<span className="text-muted-foreground w-9 text-xs">Meta</span>
											<DeliveryStatus status={r.metaStatus} />
										</span>
										<span className="flex items-center gap-1.5">
											<span className="text-muted-foreground w-9 text-xs">GA4</span>
											<DeliveryStatus status={r.ga4Status} />
										</span>
									</span>
								</td>
								<td className="py-2 text-right">
									<button
										className="text-muted-foreground hover:text-foreground inline-flex h-9 items-center gap-1 rounded-md px-2 text-xs"
										onClick={e => {
											e.stopPropagation();
											show(r);
										}}
									>
										Detalhes <ChevronRightIcon className="size-3.5" />
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<ul className="flex flex-col gap-2 md:hidden">
				{rows.map(r => (
					<li key={r.id}>
						<button
							onClick={() => show(r)}
							className="bg-card/40 flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left"
						>
							<span className="min-w-0">
								<span className="block truncate font-medium">
									{r.product ?? r.transactionId}
								</span>
								<span className="num text-muted-foreground block text-xs">
									{formatDateTime(r.date, timeZone)}
								</span>
								<span className="text-muted-foreground block truncate text-xs">
									{origin(r)}
								</span>
							</span>
							<span className="flex shrink-0 flex-col items-end gap-1">
								<span className="num text-sm font-semibold">
									{formatMoney(r.value, r.currency)}
								</span>
								<PurchaseStatus status={r.status} />
							</span>
						</button>
					</li>
				))}
			</ul>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
					<DialogHeader>
						<DialogTitle>{detail ? (detail.product ?? "Compra") : "Compra"}</DialogTitle>
						<DialogDescription>
							Pedido, ligação com o visitante e o que foi enviado à Meta e ao GA4.
						</DialogDescription>
					</DialogHeader>
					{loading || !detail ? (
						<div className="text-muted-foreground grid place-items-center py-16">
							<LoaderCircleIcon className="size-5 animate-spin" />
						</div>
					) : (
						<Tabs defaultValue="resumo" className="min-w-0 gap-3">
							<TabsList className="h-10 w-max max-w-full overflow-x-auto">
								<TabsTrigger value="resumo">Resumo</TabsTrigger>
								<TabsTrigger value="meta">Meta</TabsTrigger>
								<TabsTrigger value="ga4">GA4</TabsTrigger>
								<TabsTrigger value="webhook">Webhook</TabsTrigger>
							</TabsList>
							<TabsContent value="resumo">
								<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
									<dt className="text-muted-foreground">Pedido</dt>
									<dd className="num break-all">{detail.transactionId}</dd>
									<dt className="text-muted-foreground">Status</dt>
									<dd>
										<PurchaseStatus status={detail.status} />
									</dd>
									<dt className="text-muted-foreground">Valor</dt>
									<dd className="num">
										{formatMoney(detail.value, detail.currency)}
										{detail.netValue !== null && (
											<span className="text-muted-foreground">
												{" "}
												· líquido {formatMoney(detail.netValue, detail.currency)}
											</span>
										)}
									</dd>
									<dt className="text-muted-foreground">Pagamento</dt>
									<dd>
										{detail.paymentMethod
											? (PAYMENT_LABEL[detail.paymentMethod] ?? detail.paymentMethod)
											: "—"}
									</dd>
									<dt className="text-muted-foreground">Data da venda</dt>
									<dd className="num">
										{detail.occurredAt
											? formatDateTime(detail.occurredAt, timeZone)
											: "—"}
									</dd>
									{detail.refundedAt && (
										<>
											<dt className="text-muted-foreground">Reembolso</dt>
											<dd className="num">
												{formatDateTime(detail.refundedAt, timeZone)}
											</dd>
										</>
									)}
									<dt className="text-muted-foreground">Comprador</dt>
									<dd className="break-all">{detail.email ?? "—"}</dd>
									<dt className="text-muted-foreground">Visitante</dt>
									<dd className="break-all">
										{detail.trckUserId ? (
											<>
												<span className="num">{detail.trckUserId}</span>{" "}
												<Link
													href={`/painel/visitante/${encodeURIComponent(detail.trckUserId)}`}
													className="text-primary text-xs whitespace-nowrap underline-offset-4 hover:underline"
												>
													Ver jornada →
												</Link>
											</>
										) : (
											"Não ligada a um visitante"
										)}
									</dd>
									<dt className="text-muted-foreground">Ligada por</dt>
									<dd>
										{(() => {
											const m = detail.match as {
												found?: boolean;
												by?: string;
												reason?: string;
											} | null;
											return m?.found
												? `${MATCH_LABEL[m.by ?? ""] ?? m.by} — ${m.reason}`
												: `Não ligada — ${m?.reason ?? "sem dados"}`;
										})()}
									</dd>
									<dt className="text-muted-foreground">Origem</dt>
									<dd className="break-all">
										{[
											detail.utmSource,
											detail.utmMedium,
											detail.utmCampaign,
											detail.utmTerm,
											detail.utmContent,
										]
											.filter(Boolean)
											.join(" · ") || "—"}
									</dd>
									<dt className="text-muted-foreground">Meta</dt>
									<dd>
										{detail.metaSentAt
											? `Enviado em ${formatDateTime(detail.metaSentAt, timeZone)}`
											: `Não enviado (${detail.metaAttempts} tentativa(s))`}
									</dd>
									<dt className="text-muted-foreground">GA4</dt>
									<dd>
										{detail.ga4SentAt
											? `Enviado em ${formatDateTime(detail.ga4SentAt, timeZone)}`
											: `Não enviado (${detail.ga4Attempts} tentativa(s))`}
										{detail.refundSentAt &&
											` · refund em ${formatDateTime(detail.refundSentAt, timeZone)}`}
									</dd>
									{detail.lastDeliveryError && (
										<>
											<dt className="text-muted-foreground">Último erro</dt>
											<dd className="text-destructive">{detail.lastDeliveryError}</dd>
										</>
									)}
								</dl>
							</TabsContent>
							<TabsContent value="meta" className="flex flex-col gap-2">
								<h3 className="text-muted-foreground text-xs font-medium">
									Enviado (Conversions API)
								</h3>
								<JsonBlock value={detail.payloadMeta} />
								<h3 className="text-muted-foreground text-xs font-medium">
									Resposta de cada pixel
								</h3>
								<JsonBlock value={detail.responseMeta} />
							</TabsContent>
							<TabsContent value="ga4" className="flex flex-col gap-2">
								<h3 className="text-muted-foreground text-xs font-medium">
									Enviado (Measurement Protocol)
								</h3>
								<JsonBlock value={detail.payloadGa4} />
								<h3 className="text-muted-foreground text-xs font-medium">
									Resposta de cada propriedade
								</h3>
								<JsonBlock value={detail.responseGa4} />
								{detail.refundResponseGa4 !== null && (
									<>
										<h3 className="text-muted-foreground text-xs font-medium">
											Reembolso (refund)
										</h3>
										<JsonBlock value={detail.refundResponseGa4} />
									</>
								)}
							</TabsContent>
							<TabsContent value="webhook">
								<JsonBlock value={detail.webhookRaw} />
							</TabsContent>
						</Tabs>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
