import { BanknoteIcon, ReceiptIcon, RepeatIcon, ShoppingBagIcon, Undo2Icon, WalletIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ChartCard } from "@/components/charts/chart-card";
import { SegmentedBar } from "@/components/charts/segmented-bar";
import { TrendChart } from "@/components/charts/trend-chart";
import {
	FiltersBar,
	FiltersProvider,
	Pagination,
	PendingArea,
	SearchFilter,
	SelectFilter,
} from "@/components/dashboard/filters";
import { PurchasesTable } from "@/components/dashboard/purchases-table";
import { GlassCard } from "@/components/glass-card";
import { KpiCard } from "@/components/kpi-card";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SearchParams } from "@/lib/dashboard/context";
import { delta, formatDayShort, formatInt, formatMoney, formatPct, ratio } from "@/lib/dashboard/format";
import { getRevenue, PURCHASE_STATUS_FILTERS } from "@/lib/dashboard/revenue";

export const metadata: Metadata = { title: "Faturamento" };

/** Cor fixa por forma de pagamento (cor segue a entidade, nunca a posição). */
const METHOD_COLOR: Record<string, string> = {
	BOLETO: "var(--viz-3)",
	CREDIT_CARD: "var(--viz-2)",
	OUTRO: "var(--viz-4)",
	PIX: "var(--viz-1)",
};

export default function FaturamentoPage({ searchParams }: PageProps<"/painel/faturamento">) {
	return (
		<div className="flex flex-col gap-6">
			<PageHeader title="Faturamento" description="Receita, ticket médio, reembolsos e compras." />
			<Suspense fallback={<PageSkeleton />}>
				<RevenueContent searchParams={searchParams} />
			</Suspense>
		</div>
	);
}

async function RevenueContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
	const d = await getRevenue(await searchParams);
	const { kpis, currency } = d;
	/** Em "Máximo" não há período anterior: os cartões não mostram a variação. */
	const cmp = <T,>(x: T) => (d.period.compare ? x : undefined);
	// Sem compras não há ticket médio: mostra "—" e a comparação fica de fora.
	const ticket = kpis.purchases ? kpis.revenue / kpis.purchases : null;
	const ticketPrev = kpis.purchasesPrev ? kpis.revenuePrev / kpis.purchasesPrev : null;
	const methodTotal = d.byPaymentMethod.reduce((s, m) => s + m.value, 0);

	return (
		<FiltersProvider>
			<div className="flex flex-col gap-4">
				<FiltersBar>
					<SelectFilter
						name="status"
						label="Status"
						allLabel="Todos os status"
						options={PURCHASE_STATUS_FILTERS.filter(f => f.key !== "todas").map(f => ({
							label: f.label,
							value: f.key,
						}))}
						width="w-[14rem]"
					/>
					<SearchFilter placeholder="Pedido, email ou produto" />
				</FiltersBar>
				<PendingArea className="flex flex-col gap-4">
					<section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
						<KpiCard
							label="Receita"
							value={formatMoney(kpis.revenue, currency)}
							icon={BanknoteIcon}
							tone="cyan"
							info="Valor bruto pago nas compras aprovadas (ou em mediação) do período, renovações incluídas."
							delta={cmp({ value: delta(kpis.revenue, kpis.revenuePrev) })}
						/>
						<KpiCard
							label="Receita líquida"
							value={formatMoney(kpis.net, currency)}
							icon={WalletIcon}
							info="O que sobra depois das taxas do SimIntPay (netAmount)."
						/>
						<KpiCard
							label="Ticket médio"
							value={ticket === null ? "—" : formatMoney(ticket, currency)}
							icon={ReceiptIcon}
							tone="amber"
							info="Receita ÷ número de compras."
							delta={cmp({ value: delta(ticket, ticketPrev) })}
						/>
						<KpiCard
							label="Compras"
							value={formatInt(kpis.purchases)}
							icon={ShoppingBagIcon}
							info="Vendas aprovadas (ou em mediação) pela data da venda, renovações incluídas. Na Visão geral, Compras conta só as vendas novas."
							delta={cmp({ value: delta(kpis.purchases, kpis.purchasesPrev) })}
						/>
						<KpiCard
							label="Reembolsos"
							value={formatInt(kpis.refunds)}
							icon={Undo2Icon}
							tone="amber"
							info="Reembolsos e chargebacks registrados no período (pela data do reembolso)."
							hint={`${formatMoney(kpis.refundsValue, currency)} devolvidos`}
						/>
						<KpiCard
							label="Renovações"
							value={formatInt(kpis.renewals)}
							icon={RepeatIcon}
							tone="cyan"
							info="Recompras de quem já tinha pago, pela data da venda. Já estão somadas em Receita e Compras; não vão à Meta/GA4 nem entram em conversão e ROAS."
							hint={`${formatMoney(kpis.renewalsValue, currency)} em renovações`}
							delta={cmp({ value: delta(kpis.renewals, kpis.renewalsPrev) })}
						/>
					</section>

					<div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
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
						<ChartCard
							title="Formas de pagamento"
							description="Participação na receita do período."
							table={{
								columns: [
									{ key: "forma", label: "Forma" },
									{ align: "right", key: "compras", label: "Compras" },
									{ align: "right", key: "receita", label: "Receita" },
									{ align: "right", key: "pct", label: "%" },
								],
								rows: d.byPaymentMethod.map(m => ({
									compras: formatInt(m.count),
									forma: m.label,
									pct: formatPct(ratio(m.value, methodTotal)),
									receita: formatMoney(m.value, currency),
								})),
							}}
						>
							<SegmentedBar
								currency={currency}
								parts={d.byPaymentMethod.map(m => ({
									color: METHOD_COLOR[m.key] ?? "var(--viz-5)",
									key: m.key,
									label: m.label,
									value: m.value,
								}))}
							/>
						</ChartCard>
					</div>

					<GlassCard>
						<CardHeader>
							<CardTitle className="font-semibold">
								<span className="num">{formatInt(d.table.total)}</span> compra(s) ·{" "}
								{d.period.label}
							</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-2">
							<PurchasesTable rows={d.table.rows} timeZone={d.timeZone} />
							<Pagination
								page={d.table.page}
								total={d.table.total}
								pageSize={d.table.pageSize}
							/>
						</CardContent>
					</GlassCard>
				</PendingArea>
			</div>
		</FiltersProvider>
	);
}
