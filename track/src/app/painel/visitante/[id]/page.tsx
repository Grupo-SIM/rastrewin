import {
	ActivityIcon,
	ArrowRightIcon,
	BanknoteIcon,
	CircleUserRoundIcon,
	MapPinIcon,
	PlayIcon,
	ShoppingBagIcon,
	SmartphoneIcon,
	UserSearchIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { BackButton, JourneyLink } from "@/components/dashboard/back-button";
import { EventDetailButton } from "@/components/dashboard/event-detail-dialog";
import { DeliveryStatus, PurchaseStatus } from "@/components/dashboard/status-badge";
import { EmptyState } from "@/components/empty-state";
import { GlassCard } from "@/components/glass-card";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInt, formatMoney } from "@/lib/dashboard/format";
import { getJourney, type Journey, JOURNEY_STEP, type JourneyItem } from "@/lib/dashboard/journey";
import {
	deviceSummary,
	fbcInfo,
	formatDayLong,
	formatTimeSec,
	hasUtm,
	saleEventLabel,
	sameUtm,
	splitUtm,
	type Utm,
	utmSummary,
} from "@/lib/dashboard/journey-format";
import { pageKey } from "@/lib/dashboard/page-url";
import { formatClock } from "@/lib/dashboard/video-stats";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Jornada do visitante" };

/*
 * Rota dinâmica ([id]): o shell do painel (navegação com usePathname) não pode ser pré-renderizado
 * sem o id. Página de detalhe, aberta por link: pode esperar o servidor ao navegar (sem "instant").
 */
export const instant = false;

const MATCH_LABEL: Record<string, string> = {
	email: "E-mail",
	phone: "Telefone",
	trck_user_id: "Visitante (src)",
};

export default function VisitantePage({ params, searchParams }: PageProps<"/painel/visitante/[id]">) {
	return (
		<div className="flex flex-col gap-6">
			<div className="-mb-3">
				<BackButton fallback="/painel/eventos" />
			</div>
			<PageHeader
				title="Jornada do visitante"
				description="Tudo o que esta pessoa fez, do primeiro acesso à compra. Todo o histórico, sem filtro de período."
			/>
			<Suspense fallback={<PageSkeleton />}>
				<JourneyContent params={params} searchParams={searchParams} />
			</Suspense>
		</div>
	);
}

async function JourneyContent({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const { id } = await params;
	const sp = await searchParams;
	const ver = typeof sp.ver === "string" ? sp.ver : null;
	const j = await getJourney(decodeURIComponent(id), ver);

	if (!j)
		return (
			<EmptyState
				icon={UserSearchIcon}
				title="Endereço inválido"
				description="O identificador do visitante não está no formato certo. Abra a jornada pelos links das abas Eventos ou Faturamento."
			/>
		);
	if (!j.visitor && j.counts.total === 0)
		return (
			<EmptyState
				icon={UserSearchIcon}
				title="Visitante não encontrado"
				description="Não há nenhum registro com esse identificador."
			/>
		);

	return (
		<div className="flex flex-col gap-4">
			<p className="text-muted-foreground text-xs">
				Visitante <span className="num text-foreground">{j.id}</span> · {formatInt(j.counts.events)}{" "}
				evento(s) · {formatInt(j.counts.videos)} play(s) de vídeo · {formatInt(j.counts.sales)}{" "}
				evento(s) de venda
			</p>

			<div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
				<VisitorCard j={j} />
				<OriginCard j={j} />
				<PurchasesCard j={j} />
			</div>

			{j.related.length > 0 && <RelatedCard j={j} />}

			<Timeline j={j} />
		</div>
	);
}

// ---------------------------------------------------------------- resumo

function Row({ label, children }: { label: string; children: ReactNode }) {
	return (
		<>
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="min-w-0 break-words">{children ?? "—"}</dd>
		</>
	);
}
const dash = (v: string | null | undefined) => v || "—";

function VisitorCard({ j }: { j: Journey }) {
	const v = j.visitor;
	return (
		<GlassCard>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 font-semibold">
					<CircleUserRoundIcon className="text-muted-foreground size-4" /> Dados do visitante
				</CardTitle>
			</CardHeader>
			<CardContent>
				<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
					<Row label="Primeira visita">
						{j.firstSeen ? (
							<span className="num">{formatDateTime(j.firstSeen, j.timeZone)}</span>
						) : (
							"—"
						)}
					</Row>
					<Row label="Última atividade">
						{j.lastSeen ? (
							<span className="num">{formatDateTime(j.lastSeen, j.timeZone)}</span>
						) : (
							"—"
						)}
					</Row>
					<Row label="E-mail">{dash(v?.email)}</Row>
					<Row label="Nome">{v?.name ? `${v.name} (da compra)` : "—"}</Row>
					<Row label="Telefone">{v?.phone ? `${v.phone} (da compra)` : "—"}</Row>
					<Row label="Local">{dash(v?.place)}</Row>
					<Row label="Aparelho">
						{v?.userAgent ? (
							<span title={v.userAgent}>{deviceSummary(v.userAgent) ?? v.userAgent}</span>
						) : (
							"—"
						)}
					</Row>
					<Row label="IP">
						<span className="num">{dash(v?.ip)}</span>
					</Row>
					<Row label="GA client_id">
						<span className="num text-xs break-all">{dash(v?.gaClientId)}</span>
					</Row>
					<Row label="Meta _fbp">
						<span className="num text-xs break-all">{dash(v?.fbp)}</span>
					</Row>
				</dl>
				{!v?.name && !v?.phone && (
					<p className="text-muted-foreground mt-3 text-xs">
						Nome e telefone só aparecem quando há um evento de venda (PIX gerado, compra…): no
						cadastro eles são guardados apenas em código irreversível.
					</p>
				)}
			</CardContent>
		</GlassCard>
	);
}

function UtmLines({ utm }: { utm: Utm }) {
	if (!hasUtm(utm)) return <span className="text-muted-foreground">Sem UTMs</span>;
	const c = splitUtm(utm.campaign);
	const t = splitUtm(utm.term);
	const a = splitUtm(utm.content);
	const named = (x: { name: string | null; id: string | null }) =>
		x.name || x.id ? (
			<>
				{x.name ?? "—"}
				{x.id && <span className="text-muted-foreground num text-xs"> · {x.id}</span>}
			</>
		) : (
			"—"
		);
	return (
		<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
			<dt className="text-muted-foreground">Fonte</dt>
			<dd className="break-words">
				{dash(utm.source)}
				{utm.medium && <span className="text-muted-foreground"> · {utm.medium}</span>}
			</dd>
			<dt className="text-muted-foreground">Campanha</dt>
			<dd className="break-words">{named(c)}</dd>
			<dt className="text-muted-foreground">Conjunto</dt>
			<dd className="break-words">{named(t)}</dd>
			<dt className="text-muted-foreground">Anúncio</dt>
			<dd className="break-words">{named(a)}</dd>
		</dl>
	);
}

function OriginCard({ j }: { j: Journey }) {
	const v = j.visitor;
	const click = fbcInfo(v?.fbc);
	return (
		<GlassCard>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 font-semibold">
					<MapPinIcon className="text-muted-foreground size-4" /> Origem e atribuição
				</CardTitle>
				<CardDescription>
					Primeiro toque = primeira origem registrada; último toque = a mais recente.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-3 text-sm">
				<div>
					<div className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
						Primeiro toque
						{j.firstTouch && (
							<span className="num normal-case">
								{" "}
								· {formatDateTime(j.firstTouch.at, j.timeZone)}
							</span>
						)}
					</div>
					{j.firstTouch ? (
						<UtmLines utm={j.firstTouch.utm} />
					) : (
						<span className="text-muted-foreground">Sem UTMs registradas</span>
					)}
				</div>
				<div>
					<div className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
						Último toque
					</div>
					<UtmLines
						utm={
							v?.utm ?? {
								campaign: null,
								content: null,
								medium: null,
								source: null,
								term: null,
							}
						}
					/>
				</div>
				<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
					<Row label="Primeira página">
						<span className="text-xs break-all">{dash(v?.landingUrl)}</span>
					</Row>
					<Row label="Veio de">
						<span className="text-xs break-all">
							{v?.referrer || "Acesso direto / sem referência"}
						</span>
					</Row>
					<Row label="Clique em anúncio Meta">
						{click ? (
							<span>
								<span className="num">{formatDateTime(click.clickedAt, j.timeZone)}</span>
								<span className="text-muted-foreground num block text-xs break-all">
									fbclid {click.fbclid}
								</span>
							</span>
						) : (
							"Não registrado"
						)}
					</Row>
				</dl>
			</CardContent>
		</GlassCard>
	);
}

function PurchasesCard({ j }: { j: Journey }) {
	return (
		<GlassCard className="lg:col-span-2 xl:col-span-1">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 font-semibold">
					<ShoppingBagIcon className="text-muted-foreground size-4" /> Compras
				</CardTitle>
				<CardDescription>
					{j.purchases.length
						? "Cada pedido ligado a esta pessoa e a origem gravada na venda."
						: "Nenhuma compra ligada a esta pessoa."}
				</CardDescription>
			</CardHeader>
			{j.purchases.length > 0 && (
				<CardContent className="flex flex-col gap-4 text-sm">
					{j.purchases.map(p => (
						<div
							key={p.transactionId}
							className="flex flex-col gap-2 border-b pb-4 last:border-0 last:pb-0"
						>
							<div className="flex flex-wrap items-center gap-2">
								<span className="num font-semibold">
									{formatMoney(p.value, p.currency ?? j.currency)}
								</span>
								<PurchaseStatus status={p.status} />
								{p.isRenewal && <Badge variant="outline">Renovação</Badge>}
							</div>
							<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
								<Row label="Pedido">
									<Link
										href={`/painel/faturamento?periodo=max&q=${encodeURIComponent(p.transactionId)}`}
										className="num text-xs break-all underline-offset-4 hover:underline"
									>
										{p.transactionId}
									</Link>
								</Row>
								<Row label="Data">
									{p.occurredAt ? (
										<span className="num">
											{formatDateTime(p.occurredAt, j.timeZone)}
										</span>
									) : (
										"—"
									)}
								</Row>
								<Row label="Produto">{dash(p.product)}</Row>
								<Row label="Ligada por">
									{p.matchBy ? (MATCH_LABEL[p.matchBy] ?? p.matchBy) : "—"}
									{p.matchReason && (
										<span className="text-muted-foreground block text-xs">
											{p.matchReason}
										</span>
									)}
								</Row>
							</dl>
							<div>
								<div className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
									Origem da venda
								</div>
								<UtmLines utm={p.utm} />
							</div>
						</div>
					))}
				</CardContent>
			)}
		</GlassCard>
	);
}

function RelatedCard({ j }: { j: Journey }) {
	return (
		<GlassCard>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 font-semibold">
					<SmartphoneIcon className="text-muted-foreground size-4" /> A mesma pessoa em outros
					aparelhos
				</CardTitle>
				<CardDescription>
					Outros visitantes com o mesmo e-mail ou telefone (comparados pelo código irreversível).
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ul className="flex flex-col gap-2 text-sm">
					{j.related.map(r => (
						<li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
							<span className="min-w-0">
								<span className="num break-all">{r.id}</span>
								<span className="text-muted-foreground text-xs">
									{" "}
									· mesmo {r.by} · última atividade{" "}
									<span className="num">{formatDateTime(r.updatedAt, j.timeZone)}</span>
								</span>
							</span>
							<Button asChild variant="outline" size="sm" className="h-9">
								<JourneyLink href={`/painel/visitante/${encodeURIComponent(r.id)}`}>
									Ver jornada <ArrowRightIcon />
								</JourneyLink>
							</Button>
						</li>
					))}
				</ul>
			</CardContent>
		</GlassCard>
	);
}

// ---------------------------------------------------------------- linha do tempo

function Timeline({ j }: { j: Journey }) {
	// Agrupa por dia (no fuso do painel) e marca quando a origem (UTMs) muda de um item para o outro.
	const days: { label: string; items: { item: JourneyItem; newOrigin: boolean }[] }[] = [];
	let lastUtm: Utm | null = null;
	for (const item of j.items) {
		const label = formatDayLong(item.at, j.timeZone);
		let newOrigin = false;
		if (item.kind !== "sale" && hasUtm(item.utm)) {
			newOrigin = lastUtm !== null && !sameUtm(lastUtm, item.utm);
			lastUtm = item.utm;
		}
		if (days.at(-1)?.label !== label) days.push({ items: [], label });
		days.at(-1)!.items.push({ item, newOrigin });
	}

	return (
		<GlassCard>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 font-semibold">
					<ActivityIcon className="text-muted-foreground size-4" /> Linha do tempo
				</CardTitle>
				<CardDescription>
					{j.hasMore
						? `Mostrando os ${formatInt(j.shown)} registros mais recentes de ${formatInt(j.counts.total)}. `
						: `${formatInt(j.counts.total)} registro(s), do mais antigo ao mais novo. `}
					Toque num item para ver página, UTMs, local, IP e aparelho daquele momento.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-5">
				{j.hasMore && (
					<Button asChild variant="outline" className="h-11 self-start">
						<Link href={`?ver=${j.shown + JOURNEY_STEP}`} scroll={false}>
							Carregar registros anteriores
						</Link>
					</Button>
				)}
				{days.length === 0 && <p className="text-muted-foreground text-sm">Nenhum registro.</p>}
				{days.map(d => (
					<section key={d.label} aria-label={d.label} className="flex flex-col gap-1">
						<h3 className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
							{d.label}
						</h3>
						<ol className="flex flex-col border-l pl-4">
							{d.items.map(({ item, newOrigin }) => (
								<li key={item.key} className="relative">
									<span
										aria-hidden
										className="bg-border absolute top-4 -left-[1.3rem] size-2 rounded-full"
									/>
									<ItemRow item={item} newOrigin={newOrigin} j={j} />
								</li>
							))}
						</ol>
					</section>
				))}
			</CardContent>
		</GlassCard>
	);
}

function ItemRow({ item, newOrigin, j }: { item: JourneyItem; newOrigin: boolean; j: Journey }) {
	const time = (
		<span className="num text-muted-foreground w-[4.5rem] shrink-0 text-xs">
			{formatTimeSec(item.at, j.timeZone)}
		</span>
	);

	if (item.kind === "event")
		return (
			<details className="group rounded-md py-1.5">
				<summary className="hover:bg-muted/40 -mx-2 flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-1.5">
					{time}
					<span className="font-medium">{item.name}</span>
					{item.url && (
						<span className="text-muted-foreground min-w-0 truncate text-xs">
							{pageKey(item.url)}
						</span>
					)}
					{item.value !== null && (
						<span className="num text-xs">
							{formatMoney(item.value, item.currency ?? j.currency)}
						</span>
					)}
					{hasUtm(item.utm) && (
						<span className="text-muted-foreground text-xs">{utmSummary(item.utm)}</span>
					)}
					{newOrigin && <Badge variant="outline">Nova origem</Badge>}
				</summary>
				<div className="bg-muted/30 mt-1 flex flex-col gap-3 rounded-md p-3 text-sm">
					<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
						<Row label="Página">
							<span className="text-xs break-all">{dash(item.url)}</span>
						</Row>
						<Row label="Local">{dash(item.place)}</Row>
						<Row label="IP">
							<span className="num">{dash(item.ip)}</span>
						</Row>
						<Row label="Aparelho">
							{item.userAgent ? (
								<span title={item.userAgent}>
									{deviceSummary(item.userAgent) ?? item.userAgent}
								</span>
							) : (
								"—"
							)}
						</Row>
						<Row label="event_id">
							<span className="num text-xs break-all">{item.eventId}</span>
						</Row>
						<Row label="Envio à Meta">
							<DeliveryStatus status={item.metaStatus} />
						</Row>
					</dl>
					<UtmLines utm={item.utm} />
					<EventDetailButton
						eventRowId={item.rowId}
						timeZone={j.timeZone}
						className="text-primary self-start text-xs underline-offset-4 hover:underline"
					>
						Ver o que foi enviado e recebido da Meta →
					</EventDetailButton>
				</div>
			</details>
		);

	if (item.kind === "video") {
		const pct = item.durationS ? Math.round((item.maxPositionS / item.durationS) * 100) : null;
		return (
			<details className="group rounded-md py-1.5">
				<summary className="hover:bg-muted/40 -mx-2 flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-1.5">
					{time}
					<span className="flex items-center gap-1.5 font-medium">
						<PlayIcon className="text-muted-foreground size-3.5" /> Vídeo:{" "}
						{item.title ?? item.videoId}
					</span>
					<span className="text-muted-foreground text-xs">
						chegou a {pct !== null ? `${pct}% · ` : ""}
						<span className="num">{formatClock(item.maxPositionS)}</span> · assistiu{" "}
						<span className="num">{formatClock(item.watchedS)}</span>
						{item.ctaS !== null &&
							(item.maxPositionS >= item.ctaS ? " · passou do botão" : " · antes do botão")}
						{item.completed && " · até o fim"}
					</span>
					{newOrigin && <Badge variant="outline">Nova origem</Badge>}
				</summary>
				<div className="bg-muted/30 mt-1 flex flex-col gap-3 rounded-md p-3 text-sm">
					<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
						<Row label="Página">
							<span className="text-xs break-all">{dash(item.pageUrl)}</span>
						</Row>
						<Row label="Duração">
							<span className="num">{formatClock(item.durationS)}</span>
						</Row>
						<Row label="Último envio">
							<span className="num">{formatTimeSec(item.lastAt, j.timeZone)}</span>
						</Row>
						<Row label="Local">{dash(item.place)}</Row>
					</dl>
					<UtmLines utm={item.utm} />
				</div>
			</details>
		);
	}

	return (
		<div className="-mx-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-3">
			{time}
			<span className="flex items-center gap-1.5 font-medium">
				<BanknoteIcon className="text-muted-foreground size-3.5" /> {saleEventLabel(item.eventType)}
			</span>
			{item.amount !== null && (
				<span className="num text-xs">{formatMoney(item.amount, j.currency)}</span>
			)}
			{item.product && <span className="text-muted-foreground text-xs">{item.product}</span>}
			{item.isRenewal && <Badge variant="outline">Renovação</Badge>}
			<Link
				href={`/painel/faturamento?periodo=max&q=${encodeURIComponent(item.transactionId)}`}
				className="text-muted-foreground num text-xs underline-offset-4 hover:underline"
			>
				{item.transactionId}
			</Link>
		</div>
	);
}
