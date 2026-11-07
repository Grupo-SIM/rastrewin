import {
	ActivityIcon,
	BanknoteIcon,
	CoinsIcon,
	PercentIcon,
	PlugIcon,
	ShoppingBagIcon,
	TrendingUpIcon,
	UsersIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { ChartCard } from "@/components/charts/chart-card";
import { Funnel } from "@/components/charts/funnel";
import { RankedBars } from "@/components/charts/ranked-bars";
import { TrendChart } from "@/components/charts/trend-chart";
import { FiltersBar, FiltersProvider, PendingArea } from "@/components/dashboard/filters";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { roas } from "@/lib/campaigns/build";
import { type AdSpend, getAdSpend } from "@/lib/campaigns/query";
import type { SearchParams } from "@/lib/dashboard/context";
import {
	delta,
	formatDayShort,
	formatInt,
	formatMoney,
	formatPct,
	formatRoas,
	ratio,
} from "@/lib/dashboard/format";
import { getOverview } from "@/lib/dashboard/overview";
import type { Period } from "@/lib/dashboard/period";
import { safeErrorMessage } from "@/lib/errors";

export const metadata: Metadata = { title: "Visão geral" };

export default function VisaoGeralPage({ searchParams }: PageProps<"/painel">) {
	return (
		<div className="flex flex-col gap-6">
			<PageHeader title="Visão geral" description="Usuários, eventos e conversões do período." />
			<Suspense fallback={<PageSkeleton />}>
				<OverviewContent searchParams={searchParams} />
			</Suspense>
		</div>
	);
}

async function OverviewContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
	const d = await getOverview(await searchParams);
	const { kpis, funnel, currency } = d;
	/** Em "Máximo" não há período anterior: os cartões não mostram a variação. */
	const cmp = <T,>(x: T) => (d.period.compare ? x : undefined);
	const conv = ratio(kpis.purchases, kpis.users);
	const convPrev = ratio(kpis.purchasesPrev, kpis.usersPrev);
	const steps = [
		{ label: "Visitou", value: funnel.visited },
		{ label: "Checkout", value: funnel.checkout },
		{ label: "Comprou", value: funnel.purchased },
	];

	return (
		<FiltersProvider>
			<div className="flex flex-col gap-4">
				<FiltersBar />
				<p className="text-muted-foreground text-xs">
					{d.period.label} · {formatDayShort(d.period.from)} a {formatDayShort(d.period.to)}
					{d.period.compare && ` · comparado com os ${formatInt(d.period.days)} dia(s) anteriores`}
				</p>
				<PendingArea className="flex flex-col gap-4">
					{!d.hasAnyData && (
						<EmptyState
							icon={PlugIcon}
							title="Nenhum dado ainda"
							description="Instale o script no site e cadastre os sites autorizados para começar a ver visitantes e eventos aqui."
						>
							<Button asChild className="h-11">
								<Link href="/painel/config">Ir para Configurações</Link>
							</Button>
						</EmptyState>
					)}

					<section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
						<KpiCard
							label="Usuários únicos"
							value={formatInt(kpis.users)}
							icon={UsersIcon}
							info="Visitantes diferentes (trck_user_id) com algum evento no período."
							delta={cmp({ value: delta(kpis.users, kpis.usersPrev) })}
						/>
						<KpiCard
							label="Eventos"
							value={formatInt(kpis.events)}
							icon={ActivityIcon}
							tone="cyan"
							info="Todos os eventos registrados no período (PageView, Lead, InitiateCheckout…)."
							delta={cmp({ value: delta(kpis.events, kpis.eventsPrev) })}
						/>
						<KpiCard
							label="Compras"
							value={formatInt(kpis.purchases)}
							icon={ShoppingBagIcon}
							tone="amber"
							info="Vendas aprovadas (ou em mediação) pela data da venda."
							delta={cmp({ value: delta(kpis.purchases, kpis.purchasesPrev) })}
						/>
						<KpiCard
							label="Conversão"
							value={formatPct(conv)}
							icon={PercentIcon}
							info="Compras ÷ usuários únicos do período."
							delta={cmp({
								value: conv !== null && convPrev !== null ? delta(conv, convPrev) : null,
							})}
						/>
					</section>

					<section aria-label="Investimento" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
						<KpiCard
							className="col-span-2 lg:col-span-1"
							label="Receita"
							value={formatMoney(kpis.revenue, currency)}
							icon={BanknoteIcon}
							tone="cyan"
							info="Soma do valor bruto pago nas compras do período (o mesmo valor enviado à Meta e ao GA4)."
							delta={cmp({ value: delta(kpis.revenue, kpis.revenuePrev) })}
						/>
						{/* Gasto vem da Meta: carrega à parte para nunca atrasar o resto da página. */}
						<Suspense fallback={<SpendSkeleton />}>
							<SpendCards
								period={d.period}
								timeZone={d.timeZone}
								currency={currency}
								revenue={kpis.revenue}
								revenuePrev={kpis.revenuePrev}
							/>
						</Suspense>
					</section>

					<div className="grid gap-4 lg:grid-cols-2">
						<ChartCard
							title="Funil"
							description="Pessoas que visitaram → foram ao checkout → compraram, no período."
							table={{
								columns: [
									{ key: "etapa", label: "Etapa" },
									{ align: "right", key: "pessoas", label: "Pessoas" },
									{ align: "right", key: "etapa_ant", label: "% da etapa anterior" },
									{ align: "right", key: "topo", label: "% do topo" },
								],
								rows: steps.map((s, i) => ({
									etapa: s.label,
									etapa_ant: i === 0 ? "—" : formatPct(ratio(s.value, steps[i - 1].value)),
									pessoas: formatInt(s.value),
									topo: formatPct(ratio(s.value, steps[0].value)),
								})),
							}}
							footer={
								funnel.outsideFunnel > 0
									? `${formatInt(funnel.outsideFunnel)} compra(s) do período ficaram fora do funil (sem ligação com um visitante ou sem checkout registrado).`
									: undefined
							}
						>
							<Funnel steps={steps} />
						</ChartCard>

						<ChartCard
							title="Eventos por tipo"
							description="Quantidade de cada evento no período."
							table={{
								columns: [
									{ key: "evento", label: "Evento" },
									{ align: "right", key: "qtd", label: "Quantidade" },
								],
								rows: d.eventsByType.map(e => ({ evento: e.label, qtd: formatInt(e.value) })),
							}}
						>
							<RankedBars items={d.eventsByType} color="var(--viz-1)" />
						</ChartCard>
					</div>

					<div className="grid gap-4 lg:grid-cols-2">
						<ChartCard
							title="Usuários únicos por dia"
							table={{
								columns: [
									{ key: "dia", label: "Dia" },
									{ align: "right", key: "v", label: "Usuários" },
								],
								rows: d.usersByDay.map(p => ({
									dia: formatDayShort(p.day),
									v: formatInt(p.value),
								})),
							}}
						>
							<TrendChart data={d.usersByDay} label="Usuários únicos" color="var(--viz-1)" />
						</ChartCard>
						<ChartCard
							title="Receita por dia"
							table={{
								columns: [
									{ key: "dia", label: "Dia" },
									{ align: "right", key: "v", label: "Receita" },
								],
								rows: d.revenueByDay.map(p => ({
									dia: formatDayShort(p.day),
									v: formatMoney(p.value, currency),
								})),
							}}
						>
							<TrendChart
								data={d.revenueByDay}
								label="Receita"
								kind="money"
								currency={currency}
								color="var(--viz-2)"
							/>
						</ChartCard>
					</div>
				</PendingArea>
			</div>
		</FiltersProvider>
	);
}

function SpendSkeleton() {
	return (
		<>
			<Skeleton className="h-full min-h-28 rounded-xl" aria-label="Carregando gasto" />
			<Skeleton className="h-full min-h-28 rounded-xl" aria-label="Carregando ROAS" />
		</>
	);
}

async function SpendCards({
	period,
	timeZone,
	currency,
	revenue,
	revenuePrev,
}: {
	period: Period;
	timeZone: string;
	currency: string;
	revenue: number;
	revenuePrev: number;
}) {
	let ads: AdSpend;
	try {
		ads = await getAdSpend(period, timeZone);
	} catch (err) {
		unstable_rethrow(err);
		console.error("[visão geral] gasto da Meta:", safeErrorMessage(err));
		ads = {
			configured: true,
			notice: "Não foi possível consultar a Meta agora.",
			prevSpend: null,
			spend: null,
		};
	}
	const { spend, prevSpend } = ads;
	const hint = !ads.configured
		? "Cadastre a conta de anúncios em Configurações."
		: spend === null
			? (ads.notice ?? "Sem dados da Meta ainda.")
			: undefined;
	const r = spend === null ? null : roas({ revenue, spend });
	const rPrev = prevSpend === null ? null : roas({ revenue: revenuePrev, spend: prevSpend });
	const compare = period.compare && spend !== null && prevSpend !== null;

	return (
		<>
			<KpiCard
				label="Gasto"
				value={spend === null ? "—" : formatMoney(spend, currency)}
				icon={CoinsIcon}
				tone="amber"
				info="Investimento nos anúncios segundo a Meta (todas as contas ativas). Atualiza a cada 1 h quando o período inclui hoje."
				hint={hint}
				delta={compare ? { goodWhenUp: false, value: delta(spend, prevSpend) } : undefined}
			/>
			<KpiCard
				label="ROAS"
				value={formatRoas(r)}
				icon={TrendingUpIcon}
				info="Receita total ÷ gasto. Inclui vendas que não vieram de anúncio; o ROAS só das campanhas fica na aba Campanhas."
				delta={compare && r !== null && rPrev !== null ? { value: delta(r, rPrev) } : undefined}
			/>
		</>
	);
}
