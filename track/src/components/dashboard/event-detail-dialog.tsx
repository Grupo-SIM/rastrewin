"use client";

import { LoaderCircleIcon } from "lucide-react";
import { type ReactNode, useState, useTransition } from "react";
import { loadEventDetail } from "@/app/painel/eventos/actions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EventDetail } from "@/lib/dashboard/details";
import { formatDateTime } from "@/lib/time";
import type { Origin } from "@/lib/tracking/referrer";
import { JourneyLink } from "./back-button";
import { JsonBlock } from "./json-block";
import { OriginText } from "./origin-text";

/** Janela de detalhe de um evento (o que foi enviado e o que cada destino respondeu). Usada em Eventos e na Jornada. */
export function EventDetailDialog({
	open,
	onOpenChange,
	detail,
	loading,
	timeZone,
	origin,
	showJourneyLink = true,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	detail: EventDetail | null;
	loading: boolean;
	timeZone: string;
	/** Origem já calculada na lista de Eventos (UTM, site de onde veio ou Direto). */
	origin?: Origin;
	/** Na própria jornada o link "Ver jornada" não faz sentido. */
	showJourneyLink?: boolean;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>{detail?.eventName ?? "Evento"}</DialogTitle>
					<DialogDescription>O que foi enviado e o que cada destino respondeu.</DialogDescription>
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
								{showJourneyLink && (
									<JourneyLink
										href={`/painel/visitante/${encodeURIComponent(detail.trckUserId)}`}
										className="text-primary text-xs whitespace-nowrap underline-offset-4 hover:underline"
									>
										Ver jornada →
									</JourneyLink>
								)}
							</dd>
							{origin && (
								<>
									<dt className="text-muted-foreground">Origem</dt>
									<dd className="break-all">
										<OriginText origin={origin} withHost />
									</dd>
								</>
							)}
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
									Eventos do site vão ao GA4 pela gtag no navegador; o servidor só envia a
									compra (Measurement Protocol).
								</p>
								<JsonBlock value={detail.payloadGa4} />
								{detail.responseGa4 !== null && <JsonBlock value={detail.responseGa4} />}
							</TabsContent>
						</Tabs>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}

/** Botão que abre o detalhe de um evento pelo id da linha (carrega sob demanda). */
export function EventDetailButton({
	eventRowId,
	timeZone,
	children,
	className,
}: {
	eventRowId: number;
	timeZone: string;
	children: ReactNode;
	className?: string;
}) {
	const [open, setOpen] = useState(false);
	const [detail, setDetail] = useState<EventDetail | null>(null);
	const [loading, start] = useTransition();
	return (
		<>
			<button
				type="button"
				className={className}
				onClick={() => {
					setDetail(null);
					setOpen(true);
					start(async () => setDetail(await loadEventDetail(eventRowId)));
				}}
			>
				{children}
			</button>
			<EventDetailDialog
				open={open}
				onOpenChange={setOpen}
				detail={detail}
				loading={loading}
				timeZone={timeZone}
				showJourneyLink={false}
			/>
		</>
	);
}
