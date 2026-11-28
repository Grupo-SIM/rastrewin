import { GlassCard } from "@/components/glass-card";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInt, formatMoney } from "@/lib/dashboard/format";
import type { AffiliateStat } from "@/lib/dashboard/revenue";

/**
 * Card "Por afiliado" do Faturamento: vendas novas (aquisição), renovações, receita (tudo o que entrou),
 * comissão e líquido do dono, por código, ordenado por receita. Segue o filtro da página.
 */
export function AffiliatesCard({ rows, currency }: { rows: AffiliateStat[]; currency: string }) {
	// Nome primeiro (código apagado ao lado); sem nome, o código; sem afiliado, "Sem afiliados".
	const label = (r: AffiliateStat) => r.name ?? r.code ?? "Sem afiliados";
	const hasAffiliate = rows.some(r => r.code);

	return (
		<GlassCard>
			<CardHeader>
				<CardTitle className="font-semibold">Por afiliado</CardTitle>
				<CardDescription>
					Receita conta todas as vendas, renovações incluídas; Vendas conta só as novas. Líquido =
					valor líquido (após taxas) menos a comissão.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{!hasAffiliate ? (
					<p className="text-muted-foreground py-6 text-center text-sm">
						Nenhuma venda de afiliado no período.
					</p>
				) : (
					<>
						<div className="hidden overflow-x-auto md:block">
							<table className="w-full text-sm">
								<thead>
									<tr className="text-muted-foreground border-b text-left text-xs">
										<th scope="col" className="py-2 pr-3 font-medium">
											Afiliado
										</th>
										<th scope="col" className="py-2 pr-3 text-right font-medium">
											Vendas
										</th>
										<th scope="col" className="py-2 pr-3 text-right font-medium">
											Renovações
										</th>
										<th scope="col" className="py-2 pr-3 text-right font-medium">
											Receita
										</th>
										<th scope="col" className="py-2 pr-3 text-right font-medium">
											Comissão
										</th>
										<th scope="col" className="py-2 text-right font-medium">
											Líquido
										</th>
									</tr>
								</thead>
								<tbody>
									{rows.map(r => (
										<tr key={r.code ?? "_none"} className="border-b last:border-0">
											<td className="py-2 pr-3">
												<span
													className={
														r.code ? "font-medium" : "text-muted-foreground"
													}
												>
													{label(r)}
												</span>
												{r.name && r.code && (
													<span className="text-muted-foreground ml-1.5 font-mono text-xs">
														{r.code}
													</span>
												)}
											</td>
											<td className="num py-2 pr-3 text-right">{formatInt(r.sales)}</td>
											<td className="num py-2 pr-3 text-right">
												{formatInt(r.renewals)}
											</td>
											<td className="num py-2 pr-3 text-right">
												{formatMoney(r.revenue, currency)}
											</td>
											<td className="num py-2 pr-3 text-right">
												{formatMoney(r.commission, currency)}
											</td>
											<td className="num py-2 text-right font-medium">
												{formatMoney(r.net, currency)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<ul className="flex flex-col gap-2 md:hidden">
							{rows.map(r => (
								<li
									key={r.code ?? "_none"}
									className="bg-card/40 flex flex-col gap-1 rounded-lg border p-3 text-sm"
								>
									<span className="flex items-baseline justify-between gap-3">
										<span
											className={
												r.code ? "truncate font-medium" : "text-muted-foreground"
											}
										>
											{label(r)}
											{r.name && r.code && (
												<span className="text-muted-foreground ml-1.5 font-mono text-xs font-normal">
													{r.code}
												</span>
											)}
										</span>
										<span className="num shrink-0 font-semibold">
											{formatMoney(r.revenue, currency)}
										</span>
									</span>
									<span className="text-muted-foreground num flex flex-wrap gap-x-3 text-xs">
										<span>{formatInt(r.sales)} venda(s)</span>
										<span>{formatInt(r.renewals)} renovação(ões)</span>
										<span>comissão {formatMoney(r.commission, currency)}</span>
										<span>líquido {formatMoney(r.net, currency)}</span>
									</span>
								</li>
							))}
						</ul>
					</>
				)}
			</CardContent>
		</GlassCard>
	);
}
