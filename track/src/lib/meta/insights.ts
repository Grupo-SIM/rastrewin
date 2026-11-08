import "server-only";
import { type AccountTotals, type InsightRow, metaPurchase } from "@/lib/campaigns/build";
import type { AdStructure } from "@/lib/campaigns/structure";
import { type GraphError, graphGet, graphGetUrl, type GraphUsage } from "./graph";

/*
 * Insights API (Meta) — nível de ANÚNCIO, uma chamada por conta e período (+ paginação).
 * Datas em YYYY-MM-DD no fuso da conta de anúncios. Atribuição igual à do Gerenciador
 * (use_unified_attribution_setting=true).
 */

const FIELDS = [
	"campaign_id",
	"campaign_name",
	"adset_id",
	"adset_name",
	"ad_id",
	"ad_name",
	"spend",
	"impressions",
	"clicks",
	"inline_link_clicks",
	"actions",
	"action_values",
	"account_currency",
	"date_start",
].join(",");
const MAX_PAGES = 10;

interface RawRow {
	campaign_id: string;
	campaign_name?: string;
	adset_id: string;
	adset_name?: string;
	ad_id: string;
	ad_name?: string;
	spend?: string;
	impressions?: string;
	clicks?: string;
	inline_link_clicks?: string;
	actions?: { action_type: string; value: string }[];
	action_values?: { action_type: string; value: string }[];
	account_currency?: string;
	date_start?: string;
}
interface Page {
	data?: RawRow[];
	paging?: { next?: string };
}

export type InsightsFetch =
	| {
			ok: true;
			rows: InsightRow[];
			currency: string | null;
			usage: GraphUsage;
			calls: number;
			/** Parou no limite de páginas com a Meta ainda indicando mais: o detalhe está incompleto. */
			truncated: boolean;
	  }
	| { ok: false; status: number; error: GraphError; usage: GraphUsage; calls: number };

export async function fetchAdInsights(
	adAccountId: string,
	token: string,
	since: string,
	until: string,
	daily: boolean,
): Promise<InsightsFetch> {
	let res = await graphGet<Page>(`act_${adAccountId}/insights`, token, {
		fields: FIELDS,
		level: "ad",
		limit: "500",
		time_increment: daily ? "1" : "all_days",
		time_range: JSON.stringify({ since, until }),
		use_unified_attribution_setting: "true",
	});
	let calls = 1;
	const rows: InsightRow[] = [];
	let currency: string | null = null;
	for (;;) {
		if (!res.ok) return { calls, error: res.error, ok: false, status: res.status, usage: res.usage };
		for (const r of res.data.data ?? []) {
			currency ??= r.account_currency ?? null;
			rows.push({
				adId: r.ad_id,
				adName: r.ad_name ?? r.ad_id,
				adsetId: r.adset_id,
				adsetName: r.adset_name ?? r.adset_id,
				campaignId: r.campaign_id,
				campaignName: r.campaign_name ?? r.campaign_id,
				clicks: Number(r.clicks ?? 0),
				date: daily ? (r.date_start ?? null) : null,
				impressions: Number(r.impressions ?? 0),
				linkClicks: Number(r.inline_link_clicks ?? 0),
				metaPurchases: metaPurchase(r.actions),
				metaPurchaseValue: metaPurchase(r.action_values),
				spend: Number(r.spend ?? 0),
			});
		}
		const next = res.data.paging?.next;
		if (!next || calls >= MAX_PAGES)
			return { calls, currency, ok: true, rows, truncated: !!next, usage: res.usage };
		res = await graphGetUrl<Page>(next);
		calls++;
	}
}

interface SpendPage {
	data?: { spend?: string; impressions?: string; date_start?: string }[];
}

export type FirstSpendFetch =
	| { ok: true; day: string | null; usage: GraphUsage; calls: number }
	| { ok: false; status: number; error: GraphError; usage: GraphUsage; calls: number };

/** Primeira data (YYYY-MM-DD) com entrega no intervalo, entre as linhas devolvidas pela Meta. */
function firstDay(rows: SpendPage["data"]): string | null {
	let first: string | null = null;
	for (const r of rows ?? []) {
		if (!r.date_start || (Number(r.spend ?? 0) <= 0 && Number(r.impressions ?? 0) <= 0)) continue;
		if (!first || r.date_start < first) first = r.date_start;
	}
	return first;
}

/**
 * Dia do gasto mais antigo da conta no intervalo (período "Máximo"). Duas chamadas pequenas, em
 * nível de conta: uma mensal para achar o 1º mês com entrega e outra diária só dentro desse mês.
 */
export async function fetchFirstSpendDay(
	adAccountId: string,
	token: string,
	since: string,
	until: string,
): Promise<FirstSpendFetch> {
	const query = (from: string, to: string, increment: string) =>
		graphGet<SpendPage>(`act_${adAccountId}/insights`, token, {
			fields: "spend,impressions,date_start",
			level: "account",
			limit: "100",
			time_increment: increment,
			time_range: JSON.stringify({ since: from, until: to }),
		});
	const monthly = await query(since, until, "monthly");
	if (!monthly.ok)
		return { calls: 1, error: monthly.error, ok: false, status: monthly.status, usage: monthly.usage };
	const month = firstDay(monthly.data.data);
	if (!month) return { calls: 1, day: null, ok: true, usage: monthly.usage };

	// fim do mês encontrado (ou o fim do intervalo, se vier antes)
	const [y, m] = month.split("-").map(Number);
	const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
	const daily = await query(month, monthEnd < until ? monthEnd : until, "1");
	if (!daily.ok) return { calls: 2, day: month, ok: true, usage: monthly.usage };
	return { calls: 2, day: firstDay(daily.data.data) ?? month, ok: true, usage: daily.usage };
}

interface TotalsPage {
	data?: {
		spend?: string;
		impressions?: string;
		clicks?: string;
		inline_link_clicks?: string;
		date_start?: string;
	}[];
}

export type AccountTotalsFetch =
	| { ok: true; totals: AccountTotals; usage: GraphUsage; calls: number }
	| { ok: false; status: number; error: GraphError; usage: GraphUsage; calls: number };

/**
 * Totais da CONTA no período (uma chamada pequena: até ~90 linhas diárias, nunca corta).
 * Usado quando o detalhe por anúncio passou do limite de páginas: os totais continuam exatos.
 */
export async function fetchAccountTotals(
	adAccountId: string,
	token: string,
	since: string,
	until: string,
	daily: boolean,
): Promise<AccountTotalsFetch> {
	const res = await graphGet<TotalsPage>(`act_${adAccountId}/insights`, token, {
		fields: "spend,impressions,clicks,inline_link_clicks,date_start",
		level: "account",
		limit: "100",
		time_increment: daily ? "1" : "all_days",
		time_range: JSON.stringify({ since, until }),
	});
	if (!res.ok) return { calls: 1, error: res.error, ok: false, status: res.status, usage: res.usage };
	const totals: AccountTotals = { clicks: 0, daily: [], impressions: 0, linkClicks: 0, spend: 0 };
	for (const r of res.data.data ?? []) {
		const spend = Number(r.spend ?? 0);
		totals.spend += spend;
		totals.impressions += Number(r.impressions ?? 0);
		totals.clicks += Number(r.clicks ?? 0);
		totals.linkClicks += Number(r.inline_link_clicks ?? 0);
		if (daily && r.date_start) totals.daily.push({ date: r.date_start, spend });
	}
	return { calls: 1, ok: true, totals, usage: res.usage };
}

// ---------------------------------------------------------------- estrutura (situação e orçamento)

interface StructurePage<T> {
	data?: T[];
	paging?: { next?: string };
}
interface RawCampaign {
	id: string;
	name?: string;
	effective_status?: string;
	daily_budget?: string;
	lifetime_budget?: string;
	budget_remaining?: string;
	stop_time?: string;
}
interface RawAdset {
	id: string;
	campaign_id?: string;
	effective_status?: string;
	daily_budget?: string;
	lifetime_budget?: string;
	budget_remaining?: string;
	end_time?: string;
}
interface RawAd {
	id: string;
	adset_id?: string;
	effective_status?: string;
}

const STRUCTURE_MAX_PAGES = 5;

export type StructureFetch =
	| { ok: true; structure: AdStructure; usage: GraphUsage; calls: number }
	| { ok: false; status: number; error: GraphError; usage: GraphUsage; calls: number };

const num = (v: string | undefined) => {
	const n = Number(v);
	return v !== undefined && Number.isFinite(n) ? n : null;
};

/** Lista paginada de um nível (campaigns/adsets/ads) da conta; para no limite de páginas. */
async function listLevel<T>(
	adAccountId: string,
	token: string,
	edge: "campaigns" | "adsets" | "ads",
	fields: string,
): Promise<
	| { ok: true; items: T[]; truncated: boolean; usage: GraphUsage; calls: number }
	| { ok: false; status: number; error: GraphError; usage: GraphUsage; calls: number }
> {
	let res = await graphGet<StructurePage<T>>(`act_${adAccountId}/${edge}`, token, {
		fields,
		limit: "500",
	});
	let calls = 1;
	const items: T[] = [];
	for (;;) {
		if (!res.ok) return { calls, error: res.error, ok: false, status: res.status, usage: res.usage };
		items.push(...(res.data.data ?? []));
		const next = res.data.paging?.next;
		if (!next || calls >= STRUCTURE_MAX_PAGES)
			return { calls, items, ok: true, truncated: !!next, usage: res.usage };
		res = await graphGetUrl<StructurePage<T>>(next);
		calls++;
	}
}

/**
 * Situação (effective_status) e orçamento de campanhas, conjuntos e anúncios da conta.
 * Três listas simples (até 5 páginas de 500 cada); não dependem do período. Orçamentos chegam na
 * menor unidade da moeda e são convertidos na tela (src/lib/campaigns/structure.ts).
 */
export async function fetchAdStructure(adAccountId: string, token: string): Promise<StructureFetch> {
	const budget = "effective_status,daily_budget,lifetime_budget,budget_remaining";
	const campaigns = await listLevel<RawCampaign>(
		adAccountId,
		token,
		"campaigns",
		`id,name,${budget},stop_time`,
	);
	if (!campaigns.ok) return campaigns;
	const adsets = await listLevel<RawAdset>(
		adAccountId,
		token,
		"adsets",
		`id,campaign_id,${budget},end_time`,
	);
	if (!adsets.ok) return { ...adsets, calls: campaigns.calls + adsets.calls };
	const ads = await listLevel<RawAd>(adAccountId, token, "ads", "id,adset_id,effective_status");
	const calls = campaigns.calls + adsets.calls + ads.calls;
	if (!ads.ok) return { ...ads, calls };

	const structure: AdStructure = {
		ads: {},
		adsets: {},
		campaigns: {},
		truncated: campaigns.truncated || adsets.truncated || ads.truncated,
	};
	for (const c of campaigns.items)
		structure.campaigns[c.id] = {
			daily: num(c.daily_budget),
			end: c.stop_time ?? null,
			lifetime: num(c.lifetime_budget),
			name: c.name ?? c.id,
			remaining: num(c.budget_remaining),
			status: c.effective_status ?? "",
		};
	for (const s of adsets.items)
		structure.adsets[s.id] = {
			campaignId: s.campaign_id ?? "",
			daily: num(s.daily_budget),
			end: s.end_time ?? null,
			lifetime: num(s.lifetime_budget),
			remaining: num(s.budget_remaining),
			status: s.effective_status ?? "",
		};
	for (const a of ads.items)
		structure.ads[a.id] = { adsetId: a.adset_id ?? "", status: a.effective_status ?? "" };
	return { calls, ok: true, structure, usage: ads.usage };
}
