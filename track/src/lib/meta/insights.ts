import "server-only";
import { type InsightRow, metaPurchase } from "@/lib/campaigns/build";
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
	| { ok: true; rows: InsightRow[]; currency: string | null; usage: GraphUsage; calls: number }
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
		if (!next || calls >= MAX_PAGES) return { calls, currency, ok: true, rows, usage: res.usage };
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
