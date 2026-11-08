"use client";

import { ChevronRightIcon, LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { loadEventDetail } from "@/app/painel/eventos/actions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EventDetail } from "@/lib/dashboard/details";
import type { EventRow } from "@/lib/dashboard/events";
import { formatMoney } from "@/lib/dashboard/format";
import { formatDateTime } from "@/lib/time";
import { JsonBlock } from "./json-block";
import { DeliveryStatus } from "./status-badge";

export function EventsTable({ rows, timeZone }: { rows: EventRow[]; timeZone: string }) {
	const [open, setOpen] = useState(false);
	const [detail, setDetail] = useState<EventDetail | null>(null);
	const [loading, startLoading] = useTransition();

	function show(row: EventRow) {
		setDetail(null);
		setOpen(true);
		startLoading(async () => setDetail(await loadEventDetail(row.id)));
	}

	if (!rows.length)
		return (
			<p className="text-muted-foreground py-10 text-center text-sm">
				Nenhum evento com esses filtros.
			</p>
		);

	const origin = (r: EventRow) => [r.utmSource, r.utmCampaign].filter(Boolean).join(" · ") || "—";
	const value = (r: EventRow) => (r.value === null ? "—" : formatMoney(r.value, r.currency ?? "BRL"));

	return (
		<>
			{/* Desktop */}
			<div className="hidden overflow-x-auto md:block">
				<table className="w-full text-sm">
					<thead>
						<tr className="text-muted-foreground border-b text-left text-xs">
							<th scope="col" className="py-2 pr-3 font-medium">
								Data
							</th>
							<th scope="col" className="py-2 pr-3 font-medium">
								Evento
							</th>
							<th scope="col" className="py-2 pr-3 text-right font-medium">
								Valor
							</th>
							<th scope="col" className="py-2 pr-3 font-medium">
								Origem
							</th>
							<th scope="col" className="py-2 pr-3 font-medium">
								Local
							</th>
							<th scope="col" className="py-2 pr-3 font-medium">
								Meta
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
									{formatDateTime(r.createdAt, timeZone)}
								</td>
								<td className="py-2 pr-3 font-medium">{r.eventName}</td>
								<td className="num py-2 pr-3 text-right">{value(r)}</td>
								<td className="text-muted-foreground max-w-56 truncate py-2 pr-3">
									{origin(r)}
								</td>
								<td className="text-muted-foreground max-w-40 truncate py-2 pr-3">
									{r.place ?? "—"}
								</td>
								<td className="py-2 pr-3">
									<DeliveryStatus status={r.metaStatus} />
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

			{/* Celular */}
			<ul className="flex flex-col gap-2 md:hidden">
				{rows.map(r => (
					<li key={r.id}>
						<button
							onClick={() => show(r)}
							className="bg-card/40 flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left"
						>
							<span className="min-w-0">
								<span className="block font-medium">{r.eventName}</span>
								<span className="num text-muted-foreground block text-xs">
									{formatDateTime(r.createdAt, timeZone)}
								</span>
								<span className="text-muted-foreground block truncate text-xs">
									{origin(r)}
								</span>
							</span>
							<span className="flex shrink-0 flex-col items-end gap-1">
								<span className="num text-sm">{value(r)}</span>
								<DeliveryStatus status={r.metaStatus} />
							</span>
						</button>
					</li>
				))}
			</ul>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
					<DialogHeader>
						<DialogTitle>{detail?.eventName ?? "Evento"}</DialogTitle>
						<DialogDescription>
							O que foi enviado e o que cada destino respondeu.
						</DialogDescription>
					</DialogHeader>
					{loading || !detail ? (
						<div className="text-muted-foreground grid place-items-center py-16">
							<LoaderCircleIcon className="size-5 animate-spin" />
						</div>
					) : (
						<div className="flex min-w-0 flex-col gap-4">
							<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
								<dt className="text-muted-foreground">Quando</dt>
								<dd className="num">{formatDateTime(detail.createdAt, timeZone)}</dd>
								<dt className="text-muted-foreground">event_id</dt>
								<dd className="num break-all">{detail.eventId}</dd>
								<dt className="text-muted-foreground">Visitante</dt>
								<dd className="break-all">
									<span className="num">{detail.trckUserId}</span>{" "}
									<Link
										href={`/painel/visitante/${encodeURIComponent(detail.trckUserId)}`}
										className="text-primary text-xs whitespace-nowrap underline-offset-4 hover:underline"
									>
										Ver jornada →
									</Link>
								</dd>
								<dt className="text-muted-foreground">Página</dt>
								<dd className="break-all">{detail.eventSourceUrl ?? "—"}</dd>
								<dt className="text-muted-foreground">IP</dt>
								<dd className="num">{detail.ip ?? "—"}</dd>
								<dt className="text-muted-foreground">Navegador</dt>
								<dd className="text-xs break-all">{detail.userAgent ?? "—"}</dd>
							</dl>
							<Tabs defaultValue="meta-payload" className="min-w-0 gap-3">
								<TabsList className="h-10 w-max max-w-full overflow-x-auto">
									<TabsTrigger value="meta-payload">Meta · enviado</TabsTrigger>
									<TabsTrigger value="meta-response">Meta · resposta</TabsTrigger>
									<TabsTrigger value="ga4">GA4</TabsTrigger>
								</TabsList>
								<TabsContent value="meta-payload">
									<JsonBlock
										value={detail.payloadMeta}
										empty="Payload não registrado (sem pixel ativo ou expirado após 14 dias)."
									/>
								</TabsContent>
								<TabsContent value="meta-response">
									<JsonBlock value={detail.responseMeta} />
								</TabsContent>
								<TabsContent value="ga4" className="flex flex-col gap-2">
									<p className="text-muted-foreground text-xs">
										Eventos do site vão ao GA4 pela gtag no navegador; o servidor só envia
										a compra (Measurement Protocol).
									</p>
									<JsonBlock value={detail.payloadGa4} />
									{detail.responseGa4 !== null && <JsonBlock value={detail.responseGa4} />}
								</TabsContent>
							</Tabs>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
