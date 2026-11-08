import "server-only";
import { eq, sql } from "drizzle-orm";
import { connection } from "next/server";
import { serviceDb } from "@/db";
import { metaAdAccounts } from "@/db/schema";
import { ACTIVE_SALE, num, param, rows, type SearchParams, withDashboard } from "@/lib/dashboard/context";
import { daysBetween, daysOf, localDate, maxLookback, type Period, withFrom } from "@/lib/dashboard/period";
import { decryptSecret } from "@/lib/secrets";
import {
	buildTree,
	dailySeries,
	effectiveSpend,
	type InsightRow,
	type Metrics,
	type SalePurchase,
	type SpendSummary,
} from "./build";
import { type AdAccount, getInsights, getStructure, type InsightsResult, peekInsights } from "./cache";
import { combineStructures, mergeStructure, type StructuredNode } from "./structure";

/** Contas de anúncio ATIVAS, com token decifrado (só no servidor). */
export async function listAdAccounts(): Promise<AdAccount[]> {
	return serviceDb()
		.select({
			adAccountId: metaAdAccounts.adAccountId,
			label: metaAdAccounts.label,
			token: decryptSecret(metaAdAccounts.adsTokenEnc),
		})
		.from(metaAdAccounts)
		.where(eq(metaAdAccounts.active, true))
		.orderBy(metaAdAccounts.createdAt);
}

export interface CampaignsView {
	period: Period;
	timeZone: string;
	currency: string;
	accounts: { adAccountId: string; label: string }[];
	selected: string | null;
	results: Omit<InsightsResult, "rows" | "firstDay" | "truncated" | "accountTotals">[];
	/**
	 * A Meta tinha mais linhas (anúncio × dia) que o limite: a árvore está incompleta.
	 * incomplete = além disso, os totais da conta não vieram, então o gasto mostrado é menor que o real.
	 */
	detail: { truncated: boolean; incomplete: boolean };
	/** Situação e orçamento: avisos por conta (sem estrutura) e se alguma lista veio cortada. */
	structure: { notices: { adAccountId: string; label: string; notice: string }[]; truncated: boolean };
	tree: StructuredNode[];
	totals: Metrics;
	prevTotals: Metrics | null;
	unattributed: Metrics | null;
	campaignAccount: Record<string, string>;
	daily: { day: string; spend: number; revenue: number }[];
	dailyAvailable: boolean;
	salesWithCampaignUtm: number;
	salesInPeriod: number;
}

async function loadSales(sp: SearchParams) {
	return withDashboard(sp, async ({ tx, tz, period, currency }) => {
		const load = async (start: Date, end: Date) =>
			(
				await rows<Record<string, unknown>>(
					tx,
					sql`
          select id, value, ((coalesce(occurred_at, created_at) at time zone ${tz})::date)::text as day,
                 utm_campaign, utm_term, utm_content
          from purchases
          where status in ${ACTIVE_SALE} and not is_renewal and coalesce(occurred_at, created_at) >= ${start} and coalesce(occurred_at, created_at) < ${end}`,
				)
			).map((r): SalePurchase => ({
				day: String(r.day),
				id: num(r.id),
				utmCampaign: (r.utm_campaign as string) ?? null,
				utmContent: (r.utm_content as string) ?? null,
				utmTerm: (r.utm_term as string) ?? null,
				value: num(r.value),
			}));
		return {
			currency,
			period,
			prevSales: period.compare ? await load(period.prevStart, period.prevEnd) : [],
			sales: await load(period.start, period.end),
			tz,
		};
	});
}

/**
 * Intervalo pedido à Meta. Em "Máximo", sempre desde o limite de 37 meses: o total não muda (não há
 * gasto antes do 1º), a chave do cache fica estável e a mesma consulta descobre o 1º dia com gasto.
 */
export function metaRange(period: Period): { since: string; days: number; max: boolean } {
	if (period.key !== "max") return { days: period.days, max: false, since: period.from };
	const since = maxLookback(period.to);
	return { days: daysBetween(since, period.to) + 1, max: true, since };
}

export interface AdSpend {
	/** Há conta de anúncios ativa cadastrada. */
	configured: boolean;
	/** Gasto de todas as contas ativas; null se nenhuma conta trouxe dados (aviso/erro). */
	spend: number | null;
	/** Gasto do período anterior, SÓ se já estiver em cache (null = sem comparação). */
	prevSpend: number | null;
	notice: string | null;
	/** A Meta cortou o detalhe e os totais da conta não vieram: o gasto está abaixo do real. */
	incomplete: boolean;
}

/** Com o detalhe cortado, gasto/impressões/cliques vêm dos totais da conta (exatos). */
function withSpend(totals: Metrics, s: SpendSummary): Metrics {
	if (!s.truncated) return totals;
	return {
		...totals,
		clicks: s.clicks,
		impressions: s.impressions,
		linkClicks: s.linkClicks,
		spend: s.spend,
	};
}

/**
 * Gasto da Meta para a Visão geral. Mesmos argumentos de getInsights que a aba Campanhas usa:
 * mesma chave de cache e mesmo limite, então uma aba aquece o cache da outra.
 */
export async function getAdSpend(period: Period, timeZone: string): Promise<AdSpend> {
	const accounts = await listAdAccounts();
	if (!accounts.length)
		return { configured: false, incomplete: false, notice: null, prevSpend: null, spend: null };
	// Mesma proteção de getCampaigns contra a pré-renderização.
	await connection();
	const includesToday = period.to >= localDate(new Date(), timeZone);
	const meta = metaRange(period);
	const results = await Promise.all(
		accounts.map(a => getInsights(a, meta.since, period.to, meta.days, includesToday, meta.max)),
	);
	const withData = results.filter(r => r.fetchedAt !== null);
	const notice = results.find(r => r.notice)?.notice ?? null;

	let prevSpend: number | null = null;
	if (period.compare) {
		const prev = await Promise.all(
			accounts.map(a =>
				peekInsights(
					a,
					period.prevFrom,
					period.prevTo,
					daysBetween(period.prevFrom, period.prevTo) + 1,
				),
			),
		);
		if (prev.every(r => r !== null)) prevSpend = effectiveSpend(prev.filter(r => r !== null)).spend;
	}

	const now = effectiveSpend(withData);
	return {
		configured: true,
		incomplete: now.incomplete,
		notice,
		prevSpend,
		spend: withData.length ? now.spend : null,
	};
}

export async function getCampaigns(sp: SearchParams): Promise<CampaignsView> {
	// 1) vendas do período (RLS) — fora desta transação vem a chamada à Meta
	const loaded = await loadSales(sp);
	const { tz, currency, sales, prevSales } = loaded;
	let period = loaded.period;
	const all = await listAdAccounts();
	const wanted = param(sp, "conta");
	const selected = all.length > 1 && wanted && all.some(a => a.adAccountId === wanted) ? wanted : null;
	const accounts = selected ? all.filter(a => a.adAccountId === selected) : all;

	// 2) insights (cache → Meta, dentro do limite).
	// connection(): só segue na requisição REAL. Sem isso, a pré-renderização em tempo de requisição
	// (partialPrefetching) chegava a disparar a chamada à Meta e o Next a abortava.
	await connection();
	const includesToday = period.to >= localDate(new Date(), tz);
	const meta = metaRange(period);
	const results = await Promise.all(
		accounts.map(a => getInsights(a, meta.since, period.to, meta.days, includesToday, meta.max)),
	);
	// "Máximo": se a Meta tem gasto antes do 1º dado do track, o período começa nele.
	// As vendas não mudam: não existem antes do 1º registro do track.
	if (meta.max) {
		const first = results
			.map(r => r.firstDay)
			.filter((d): d is string => !!d && d >= meta.since)
			.sort()[0];
		if (first && first < period.from) period = withFrom(period, first, tz);
	}
	const insightRows: InsightRow[] = results.flatMap(r => r.rows);
	const campaignAccount: Record<string, string> = {};
	for (const r of results) for (const row of r.rows) campaignAccount[row.campaignId] = r.label;

	// 3) árvore + atribuição
	const built = buildTree(insightRows, sales);
	const attributedSales = selected ? sales.filter(s => built.attributions.get(s.id)?.level) : sales;
	const {
		tree,
		totals: treeTotals,
		unattributed,
		attributions,
	} = selected ? buildTree(insightRows, attributedSales) : built;
	// 3b) situação e orçamento (cache próprio por conta; não mexe em números nem na ordem).
	const structures = await Promise.all(accounts.map(a => getStructure(a)));
	structures.forEach((s, i) => {
		for (const id of Object.keys(s.structure?.campaigns ?? {})) campaignAccount[id] ??= accounts[i].label;
	});
	const viewCurrency = results.find(r => r.currency)?.currency ?? currency;
	const structured = mergeStructure(
		tree,
		combineStructures(structures.map(s => s.structure)),
		viewCurrency,
	);

	// Detalhe cortado pela Meta: os totais usam os da conta (a árvore segue com o que veio).
	const spendNow = effectiveSpend(results);
	const totals = withSpend(treeTotals, spendNow);

	// 4) período anterior só se já estiver em cache (sem chamada extra à Meta)
	const prevDays = daysBetween(period.prevFrom, period.prevTo) + 1;
	const prevSources = period.compare
		? await Promise.all(accounts.map(a => peekInsights(a, period.prevFrom, period.prevTo, prevDays)))
		: [];
	const prevComplete = prevSources.filter(r => r !== null);
	const prevTotals =
		period.compare && prevComplete.length === prevSources.length && accounts.length
			? withSpend(
					buildTree(
						prevComplete.flatMap(r => r.rows),
						prevSales,
					).totals,
					effectiveSpend(prevComplete),
				)
			: null;

	const daily = dailySeries(daysOf(period), insightRows, sales, attributions).map(d =>
		spendNow.truncated ? { ...d, spend: spendNow.dailySpend.get(d.day) ?? 0 } : d,
	);

	return {
		accounts: all.map(a => ({ adAccountId: a.adAccountId, label: a.label })),
		campaignAccount,
		currency: viewCurrency,
		daily,
		dailyAvailable: insightRows.some(r => r.date !== null) || spendNow.dailySpend.size > 0,
		detail: { incomplete: spendNow.incomplete, truncated: spendNow.truncated },
		period,
		prevTotals,
		results: results.map(r => ({
			adAccountId: r.adAccountId,
			currency: r.currency,
			fetchedAt: r.fetchedAt,
			label: r.label,
			notice: r.notice,
			stale: r.stale,
			usagePct: r.usagePct,
		})),
		salesInPeriod: sales.length,
		salesWithCampaignUtm: sales.filter(s => s.utmCampaign || s.utmContent || s.utmTerm).length,
		selected,
		structure: {
			notices: structures.flatMap((s, i) =>
				s.notice
					? [{ adAccountId: accounts[i].adAccountId, label: accounts[i].label, notice: s.notice }]
					: [],
			),
			truncated: structures.some(s => s.structure?.truncated),
		},
		timeZone: tz,
		totals,
		tree: structured,
		unattributed: selected ? null : unattributed,
	};
}
