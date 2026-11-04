import type { Metadata } from "next";
import { Suspense } from "react";
import { BrazilMap } from "@/components/charts/brazil-map";
import { ChartCard } from "@/components/charts/chart-card";
import { RankedBars } from "@/components/charts/ranked-bars";
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
      <PageHeader title="Geo" description="De onde vêm os visitantes e as vendas (localização aproximada pelo IP)." />
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
              description={`${formatInt(d.totals.withGeo)} de ${formatInt(d.totals.visitors)} visitantes com localização (${formatPct(ratio(d.totals.withGeo, d.totals.visitors))}).`}
              table={{
                columns: [{ key: "uf", label: "Estado" }, { key: "v", label: "Visitantes", align: "right" }, { key: "c", label: "Compras", align: "right" }, { key: "r", label: "Receita", align: "right" }],
                rows: ufRows.map((u) => ({ uf: `${UF_NAME[u.uf] ?? u.uf} (${u.uf})`, v: formatInt(u.visitors), c: formatInt(u.purchases), r: formatMoney(u.revenue, d.currency) })),
              }}
              footer="Malha: IBGE. Geolocalização por IP: DB-IP (CC BY 4.0) — estado e cidade são aproximados."
            >
              <BrazilMap data={d.byUf} currency={d.currency} />
            </ChartCard>

            <div className="flex flex-col gap-4">
              <ChartCard
                title="Países"
                description="Visitantes únicos por país."
                table={{ columns: [{ key: "p", label: "País" }, { key: "v", label: "Visitantes", align: "right" }], rows: d.countries.map((c) => ({ p: c.label, v: formatInt(c.value) })) }}
              >
                <RankedBars items={d.countries} color="var(--viz-1)" />
              </ChartCard>

              <GlassCard>
                <CardHeader>
                  <CardTitle className="font-semibold">Principais cidades</CardTitle>
                  <CardDescription>Visitantes únicos por cidade (top 20).</CardDescription>
                </CardHeader>
                <CardContent>
                  {d.cities.length ? (
                    <div className="max-h-96 overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-card">
                          <tr className="border-b text-left text-xs text-muted-foreground">
                            <th scope="col" className="py-2 pr-3 font-medium">Cidade</th>
                            <th scope="col" className="py-2 pr-3 font-medium">Estado / país</th>
                            <th scope="col" className="py-2 text-right font-medium">Visitantes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.cities.map((c) => (
                            <tr key={`${c.city}-${c.region}-${c.country}`} className="border-b last:border-0">
                              <td className="py-1.5 pr-3">{c.city}</td>
                              <td className="py-1.5 pr-3 text-muted-foreground">{c.country === "BR" ? (c.region ?? "—") : countryName(c.country)}</td>
                              <td className="num py-1.5 text-right">{formatInt(c.visitors)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no período</p>
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
