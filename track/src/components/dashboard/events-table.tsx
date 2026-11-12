"use client";

import { ChevronRightIcon, InfoIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { loadEventDetail } from "@/app/painel/eventos/actions";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { EventDetail } from "@/lib/dashboard/details";
import type { EventRow } from "@/lib/dashboard/events";
import { formatMoney } from "@/lib/dashboard/format";
import { formatDateTime } from "@/lib/time";
import { JourneyLink } from "./back-button";
import { EventDetailDialog } from "./event-detail-dialog";
import { OriginText } from "./origin-text";
import { DeliveryStatus } from "./status-badge";

export function EventsTable({ rows, timeZone }: { rows: EventRow[]; timeZone: string }) {
	const [open, setOpen] = useState(false);
	const [detail, setDetail] = useState<EventDetail | null>(null);
	const [selected, setSelected] = useState<EventRow | null>(null);
	const [loading, startLoading] = useTransition();

	function show(row: EventRow) {
		setDetail(null);
		setSelected(row);
		setOpen(true);
		startLoading(async () => setDetail(await loadEventDetail(row.id)));
	}

	if (!rows.length)
		return (
			<p className="text-muted-foreground py-10 text-center text-sm">
				Nenhum evento com esses filtros.
			</p>
		);

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
							<th scope="col" className="py-2 pr-3 font-medium">
								Visitante
							</th>
							<th scope="col" className="py-2 pr-3 text-right font-medium">
								Valor
							</th>
							<th scope="col" className="py-2 pr-3 font-medium">
								<Tooltip>
									<TooltipTrigger asChild>
										<span className="inline-flex cursor-help items-center gap-1">
											Origem <InfoIcon className="size-3" />
										</span>
									</TooltipTrigger>
									<TooltipContent className="max-w-64">
										UTM do evento. Sem UTM, o site de onde a pessoa veio na primeira
										visita com origem externa (Google, Instagram...). Sem nenhum dos dois,
										Direto.
									</TooltipContent>
								</Tooltip>
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
								<td className="py-2 pr-3">
									<VisitorLink id={r.trckUserId} />
								</td>
								<td className="num py-2 pr-3 text-right">{value(r)}</td>
								<td className="max-w-56 truncate py-2 pr-3">
									<OriginText origin={r.origin} />
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
					<li key={r.id} className="bg-card/40 rounded-lg border">
						<button
							onClick={() => show(r)}
							className="flex w-full items-start justify-between gap-3 p-3 pb-2 text-left"
						>
							<span className="min-w-0">
								<span className="block font-medium">{r.eventName}</span>
								<span className="num text-muted-foreground block text-xs">
									{formatDateTime(r.createdAt, timeZone)}
								</span>
								<span className="block truncate text-xs">
									<OriginText origin={r.origin} />
								</span>
							</span>
							<span className="flex shrink-0 flex-col items-end gap-1">
								<span className="num text-sm">{value(r)}</span>
								<DeliveryStatus status={r.metaStatus} />
							</span>
						</button>
						<div className="flex items-center gap-1.5 px-3 pb-2 text-xs">
							<span className="text-muted-foreground">Visitante</span>
							<VisitorLink id={r.trckUserId} />
						</div>
					</li>
				))}
			</ul>

			<EventDetailDialog
				open={open}
				onOpenChange={setOpen}
				detail={detail}
				loading={loading}
				timeZone={timeZone}
				origin={selected?.origin}
			/>
		</>
	);
}

/** ID do visitante que abre a jornada dele (sem abrir o detalhe do evento). */
function VisitorLink({ id }: { id: string }) {
	return (
		<JourneyLink
			href={`/painel/visitante/${encodeURIComponent(id)}`}
			title="Ver a jornada deste visitante"
			aria-label={`Ver a jornada do visitante ${id}`}
			onClick={e => e.stopPropagation()}
			className="num text-muted-foreground hover:text-primary inline-flex min-h-9 items-center gap-0.5 text-xs underline-offset-4 hover:underline"
		>
			{id}
			<ChevronRightIcon className="size-3.5 shrink-0" aria-hidden />
		</JourneyLink>
	);
}
