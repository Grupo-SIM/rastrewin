import type { Metadata } from "next";
import { Suspense } from "react";
import { EventsTable } from "@/components/dashboard/events-table";
import {
	EventTypesFilter,
	FiltersBar,
	FiltersProvider,
	Pagination,
	PendingArea,
	SearchFilter,
	SelectFilter,
} from "@/components/dashboard/filters";
import { GlassCard } from "@/components/glass-card";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SearchParams } from "@/lib/dashboard/context";
import { DELIVERY_FILTERS, getEvents } from "@/lib/dashboard/events";
import { formatInt } from "@/lib/dashboard/format";

export const metadata: Metadata = { title: "Eventos" };

export default function EventosPage({ searchParams }: PageProps<"/painel/eventos">) {
	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Eventos"
				description="Tudo o que foi capturado, com o que foi enviado e o que a Meta e o GA4 responderam."
			/>
			<Suspense fallback={<PageSkeleton />}>
				<EventsContent searchParams={searchParams} />
			</Suspense>
		</div>
	);
}

async function EventsContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
	const d = await getEvents(await searchParams);
	return (
		<FiltersProvider>
			<div className="flex flex-col gap-4">
				<FiltersBar>
					<EventTypesFilter options={d.eventNames} />
					<SelectFilter
						name="envio"
						label="Envio à Meta"
						allLabel="Todos os envios"
						options={DELIVERY_FILTERS.filter(f => f.key !== "todos").map(f => ({
							label: f.label,
							value: f.key,
						}))}
					/>
					<SearchFilter placeholder="Visitante, event_id ou campanha" />
				</FiltersBar>
				<PendingArea>
					<GlassCard>
						<CardHeader>
							<CardTitle className="font-semibold">
								<span className="num">{formatInt(d.total)}</span> evento(s) · {d.period.label}
							</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-2">
							<EventsTable rows={d.rows} timeZone={d.timeZone} />
							<Pagination page={d.page} total={d.total} pageSize={d.pageSize} />
						</CardContent>
					</GlassCard>
				</PendingArea>
			</div>
		</FiltersProvider>
	);
}
