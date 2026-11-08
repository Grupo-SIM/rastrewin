import type { Metadata } from "next";
import { Suspense } from "react";
import { BrazilMap } from "@/components/charts/brazil-map";
import { ChartCard } from "@/components/charts/chart-card";
import { RankedBars } from "@/components/charts/ranked-bars";
import { CitiesTable } from "@/components/dashboard/cities-table";
import { FiltersBar, FiltersProvider, PendingArea } from "@/components/dashboard/filters";
import { GlassCard } from "@/components/glass-card";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SearchParams } from "@/lib/dashboard/context";
import { countryName, formatInt, formatMoney, formatPct, ratio } from "@/lib/dashboard/format";
import { getGeo } from "@/lib/dashboard/geo";
import { UF_NAME } from "@/lib/geo/br-states";

export const metadata: Metadata = { title: "Geo" };

export default function GeoPage({ searchParams }: PageProps<"/painel/geo">) {
	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Geo"
				description="De onde vêm os visitantes e as vendas (localização aproximada pelo IP)."
			/>
			<Suspense fallback={<PageSkeleton />}>
				<GeoContent searchParams={searchParams} />
			</Suspense>
		</div>
	);
}

async function GeoContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
	const d = await getGeo(await searchParams);
	const ufRows = [...d.byUf].sort((a, b) => b.visitors - a.visitors);
	return (
		<FiltersProvider>
			<div className="flex flex-col gap-4">
				<FiltersBar />
				<PendingArea className="flex flex-col gap-4">
					<div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
						<ChartCard
							title="Brasil por estado"
							description={`${formatInt(d.totals.withGeo)} de ${formatInt(d.totals.visitors)} visitantes com localização (${formatPct(ratio(d.totals.withGeo, d.totals.visitors))}). Compras e receita: só vendas novas.`}
							table={{
								columns: [
									{ key: "uf", label: "Estado" },
									{ align: "right", key: "v", label: "Visitantes" },
									{ align: "right", key: "c", label: "Compras" },
									{ align: "right", key: "r", label: "Receita" },
								],
								rows: ufRows.map(u => ({
									c: formatInt(u.purchases),
									r: formatMoney(u.revenue, d.currency),
									uf: `${UF_NAME[u.uf] ?? u.uf} (${u.uf})`,
									v: formatInt(u.visitors),
								})),
							}}
							footer="Malha: IBGE. Geolocalização por IP: DB-IP (CC BY 4.0) — estado e cidade são aproximados."
						>
							<BrazilMap data={d.byUf} currency={d.currency} />
						</ChartCard>

						<div className="flex flex-col gap-4">
							<ChartCard
								title="Países"
								description="Visitantes únicos por país. O gráfico mostra os 10 maiores; a tabela, todos."
								table={{
									columns: [
										{ key: "p", label: "País" },
										{ align: "right", key: "v", label: "Visitantes" },
									],
									rows: d.allCountries.map(c => ({ p: c.label, v: formatInt(c.value) })),
								}}
							>
								<RankedBars items={d.countries} color="var(--viz-1)" />
							</ChartCard>

							<GlassCard>
								<CardHeader>
									<CardTitle className="font-semibold">Cidades</CardTitle>
									<CardDescription>
										Visitantes únicos por cidade, das maiores para as menores.
									</CardDescription>
								</CardHeader>
								<CardContent>
									{d.cities.length ? (
										<CitiesTable
											total={d.citiesTotal}
											rows={d.cities.map(c => ({
												city: c.city,
												key: `${c.city}-${c.region}-${c.country}`,
												place:
													c.country === "BR"
														? (c.region ?? "—")
														: countryName(c.country),
												visitors: c.visitors,
											}))}
										/>
									) : (
										<p className="text-muted-foreground py-8 text-center text-sm">
											Sem dados no período
										</p>
									)}
								</CardContent>
							</GlassCard>
						</div>
					</div>
				</PendingArea>
			</div>
		</FiltersProvider>
	);
}
