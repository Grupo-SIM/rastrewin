import assert from "node:assert/strict";
import { test } from "node:test";
import {
	attributePurchase,
	buildTree,
	cpa,
	dailySeries,
	indexInsights,
	type InsightRow,
	metaPurchase,
	parseUtmId,
	roas,
	type SalePurchase,
	utmName,
} from "./build";

const row = (o: Partial<InsightRow>): InsightRow => ({
	adId: "333333",
	adName: "Anúncio A1x",
	adsetId: "222222",
	adsetName: "Conjunto A1",
	campaignId: "111111",
	campaignName: "Campanha A",
	clicks: 50,
	date: "2026-05-10",
	impressions: 1000,
	linkClicks: 40,
	metaPurchases: 2,
	metaPurchaseValue: 194,
	spend: 100,
	...o,
});
const rows: InsightRow[] = [
	row({}),
	row({ adId: "333334", adName: "Anúncio A1y", date: "2026-05-11", spend: 50 }),
	row({ adId: "333335", adName: "Anúncio A2x", adsetId: "222223", adsetName: "Conjunto A2", spend: 30 }),
	row({
		adId: "666666",
		adName: "Anúncio B1",
		adsetId: "555555",
		adsetName: "Conjunto B1",
		campaignId: "444444",
		campaignName: "Campanha B",
		spend: 200,
	}),
];
const sale = (id: number, value: number, utm: Partial<SalePurchase>): SalePurchase => ({
	day: "2026-05-10",
	id,
	utmCampaign: null,
	utmContent: null,
	utmTerm: null,
	value,
	...utm,
});

test("extrai o ID do fim da UTM (nomes com '|', espaços, sem ID)", () => {
	assert.equal(parseUtmId("Black Friday|120201234567"), "120201234567");
	assert.equal(parseUtmId("A | B | 120201234567 "), "120201234567");
	assert.equal(parseUtmId("Campanha sem id"), null);
	assert.equal(parseUtmId("x|12"), null);
	assert.equal(parseUtmId(null), null);
	assert.equal(utmName("Campanha A|111111"), "campanha a");
	assert.equal(utmName("Campanha A"), "campanha a");
});

test("atribuição: anúncio > conjunto > campanha > nome; sem match = null", () => {
	const idx = indexInsights(rows);
	assert.deepEqual(
		attributePurchase(sale(1, 97, { utmCampaign: "x|444444", utmContent: "Anúncio A1x|333333" }), idx),
		{ adId: "333333", adsetId: "222222", campaignId: "111111", level: "ad" },
	);
	assert.equal(
		attributePurchase(sale(2, 97, { utmContent: "x|999999", utmTerm: "Conjunto A2|222223" }), idx).level,
		"adset",
	);
	assert.equal(
		attributePurchase(sale(3, 97, { utmCampaign: "Campanha B|444444" }), idx).campaignId,
		"444444",
	);
	assert.equal(attributePurchase(sale(4, 97, { utmCampaign: "campanha b" }), idx).campaignId, "444444");
	assert.equal(attributePurchase(sale(5, 97, { utmCampaign: "google" }), idx).level, null);
});

test("árvore: soma de baixo para cima, vendas no nível certo, ordenada por gasto", () => {
	const purchases = [
		sale(1, 100, { utmContent: "a|333333" }), // anúncio A1x
		sale(2, 50, { utmTerm: "c|222223" }), // só conjunto A2
		sale(3, 200, { utmCampaign: "Campanha B|444444" }), // só campanha B
		sale(4, 70, {}), // sem campanha
	];
	const { tree, totals, unattributed } = buildTree(rows, purchases);
	assert.deepEqual(
		tree.map(c => c.name),
		["Campanha B", "Campanha A"],
	); // B gastou 200 > A 180
	const a = tree[1];
	assert.equal(a.spend, 180);
	assert.equal(a.purchases, 2);
	assert.equal(a.revenue, 150);
	const a1 = a.children.find(s => s.id === "222222")!;
	assert.equal(a1.children.length, 2);
	assert.equal(a1.revenue, 100);
	const a2 = a.children.find(s => s.id === "222223")!;
	assert.equal(a2.revenue, 50); // venda só no conjunto
	assert.equal(a2.children[0].revenue, 0);
	assert.equal(tree[0].revenue, 200);
	assert.equal(totals.spend, 380);
	assert.equal(totals.revenue, 350);
	assert.deepEqual([unattributed.purchases, unattributed.revenue], [1, 70]);
});

test("ROAS e CPA lidam com zero", () => {
	assert.equal(roas({ revenue: 300, spend: 100 }), 3);
	assert.equal(roas({ revenue: 300, spend: 0 }), null);
	assert.equal(cpa({ purchases: 4, spend: 100 }), 25);
	assert.equal(cpa({ purchases: 0, spend: 100 }), null);
});

test("série diária e compras reportadas pela Meta", () => {
	const purchases = [
		sale(1, 100, { day: "2026-05-11", utmContent: "a|333333" }),
		sale(2, 30, { day: "2026-05-11" }),
	];
	const { attributions } = buildTree(rows, purchases);
	const s = dailySeries(["2026-05-10", "2026-05-11", "2026-05-12"], rows, purchases, attributions);
	assert.deepEqual(s, [
		{ day: "2026-05-10", revenue: 0, spend: 330 },
		{ day: "2026-05-11", revenue: 100, spend: 50 },
		{ day: "2026-05-12", revenue: 0, spend: 0 },
	]);
	assert.equal(
		metaPurchase([
			{ action_type: "link_click", value: "9" },
			{ action_type: "omni_purchase", value: "3" },
			{ action_type: "purchase", value: "3" },
		]),
		3,
	);
	assert.equal(metaPurchase(undefined), 0);
});
