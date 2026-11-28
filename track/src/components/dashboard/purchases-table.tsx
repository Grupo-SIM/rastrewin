"use client";

import { ChevronRightIcon, LoaderCircleIcon, RotateCwIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { loadPurchaseDetail } from "@/app/painel/faturamento/actions";
import { resendPurchase } from "@/app/painel/faturamento/admin-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PurchaseDetail } from "@/lib/dashboard/details";
import { formatMoney } from "@/lib/dashboard/format";
import type { PurchaseRow } from "@/lib/dashboard/revenue";
import { isBannerRejected } from "@/lib/sales/consent";
import { type DeliveryState, deliveryText, type Destination } from "@/lib/sales/delivery-state";
import { formatDateTime } from "@/lib/time";
import { JourneyLink } from "./back-button";
import { JsonBlock } from "./json-block";
import { BannerRejectedBadge, DeliveryStatus, PurchaseStatus, TestChip } from "./status-badge";

/** Linha Meta/GA4 do Resumo: data do envio, ou a situação (próxima tentativa, desistiu, LGPD...). */
function deliveryLine(state: DeliveryState, destination: Destination, timeZone: string) {
	return state.kind === "enviado"
		? `Enviado em ${formatDateTime(state.at, timeZone)}`
		: deliveryText(state, destination, new Date(), timeZone);
}

/** "Reenviar agora" (só Administrador): não espera a próxima tentativa automática. */
function ResendBox({ purchaseId, onDone }: { purchaseId: number; onDone: () => void }) {
	const [pending, start] = useTransition();
	return (
		<div className="bg-muted/40 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
			<p className="text-muted-foreground min-w-[14rem] flex-1 text-sm">
				Já corrigiu o problema (ex.: token novo)? Reenvie agora em vez de esperar a próxima tentativa.
			</p>
			<Button
				type="button"
				size="sm"
				className="h-10"
				disabled={pending}
				onClick={() =>
					start(async () => {
						const result = await resendPurchase(purchaseId);
						if (result.ok) toast.success(result.message);
						else toast.error(result.error);
						onDone();
					})
				}
			>
				<RotateCwIcon className={pending ? "animate-spin" : undefined} aria-hidden />
				{pending ? "Reenviando..." : "Reenviar agora"}
			</Button>
		</div>
	);
}

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
								Afiliado
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
									{/* Ao lado do status em tela larga; embaixo dele se faltar espaço (a tabela não estoura). */}
									<span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 2xl:flex-nowrap">
										<PurchaseStatus status={r.status} />
										{r.isTest && <TestChip />}
										{r.bannerRejected && <BannerRejectedBadge />}
									</span>
								</td>
								<td className="text-muted-foreground max-w-48 truncate py-2 pr-3">
									{origin(r)}
								</td>
								<td className="max-w-40 py-2 pr-3">
									{r.affiliateCode ? (
										<span className="block min-w-0" title={r.affiliateCode}>
											<span className="block truncate">
												{r.affiliateName ?? r.affiliateCode}
											</span>
											{r.affiliateName && (
												<span className="text-muted-foreground block truncate font-mono text-xs">
													{r.affiliateCode}
												</span>
											)}
										</span>
									) : (
										<span className="text-muted-foreground">—</span>
									)}
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
								{r.affiliateCode && (
									<span className="text-muted-foreground block truncate text-xs">
										Afiliado · {r.affiliateName ?? r.affiliateCode}
									</span>
								)}
							</span>
							<span className="flex shrink-0 flex-col items-end gap-1">
								<span className="num text-sm font-semibold">
									{formatMoney(r.value, r.currency)}
								</span>
								<PurchaseStatus status={r.status} />
								{r.isTest && <TestChip />}
								{r.bannerRejected && <BannerRejectedBadge />}
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
									<dd className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
										<PurchaseStatus status={detail.status} />
										{isBannerRejected(detail.match) && <BannerRejectedBadge />}
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
												<JourneyLink
													href={`/painel/visitante/${encodeURIComponent(detail.trckUserId)}`}
													className="text-primary text-xs whitespace-nowrap underline-offset-4 hover:underline"
												>
													Ver jornada →
												</JourneyLink>
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
									<dt className="text-muted-foreground">Afiliado</dt>
									<dd className="break-all">
										{detail.affiliateCode ? (
											<>
												<span className="font-medium">
													{detail.affiliateName ?? detail.affiliateCode}
												</span>
												{detail.affiliateName && (
													<span className="text-muted-foreground ml-1.5 font-mono text-xs">
														{detail.affiliateCode}
													</span>
												)}
												{detail.affiliateCommission !== null && (
													<span className="text-muted-foreground">
														{" "}
														· comissão{" "}
														<span className="num">
															{formatMoney(
																detail.affiliateCommission,
																detail.currency,
															)}
														</span>
														{(detail.status === "refunded" ||
															detail.status === "chargeback") &&
															" (revertida: a receita da venda não é reescrita)"}
													</span>
												)}
											</>
										) : (
											"—"
										)}
									</dd>
									<dt className="text-muted-foreground">Meta</dt>
									<dd>{deliveryLine(detail.delivery.meta, "meta", timeZone)}</dd>
									<dt className="text-muted-foreground">GA4</dt>
									<dd>
										{deliveryLine(detail.delivery.ga4, "ga4", timeZone)}
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
								{detail.delivery.canResend && (
									<ResendBox
										purchaseId={detail.id}
										onDone={() =>
											startLoading(async () =>
												setDetail(await loadPurchaseDetail(detail.id)),
											)
										}
									/>
								)}
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
								{detail.webhookHidden ? (
									<p className="text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 text-sm">
										Disponível só para Administrador: o corpo do webhook traz nome, e-mail
										e telefone completos do comprador.
									</p>
								) : (
									<JsonBlock value={detail.webhookRaw} />
								)}
							</TabsContent>
						</Tabs>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
