import {
	BanknoteIcon,
	CoinsIcon,
	MegaphoneIcon,
	PercentIcon,
	ShoppingBagIcon,
	TargetIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CampaignTree } from "@/components/campaigns/campaign-tree";
import { StatusStrip } from "@/components/campaigns/status-strip";
import { UtmGuide } from "@/components/campaigns/utm-guide";
import { ChartCard } from "@/components/charts/chart-card";
import { MultiTrendChart } from "@/components/charts/multi-trend-chart";
import { FiltersBar, FiltersProvider, PendingArea, SelectFilter } from "@/components/dashboard/filters";
import { EmptyState } from "@/components/empty-state";
import { GlassCard } from "@/components/glass-card";
import { KpiCard } from "@/components/kpi-card";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cpa, roas } from "@/lib/campaigns/build";
import { getCampaigns } from "@/lib/campaigns/query";
import type { SearchParams } from "@/lib/dashboard/context";
import { delta, formatDayShort, formatInt, formatMoney, formatRoas } from "@/lib/dashboard/format";
import { periodRange } from "@/lib/dashboard/period";

export const metadata: Metadata = { title: "Campanhas" };

export default function CampanhasPage({ searchParams }: PageProps<"/painel/campanhas">) {
	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Campanhas"
				description="Gasto no Meta Ads cruzado com a receita das vendas (UTMs): ROAS e CPA por campanha, conjunto e anúncio."
			/>
			<Suspense fallback={<PageSkeleton />}>
				<CampaignsContent searchParams={searchParams} />
			</Suspense>
		</div>
	);
}

async function CampaignsContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
	const d = await getCampaigns(await searchParams);

	if (!d.accounts.length) {
		return (
			<EmptyState
				icon={MegaphoneIcon}
				title="Nenhuma conta de anúncio"
				description="Cadastre uma conta de anúncios da Meta (com token de leitura ads_read) para ver gasto, ROAS e CPA aqui."
			>
				<Button asChild className="h-11">
					<Link href="/painel/config">Ir para Configurações</Link>
				</Button>
			</EmptyState>
		);
	}

	const { totals: t, prevTotals: p, currency } = d;
	const r = roas(t);
	const c = cpa(t);

	return (
		<FiltersProvider>
			<div className="flex flex-col gap-4">
				<FiltersBar>
					{d.accounts.length > 1 && (
						<SelectFilter
							name="conta"
							label="Conta de anúncios"
							allLabel="Todas as contas"
							options={d.accounts.map(a => ({ label: a.label, value: a.adAccountId }))}
							width="w-[13rem]"
						/>
					)}
				</FiltersBar>
				<StatusStrip
					results={d.results}
					detail={d.detail}
					structure={d.structure}
					timeZone={d.timeZone}
				/>
				<PendingArea className="flex flex-col gap-4">
					<section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
						<KpiCard
							label="Gasto"
							value={formatMoney(t.spend, currency)}
							icon={CoinsIcon}
							tone="amber"
							info="Investimento nos anúncios segundo a Meta (período e contas selecionados)."
							delta={p ? { goodWhenUp: false, value: delta(t.spend, p.spend) } : undefined}
						/>
						<KpiCard
							label="Receita atribuída"
							value={formatMoney(t.revenue, currency)}
							icon={BanknoteIcon}
							tone="cyan"
							info="Valor bruto das vendas ligadas às campanhas pelas UTMs."
							delta={p ? { value: delta(t.revenue, p.revenue) } : undefined}
						/>
						<KpiCard
							label="ROAS"
							value={formatRoas(r)}
							icon={PercentIcon}
							info="Receita atribuída ÷ gasto. Acima de 1, a receita superou o gasto."
							delta={
								p && roas(p) !== null && r !== null
									? { value: delta(r, roas(p)!) }
									: undefined
							}
						/>
						<KpiCard
							label="CPA"
							value={c === null ? "—" : formatMoney(c, currency)}
							icon={TargetIcon}
							tone="amber"
							info="Gasto ÷ vendas atribuídas (custo por venda)."
							delta={
								p && cpa(p) !== null && c !== null
									? { goodWhenUp: false, value: delta(c, cpa(p)!) }
									: undefined
							}
						/>
						<KpiCard
							className="col-span-2 lg:col-span-1"
							label="Vendas atribuídas"
							value={formatInt(t.purchases)}
							icon={ShoppingBagIcon}
							info="Vendas aprovadas do período ligadas a uma campanha pelas UTMs."
							hint={t.metaPurchases ? `Meta reporta ${formatInt(t.metaPurchases)}` : undefined}
						/>
					</section>

					{d.dailyAvailable && (
						<ChartCard
							title="Gasto × receita atribuída por dia"
							description="Mesma unidade (R$), mesmo eixo."
							table={{
								columns: [
									{ key: "dia", label: "Dia" },
									{ align: "right", key: "g", label: "Gasto" },
									{ align: "right", key: "r", label: "Receita" },
								],
								rows: d.daily.map(x => ({
									dia: formatDayShort(x.day),
									g: formatMoney(x.spend, currency),
									r: formatMoney(x.revenue, currency),
								})),
							}}
						>
							<MultiTrendChart
								data={d.daily}
								currency={currency}
								series={[
									{ color: "var(--viz-3)", key: "spend", label: "Gasto" },
									{ color: "var(--viz-2)", key: "revenue", label: "Receita atribuída" },
								]}
							/>
						</ChartCard>
					)}

					<GlassCard>
						<CardHeader>
							<CardTitle className="font-semibold">
								Campanhas · {d.period.label}
								{d.period.key !== "custom" && ` (${periodRange(d.period)})`}
							</CardTitle>
							<CardDescription>
								Toque numa campanha para ver os conjuntos e anúncios. Ordenado por gasto;
								campanhas ativas sem gasto no período aparecem no fim.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<CampaignTree
								tree={d.tree}
								totals={t}
								unattributed={d.unattributed}
								currency={currency}
								campaignAccount={d.campaignAccount}
								showAccount={d.accounts.length > 1 && !d.selected}
							/>
						</CardContent>
					</GlassCard>

					<UtmGuide salesInPeriod={d.salesInPeriod} salesWithCampaignUtm={d.salesWithCampaignUtm} />
				</PendingArea>
			</div>
		</FiltersProvider>
	);
}
