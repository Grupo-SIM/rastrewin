/*
 * Campanhas: atribuição de vendas por UTM e árvore campanha → conjunto → anúncio.
 * Funções PURAS (testadas). Convenção de UTM nos anúncios:
 *   utm_campaign={{campaign.name}}|{{campaign.id}}  utm_term={{adset.name}}|{{adset.id}}  utm_content={{ad.name}}|{{ad.id}}
 */

/** Linha normalizada da Insights API (nível de anúncio; `date` existe quando é diário). */
export interface InsightRow {
	date: string | null;
	campaignId: string;
	campaignName: string;
	adsetId: string;
	adsetName: string;
	adId: string;
	adName: string;
	spend: number;
	impressions: number;
	clicks: number;
	linkClicks: number;
	metaPurchases: number;
	metaPurchaseValue: number;
}

export interface SalePurchase {
	id: number;
	value: number;
	day: string;
	utmCampaign: string | null;
	utmTerm: string | null;
	utmContent: string | null;
}

export interface Attribution {
	level: "ad" | "adset" | "campaign" | null;
	campaignId?: string;
	adsetId?: string;
	adId?: string;
}

/** "Nome qualquer|120201234567" → "120201234567". Só aceita ID numérico no FIM (após o último "|"). */
export function parseUtmId(value: string | null | undefined): string | null {
	if (!value) return null;
	const last = value.split("|").at(-1)?.trim() ?? "";
	return /^\d{6,25}$/.test(last) ? last : null;
}

/** Nome sem o "|id" do fim, normalizado para comparação. */
export function utmName(value: string | null | undefined): string | null {
	if (!value) return null;
	const parts = value.split("|");
	const name = (parseUtmId(value) ? parts.slice(0, -1).join("|") : value).trim().toLowerCase();
	return name || null;
}

interface AdsIndex {
	ads: Map<string, { adsetId: string; campaignId: string }>;
	adsets: Map<string, string>;
	campaigns: Set<string>;
	campaignByName: Map<string, string>;
}

export function indexInsights(rows: InsightRow[]): AdsIndex {
	const idx: AdsIndex = {
		ads: new Map(),
		adsets: new Map(),
		campaignByName: new Map(),
		campaigns: new Set(),
	};
	for (const r of rows) {
		idx.ads.set(r.adId, { adsetId: r.adsetId, campaignId: r.campaignId });
		idx.adsets.set(r.adsetId, r.campaignId);
		idx.campaigns.add(r.campaignId);
		idx.campaignByName.set(r.campaignName.trim().toLowerCase(), r.campaignId);
	}
	return idx;
}

/** Liga a venda à campanha: ID do anúncio > ID do conjunto > ID da campanha > nome da campanha. */
export function attributePurchase(p: SalePurchase, idx: AdsIndex): Attribution {
	const adId = parseUtmId(p.utmContent);
	const ad = adId ? idx.ads.get(adId) : undefined;
	if (adId && ad) return { adId, adsetId: ad.adsetId, campaignId: ad.campaignId, level: "ad" };
	const adsetId = parseUtmId(p.utmTerm);
	const adsetCampaign = adsetId ? idx.adsets.get(adsetId) : undefined;
	if (adsetId && adsetCampaign) return { adsetId, campaignId: adsetCampaign, level: "adset" };
	const campaignId = parseUtmId(p.utmCampaign);
	if (campaignId && idx.campaigns.has(campaignId)) return { campaignId, level: "campaign" };
	const byName = utmName(p.utmCampaign);
	const nameCampaign = byName ? idx.campaignByName.get(byName) : undefined;
	if (nameCampaign) return { campaignId: nameCampaign, level: "campaign" };
	return { level: null };
}

export interface Metrics {
	spend: number;
	impressions: number;
	clicks: number;
	linkClicks: number;
	purchases: number;
	revenue: number;
	metaPurchases: number;
	metaPurchaseValue: number;
}

export type TreeNode = Metrics & {
	id: string;
	name: string;
	level: "campaign" | "adset" | "ad";
	children: TreeNode[];
};

const METRIC_KEYS = [
	"spend",
	"impressions",
	"clicks",
	"linkClicks",
	"purchases",
	"revenue",
	"metaPurchases",
	"metaPurchaseValue",
] as const;
const zero = (): Metrics => ({
	clicks: 0,
	impressions: 0,
	linkClicks: 0,
	metaPurchases: 0,
	metaPurchaseValue: 0,
	purchases: 0,
	revenue: 0,
	spend: 0,
});
/** Soma SÓ os campos numéricos (um TreeNode também tem id/name/children). */
const addInto = (target: Metrics, src: Metrics) => {
	for (const k of METRIC_KEYS) target[k] += src[k];
};

export function roas(m: Pick<Metrics, "revenue" | "spend">): number | null {
	return m.spend > 0 ? m.revenue / m.spend : null;
}
export function cpa(m: Pick<Metrics, "purchases" | "spend">): number | null {
	return m.purchases > 0 ? m.spend / m.purchases : null;
}
export function ctr(m: Pick<Metrics, "clicks" | "impressions">): number | null {
	return m.impressions > 0 ? m.clicks / m.impressions : null;
}

/**
 * Árvore campanha → conjunto → anúncio, ordenada por gasto.
 * Vendas ligadas só ao conjunto/campanha contam no nível delas (e acima), não num anúncio específico.
 */
export function buildTree(rows: InsightRow[], purchases: SalePurchase[]) {
	const idx = indexInsights(rows);
	const campaigns = new Map<string, TreeNode>();
	const adsets = new Map<string, TreeNode>();
	const ads = new Map<string, TreeNode>();
	const node = (map: Map<string, TreeNode>, id: string, name: string, level: TreeNode["level"]) => {
		let n = map.get(id);
		if (!n) map.set(id, (n = { children: [], id, level, name, ...zero() }));
		return n;
	};

	for (const r of rows) {
		const ad = node(ads, r.adId, r.adName, "ad");
		node(adsets, r.adsetId, r.adsetName, "adset");
		node(campaigns, r.campaignId, r.campaignName, "campaign");
		addInto(ad, {
			...zero(),
			clicks: r.clicks,
			impressions: r.impressions,
			linkClicks: r.linkClicks,
			metaPurchases: r.metaPurchases,
			metaPurchaseValue: r.metaPurchaseValue,
			spend: r.spend,
		});
	}

	// vendas atribuídas: contadas no nível mais específico; os pais somam depois
	const direct = { adset: new Map<string, Metrics>(), campaign: new Map<string, Metrics>() };
	const unattributed = zero();
	const attributions = new Map<number, Attribution>();
	for (const p of purchases) {
		const a = attributePurchase(p, idx);
		attributions.set(p.id, a);
		const sale = { ...zero(), purchases: 1, revenue: p.value };
		if (a.level === "ad") addInto(ads.get(a.adId!)!, sale);
		else if (a.level === "adset")
			addInto(
				direct.adset.get(a.adsetId!) ?? direct.adset.set(a.adsetId!, zero()).get(a.adsetId!)!,
				sale,
			);
		else if (a.level === "campaign")
			addInto(
				direct.campaign.get(a.campaignId!) ??
					direct.campaign.set(a.campaignId!, zero()).get(a.campaignId!)!,
				sale,
			);
		else addInto(unattributed, sale);
	}

	// monta a hierarquia e soma de baixo para cima
	for (const [adId, ad] of ads) {
		const { adsetId, campaignId } = idx.ads.get(adId)!;
		adsets.get(adsetId)!.children.push(ad);
		const campaign = campaigns.get(campaignId)!;
		if (!campaign.children.includes(adsets.get(adsetId)!)) campaign.children.push(adsets.get(adsetId)!);
	}
	for (const adset of adsets.values()) {
		for (const ad of adset.children) addInto(adset, ad);
		const extra = direct.adset.get(adset.id);
		if (extra) addInto(adset, extra);
	}
	for (const campaign of campaigns.values()) {
		for (const adset of campaign.children) addInto(campaign, adset);
		const extra = direct.campaign.get(campaign.id);
		if (extra) addInto(campaign, extra);
	}
	const sortBySpend = (list: TreeNode[]) => {
		list.sort((a, b) => b.spend - a.spend || b.revenue - a.revenue);
		list.forEach(n => sortBySpend(n.children));
		return list;
	};
	const tree = sortBySpend([...campaigns.values()]);
	const totals = zero();
	tree.forEach(c => addInto(totals, c));
	return { attributions, totals, tree, unattributed };
}

/** Totais da CONTA na Meta (nível account): pequenos, nunca cortados pelo limite de páginas. */
export interface AccountTotals {
	spend: number;
	impressions: number;
	clicks: number;
	linkClicks: number;
	/** Gasto por dia (só em períodos diários, até 90 dias). */
	daily: { date: string; spend: number }[];
}

/** Insights de UMA conta como vieram do cache. */
export interface SpendSource {
	rows: InsightRow[];
	truncated?: boolean;
	accountTotals?: AccountTotals | null;
}

export interface SpendSummary {
	spend: number;
	impressions: number;
	clicks: number;
	linkClicks: number;
	/** Gasto por dia (YYYY-MM-DD → valor), somando as contas. */
	dailySpend: Map<string, number>;
	/** Alguma conta veio com o detalhe por anúncio cortado. */
	truncated: boolean;
	/** Cortada E sem os totais da conta: o gasto mostrado é menor que o real. */
	incomplete: boolean;
}

/**
 * Gasto efetivo das contas: soma das linhas por anúncio ou, quando a Meta cortou o detalhe,
 * os totais da própria conta (sempre exatos). Nunca mistura as duas fontes numa mesma conta.
 */
export function effectiveSpend(sources: SpendSource[]): SpendSummary {
	const out: SpendSummary = {
		clicks: 0,
		dailySpend: new Map(),
		impressions: 0,
		incomplete: false,
		linkClicks: 0,
		spend: 0,
		truncated: false,
	};
	const addDay = (date: string, spend: number) =>
		out.dailySpend.set(date, (out.dailySpend.get(date) ?? 0) + spend);
	for (const src of sources) {
		if (src.truncated) out.truncated = true;
		const totals = src.truncated ? src.accountTotals : null;
		if (totals) {
			out.spend += totals.spend;
			out.impressions += totals.impressions;
			out.clicks += totals.clicks;
			out.linkClicks += totals.linkClicks;
			for (const d of totals.daily) addDay(d.date, d.spend);
			continue;
		}
		if (src.truncated) out.incomplete = true;
		for (const r of src.rows) {
			out.spend += r.spend;
			out.impressions += r.impressions;
			out.clicks += r.clicks;
			out.linkClicks += r.linkClicks;
			if (r.date) addDay(r.date, r.spend);
		}
	}
	out.spend = round2(out.spend);
	for (const [k, v] of out.dailySpend) out.dailySpend.set(k, round2(v));
	return out;
}

/** Série diária de gasto (Meta) e receita atribuída, preenchendo dias vazios. */
export function dailySeries(
	days: string[],
	rows: InsightRow[],
	purchases: SalePurchase[],
	attributions: Map<number, Attribution>,
) {
	const spend = new Map<string, number>();
	for (const r of rows) if (r.date) spend.set(r.date, (spend.get(r.date) ?? 0) + r.spend);
	const revenue = new Map<string, number>();
	for (const p of purchases)
		if (attributions.get(p.id)?.level) revenue.set(p.day, (revenue.get(p.day) ?? 0) + p.value);
	return days.map(day => ({
		day,
		revenue: round2(revenue.get(day) ?? 0),
		spend: round2(spend.get(day) ?? 0),
	}));
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Compras e valor reportados pela própria Meta (sem somar tipos sobrepostos). */
const PURCHASE_TYPES = ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"];
export function metaPurchase(list: { action_type: string; value: string }[] | undefined): number {
	if (!list) return 0;
	for (const t of PURCHASE_TYPES) {
		const hit = list.find(a => a.action_type === t);
		if (hit) return Number(hit.value) || 0;
	}
	return 0;
}
