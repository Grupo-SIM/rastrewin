import {
	CheckCheckIcon,
	ClockIcon,
	MousePointerClickIcon,
	PercentIcon,
	PlayIcon,
	ShoppingBagIcon,
	UsersIcon,
	VideoIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ChartCard } from "@/components/charts/chart-card";
import { RankedBars } from "@/components/charts/ranked-bars";
import { RetentionChart } from "@/components/charts/retention-chart";
import { FiltersBar, FiltersProvider, PendingArea, SelectFilter } from "@/components/dashboard/filters";
import { EmptyState } from "@/components/empty-state";
import { GlassCard } from "@/components/glass-card";
import { KpiCard } from "@/components/kpi-card";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SearchParams } from "@/lib/dashboard/context";
import { formatInt, formatPct, ratio } from "@/lib/dashboard/format";
import { periodRange } from "@/lib/dashboard/period";
import { formatClock } from "@/lib/dashboard/video-stats";
import { getVideos } from "@/lib/dashboard/videos";

export const metadata: Metadata = { title: "Vídeos" };

export default function VideosPage({ searchParams }: PageProps<"/painel/videos">) {
	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Vídeos"
				description="Retenção do vídeo: até onde as pessoas assistem, quanto tempo e quantas chegam ao botão."
			/>
			<Suspense fallback={<PageSkeleton />}>
				<VideosContent searchParams={searchParams} />
			</Suspense>
		</div>
	);
}

const label = (v: { title: string | null; videoId: string }) => v.title || v.videoId;

async function VideosContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
	const d = await getVideos(await searchParams);
	const v = d.selected;
	const range = d.period.key !== "custom" ? ` (${periodRange(d.period)})` : "";

	return (
		<FiltersProvider>
			<div className="flex flex-col gap-4">
				<FiltersBar>
					{d.videos.length > 1 && (
						<SelectFilter
							name="video"
							label="Vídeo"
							allLabel={`${label(d.videos[0])} (mais plays)`}
							width="w-[16rem]"
							options={d.videos.slice(1).map(x => ({ label: label(x), value: x.videoId }))}
						/>
					)}
				</FiltersBar>
				<PendingArea className="flex flex-col gap-4">
					{!v ? (
						<EmptyState
							icon={VideoIcon}
							title="Nenhum play no período"
							description="Os plays aparecem aqui quando o vídeo da VSL for assistido com o script do track atualizado."
						/>
					) : (
						<>
							<section
								aria-label="Indicadores"
								className="grid grid-cols-2 gap-3 lg:grid-cols-4"
							>
								<KpiCard
									label="Plays"
									value={formatInt(v.plays)}
									icon={PlayIcon}
									info="Vezes que o vídeo começou a tocar no período (cada carregamento da página conta uma vez)."
								/>
								<KpiCard
									label="Taxa de play"
									value={formatPct(ratio(v.plays, v.pageViews))}
									icon={MousePointerClickIcon}
									tone="cyan"
									info={`Plays ÷ visualizações da página do vídeo (${formatInt(v.pageViews)} no período).`}
								/>
								<KpiCard
									label="% médio assistido"
									value={formatPct(v.avgPct)}
									icon={PercentIcon}
									info="Em média, até que ponto do vídeo cada play chegou."
								/>
								<KpiCard
									label="Tempo médio assistido"
									value={formatClock(v.avgWatchedS)}
									icon={ClockIcon}
									tone="amber"
									info={`Tempo realmente assistido por play (pulos e repetições não contam). Duração: ${formatClock(v.durationS)}.`}
								/>
								<KpiCard
									label="Pessoas"
									value={formatInt(v.people)}
									icon={UsersIcon}
									info="Pessoas diferentes (trck_user_id) que deram play."
								/>
								<KpiCard
									label="Chegaram ao botão"
									value={v.ctaS === null ? "—" : formatPct(ratio(v.reachedCta, v.plays))}
									icon={MousePointerClickIcon}
									tone="cyan"
									info={
										v.ctaS === null
											? "O site ainda não informou quando libera o botão."
											: `Plays que passaram de ${formatClock(v.ctaS)}, quando a VSL libera o botão (${formatInt(v.reachedCta)}).`
									}
								/>
								<KpiCard
									label="Assistiram até o fim"
									value={formatPct(ratio(v.completed, v.plays))}
									icon={CheckCheckIcon}
									info={`Plays que chegaram ao último segundo (${formatInt(v.completed)}).`}
								/>
								<KpiCard
									label="Compraram"
									value={formatInt(v.buyers)}
									icon={ShoppingBagIcon}
									tone="amber"
									info={`Pessoas que deram play e compraram no período (${formatPct(ratio(v.buyers, v.people))} delas). Renovações não entram.`}
								/>
							</section>

							<div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
								<ChartCard
									title={`Retenção · ${label(v)}`}
									description={`% dos plays que ainda assistiam em cada ponto do vídeo · ${d.period.label}${range}.`}
									table={{
										columns: [
											{ key: "p", label: "Ponto do vídeo" },
											{ align: "right", key: "t", label: "Tempo" },
											{ align: "right", key: "s", label: "Ainda assistindo" },
											{ align: "right", key: "n", label: "Plays" },
										],
										rows: v.curve.map(c => ({
											n: formatInt(c.plays),
											p: `${c.pct}%`,
											s: formatPct(c.share),
											t: v.durationS ? formatClock((c.pct / 100) * v.durationS) : "—",
										})),
									}}
								>
									<RetentionChart data={v.curve} durationS={v.durationS} ctaS={v.ctaS} />
								</ChartCard>

								<ChartCard
									title="Onde as pessoas pararam"
									description="Plays por faixa do vídeo em que pararam de assistir."
									table={{
										columns: [
											{ key: "f", label: "Parou em" },
											{ align: "right", key: "n", label: "Plays" },
										],
										rows: v.bands.map(b => ({ f: b.label, n: formatInt(b.value) })),
									}}
								>
									<RankedBars items={v.bands} color="var(--viz-1)" />
								</ChartCard>
							</div>

							<GlassCard>
								<CardHeader>
									<CardTitle className="font-semibold">
										Vídeos · {d.period.label}
										{range}
									</CardTitle>
									<CardDescription>Todos os vídeos com play no período.</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="overflow-x-auto">
										<table className="w-full min-w-[44rem] text-sm">
											<thead>
												<tr className="text-muted-foreground border-b text-left text-xs">
													<th scope="col" className="py-2 pr-3 font-medium">
														Vídeo
													</th>
													<th scope="col" className="py-2 pr-3 font-medium">
														Página
													</th>
													<th
														scope="col"
														className="py-2 pr-3 text-right font-medium"
													>
														Plays
													</th>
													<th
														scope="col"
														className="py-2 pr-3 text-right font-medium"
													>
														Duração
													</th>
													<th
														scope="col"
														className="py-2 pr-3 text-right font-medium"
													>
														% médio
													</th>
													<th scope="col" className="py-2 text-right font-medium">
														Tempo médio
													</th>
												</tr>
											</thead>
											<tbody>
												{d.videos.map(x => (
													<tr key={x.videoId} className="border-b last:border-0">
														<td className="py-2 pr-3">
															<div className="font-medium">{label(x)}</div>
															{x.title && (
																<div className="text-muted-foreground text-xs">
																	{x.videoId}
																</div>
															)}
														</td>
														<td className="text-muted-foreground max-w-[16rem] truncate py-2 pr-3">
															{x.pages.join(", ") || "—"}
														</td>
														<td className="num py-2 pr-3 text-right">
															{formatInt(x.plays)}
														</td>
														<td className="num py-2 pr-3 text-right">
															{formatClock(x.durationS)}
														</td>
														<td className="num py-2 pr-3 text-right">
															{formatPct(x.avgPct)}
														</td>
														<td className="num py-2 text-right">
															{formatClock(x.avgWatchedS)}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</CardContent>
							</GlassCard>
						</>
					)}
				</PendingArea>
			</div>
		</FiltersProvider>
	);
}
