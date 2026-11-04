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
