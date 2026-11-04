import "server-only";
import { metaPurchase, type InsightRow } from "@/lib/campaigns/build";
import { graphGet, graphGetUrl, type GraphError, type GraphUsage } from "./graph";

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

type RawRow = {
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
};
type Page = { data?: RawRow[]; paging?: { next?: string } };

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
    level: "ad",
    fields: FIELDS,
    time_range: JSON.stringify({ since, until }),
    time_increment: daily ? "1" : "all_days",
    use_unified_attribution_setting: "true",
    limit: "500",
  });
  let calls = 1;
  const rows: InsightRow[] = [];
  let currency: string | null = null;
  for (;;) {
    if (!res.ok) return { ok: false, status: res.status, error: res.error, usage: res.usage, calls };
    for (const r of res.data.data ?? []) {
      currency ??= r.account_currency ?? null;
      rows.push({
        date: daily ? (r.date_start ?? null) : null,
        campaignId: r.campaign_id,
        campaignName: r.campaign_name ?? r.campaign_id,
        adsetId: r.adset_id,
        adsetName: r.adset_name ?? r.adset_id,
        adId: r.ad_id,
        adName: r.ad_name ?? r.ad_id,
        spend: Number(r.spend ?? 0),
        impressions: Number(r.impressions ?? 0),
        clicks: Number(r.clicks ?? 0),
        linkClicks: Number(r.inline_link_clicks ?? 0),
        metaPurchases: metaPurchase(r.actions),
        metaPurchaseValue: metaPurchase(r.action_values),
      });
    }
    const next = res.data.paging?.next;
    if (!next || calls >= MAX_PAGES) return { ok: true, rows, currency, usage: res.usage, calls };
    res = await graphGetUrl<Page>(next);
    calls++;
  }
}
