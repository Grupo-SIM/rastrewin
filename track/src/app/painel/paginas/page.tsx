import {
	ExternalLinkIcon,
	FileTextIcon,
	MousePointerClickIcon,
	PercentIcon,
	ShoppingBagIcon,
	UsersIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { FiltersBar, FiltersProvider, PendingArea, SearchFilter } from "@/components/dashboard/filters";
import { GlassCard } from "@/components/glass-card";
import { KpiCard } from "@/components/kpi-card";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SearchParams } from "@/lib/dashboard/context";
import { formatInt, formatMoney, formatPct, ratio } from "@/lib/dashboard/format";
import { pageHref } from "@/lib/dashboard/page-url";
import { getPages } from "@/lib/dashboard/pages";
import { periodRange } from "@/lib/dashboard/period";

export const metadata: Metadata = { title: "Páginas" };

export default function PaginasPage({ searchParams }: PageProps<"/painel/paginas">) {
	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Páginas"
				description="Conversão de cada página: visualizações, usuários, checkout e compras de quem a viu."
			/>
			<Suspense fallback={<PageSkeleton />}>
				<PagesContent searchParams={searchParams} />
			</Suspense>
		</div>
	);
}

const COLUMNS: { key: string; label: string; info: string }[] = [
	{
		info: "PageViews da página no período (recarregar conta de novo).",
		key: "views",
		label: "Visualizações",
	},
	{ info: "Pessoas diferentes (trck_user_id) que viram a página.", key: "users", label: "Usuários" },
	{
		info: "Dos usuários da página, quantos iniciaram o checkout no período (em qualquer página).",
		key: "checkout",
		label: "Checkout",
	},
	{
		info: "Compras aprovadas (ou em mediação) no período de quem viu a página. Renovações não entram.",
		key: "purchases",
		label: "Compras",
	},
	{ info: "Valor bruto dessas compras.", key: "revenue", label: "Receita" },
	{ info: "Compradores ÷ usuários da página.", key: "conv", label: "Conversão" },
	{ info: "Compradores ÷ quem iniciou o checkout.", key: "ckconv", label: "Checkout → compra" },
];

async function PagesContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
	const d = await getPages(await searchParams);
	const t = d.totals;
	return (
		<FiltersProvider>
			<div className="flex flex-col gap-4">
				<FiltersBar>
					<SearchFilter placeholder="Buscar URL (ex.: vsl)" />
				</FiltersBar>
				<PendingArea className="flex flex-col gap-4">
					<section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
						<KpiCard
							label="Páginas"
							value={formatInt(t.pages)}
							icon={FileTextIcon}
							info="Páginas diferentes com PageView no período (domínio + caminho, sem UTMs)."
						/>
						<KpiCard
							label="Visualizações"
							value={formatInt(t.views)}
							icon={MousePointerClickIcon}
							tone="cyan"
							info="Total de PageViews no período."
						/>
						<KpiCard
							label="Usuários únicos"
							value={formatInt(t.users)}
							icon={UsersIcon}
							info="Pessoas diferentes que viram alguma página. Cada pessoa conta uma vez aqui."
						/>
						<KpiCard
							label="Compradores"
							value={formatInt(t.buyers)}
							icon={ShoppingBagIcon}
							tone="amber"
							info="Dos usuários únicos, quantos compraram no período (sem renovações)."
						/>
						<KpiCard
							className="col-span-2 lg:col-span-1"
							label="Conversão"
							value={formatPct(ratio(t.buyers, t.users))}
							icon={PercentIcon}
							tone="cyan"
							info="Compradores ÷ usuários únicos."
						/>
					</section>

					<GlassCard>
						<CardHeader>
							<CardTitle className="font-semibold">
								Páginas · {d.period.label}
								{d.period.key !== "custom" && ` (${periodRange(d.period)})`}
							</CardTitle>
							<CardDescription>
								Quem viu mais de uma página conta em todas elas (ex.: a VSL e o cadastro), por
								isso as linhas não somam o total. Ordenado por usuários.
							</CardDescription>
						</CardHeader>
						<CardContent>
							{d.rows.length ? (
								<div className="overflow-x-auto">
									<table className="w-full min-w-[56rem] text-sm">
										<thead>
											<tr className="text-muted-foreground border-b text-left text-xs">
												<th scope="col" className="py-2 pr-3 font-medium">
													Página
												</th>
												{COLUMNS.map(c => (
													<th
														key={c.key}
														scope="col"
														title={c.info}
														className="py-2 pr-3 text-right font-medium whitespace-nowrap last:pr-0"
													>
														{c.label}
													</th>
												))}
											</tr>
										</thead>
										<tbody>
											{d.rows.map(r => (
												<tr key={r.page} className="border-b last:border-0">
													<td className="max-w-[22rem] py-2 pr-3">
														<a
															href={pageHref(r.page)}
															target="_blank"
															rel="noopener noreferrer"
															className="hover:text-primary inline-flex max-w-full items-center gap-1.5 underline-offset-4 hover:underline"
														>
															<span className="truncate">{r.page}</span>
															<ExternalLinkIcon
																className="text-muted-foreground size-3.5 shrink-0"
																aria-hidden
															/>
														</a>
													</td>
													<td className="num py-2 pr-3 text-right">
														{formatInt(r.views)}
													</td>
													<td className="num py-2 pr-3 text-right">
														{formatInt(r.users)}
													</td>
													<td className="num py-2 pr-3 text-right">
														{formatInt(r.checkout)}
													</td>
													<td className="num py-2 pr-3 text-right">
														{formatInt(r.purchases)}
													</td>
													<td className="num py-2 pr-3 text-right">
														{formatMoney(r.revenue, d.currency)}
													</td>
													<td className="num py-2 pr-3 text-right font-medium">
														{formatPct(ratio(r.buyers, r.users))}
													</td>
													<td className="num py-2 text-right">
														{formatPct(ratio(r.buyers, r.checkout))}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							) : (
								<p className="text-muted-foreground py-8 text-center text-sm">
									{d.q
										? "Nenhuma página com essa busca no período."
										: "Nenhuma página no período. Elas aparecem assim que o script do track registrar PageViews."}
								</p>
							)}
						</CardContent>
					</GlassCard>
				</PendingArea>
			</div>
		</FiltersProvider>
	);
}
