import assert from "node:assert/strict";
import { test } from "node:test";
import type { TreeNode } from "./build";
import {
	type AdStructure,
	budgetOf,
	combineStructures,
	fromMinor,
	mergeStructure,
	splitArchived,
	statusOf,
	type StructureItem,
	sumMetrics,
} from "./structure";

const NOW = new Date("2026-11-08T12:00:00Z");
const nbsp = (s: string | null | undefined) => s?.replace(/\s/g, " ");

const node = (o: Partial<TreeNode> & Pick<TreeNode, "id" | "level">): TreeNode => ({
	children: [],
	clicks: 0,
	impressions: 0,
	linkClicks: 0,
	metaPurchases: 0,
	metaPurchaseValue: 0,
	name: o.id,
	purchases: 0,
	revenue: 0,
	spend: 0,
	...o,
});

const item = (o: Partial<StructureItem> = {}): StructureItem => ({
	daily: null,
	end: null,
	lifetime: null,
	remaining: null,
	status: "ACTIVE",
	...o,
});

test("statusOf: situações da Meta viram selos do painel", () => {
	const cases: [string, string, string][] = [
		["ACTIVE", "Ativa", "good"],
		["PAUSED", "Pausada", "muted"],
		["CAMPAIGN_PAUSED", "Pausada", "muted"],
		["ADSET_PAUSED", "Pausada", "muted"],
		["IN_PROCESS", "Em análise", "muted"],
		["PENDING_REVIEW", "Em análise", "muted"],
		["PREAPPROVED", "Em análise", "muted"],
		["DISAPPROVED", "Reprovada", "critical"],
		["WITH_ISSUES", "Com problema", "warning"],
		["PENDING_BILLING_INFO", "Pagamento pendente", "warning"],
		["ARCHIVED", "Arquivada", "muted"],
		["DELETED", "Arquivada", "muted"],
	];
	for (const [meta, label, tone] of cases) {
		const s = statusOf(meta, null, NOW);
		assert.equal(s.label, label, meta);
		assert.equal(s.tone, tone, meta);
	}
});

test("statusOf: data de fim passada vence a situação; fim futuro não muda nada", () => {
	assert.equal(statusOf("ACTIVE", "2026-11-01T00:00:00-0300", NOW).label, "Concluída");
	assert.equal(statusOf("PAUSED", "2026-11-01T00:00:00Z", NOW).key, "concluida");
	assert.equal(statusOf("ACTIVE", "2026-12-01T00:00:00Z", NOW).label, "Ativa");
	assert.equal(statusOf("ACTIVE", "data inválida", NOW).label, "Ativa");
});

test("statusOf: arquivada vence a data de fim (campanha encerrada e depois arquivada)", () => {
	assert.equal(statusOf("ARCHIVED", "2025-04-30T23:59:59-0300", NOW).label, "Arquivada");
	assert.equal(statusOf("DELETED", "2025-04-30T23:59:59-0300", NOW).key, "arquivada");
	assert.equal(statusOf("ARCHIVED", null, NOW).label, "Arquivada");
});

test("statusOf: situação desconhecida aparece legível e neutra", () => {
	const s = statusOf("SOME_NEW_STATUS", null, NOW);
	assert.equal(s.key, "outra");
	assert.equal(s.label, "some new status");
	assert.equal(s.tone, "muted");
});

test("fromMinor: centavos no real; moedas sem centavos na Meta ficam como vieram", () => {
	assert.equal(fromMinor(5000, "BRL"), 50);
	assert.equal(fromMinor(5000, "usd"), 50);
	assert.equal(fromMinor(5000, "JPY"), 5000);
	assert.equal(fromMinor(5000, "COP"), 5000);
});

test("budgetOf: diário, total com saldo, e nada quando o orçamento está em outro nível", () => {
	assert.equal(nbsp(budgetOf(item({ daily: 5000 }), "BRL")), "R$ 50,00/dia");
	assert.equal(
		nbsp(budgetOf(item({ lifetime: 50000, remaining: 12000 }), "BRL")),
		"R$ 500,00 no total · restam R$ 120,00",
	);
	assert.equal(nbsp(budgetOf(item({ lifetime: 50000 }), "BRL")), "R$ 500,00 no total");
	assert.equal(budgetOf(item({ daily: 0, lifetime: 0 }), "BRL"), null);
	assert.equal(budgetOf(item(), "BRL"), null);
	assert.match(nbsp(budgetOf(item({ daily: 5000 }), "JPY")) ?? "", /5\.000\/dia$/);
});

const structure: AdStructure = {
	ads: { ad1: { adsetId: "as1", status: "DISAPPROVED" } },
	adsets: {
		as1: { ...item({ daily: 2000, status: "ACTIVE" }), campaignId: "c1" },
	},
	campaigns: {
		c1: { ...item({ status: "ACTIVE" }), name: "Com gasto" },
		c2: { ...item({ daily: 10000, status: "ACTIVE" }), name: "Zeta parada" },
		c3: { ...item({ status: "PAUSED" }), name: "Pausada sem gasto" },
		c4: { ...item({ end: "2026-10-01T00:00:00Z", status: "ACTIVE" }), name: "Terminou" },
		c5: { ...item({ lifetime: 30000, remaining: 1000, status: "ACTIVE" }), name: "Alfa parada" },
	},
	truncated: false,
};

test("mergeStructure: selo e orçamento em cada nível, sem mudar números nem ordem", () => {
	const tree = [
		node({
			children: [
				node({
					children: [
						node({ id: "ad1", level: "ad", spend: 40 }),
						node({ id: "adX", level: "ad", spend: 2 }),
					],
					id: "as1",
					level: "adset",
					spend: 42,
				}),
			],
			id: "c1",
			level: "campaign",
			spend: 42,
		}),
		node({ id: "cOld", level: "campaign", spend: 5 }),
	];
	const out = mergeStructure(tree, structure, "BRL", NOW);
	const [c1, cOld] = out;
	assert.equal(c1.id, "c1");
	assert.equal(c1.spend, 42);
	assert.equal(c1.status?.label, "Ativa");
	assert.equal(c1.budget, null, "CBO desligado: orçamento fica no conjunto");
	const as1 = c1.children[0];
	assert.equal(nbsp(as1.budget), "R$ 20,00/dia");
	assert.equal(as1.children[0].status?.label, "Reprovada");
	assert.equal(as1.children[0].budget, null);
	assert.equal(as1.children[1].status, undefined, "anúncio fora da estrutura: sem selo");
	assert.equal(cOld.status, undefined, "campanha fora da estrutura: sem selo");
	assert.equal(cOld.spend, 5);
});

test("mergeStructure: campanhas ativas sem gasto entram no fim, em ordem de nome; pausadas e concluídas não", () => {
	const out = mergeStructure([node({ id: "c1", level: "campaign", spend: 42 })], structure, "BRL", NOW);
	assert.deepEqual(
		out.map(n => n.id),
		["c1", "c5", "c2"],
	);
	const [, alfa, zeta] = out;
	assert.equal(alfa.idle, true);
	assert.equal(alfa.spend, 0);
	assert.equal(alfa.name, "Alfa parada");
	assert.equal(nbsp(alfa.budget), "R$ 300,00 no total · restam R$ 10,00");
	assert.equal(nbsp(zeta.budget), "R$ 100,00/dia");
	assert.equal(out[0].idle, undefined);
});

test("mergeStructure: sem estrutura, a árvore volta igual", () => {
	const tree = [node({ id: "c1", level: "campaign", spend: 1 })];
	assert.equal(mergeStructure(tree, null, "BRL", NOW), tree);
});

test("combineStructures: junta contas e propaga o corte", () => {
	assert.equal(combineStructures([null, null]), null);
	const other: AdStructure = {
		ads: {},
		adsets: {},
		campaigns: { k1: { ...item(), name: "Outra conta" } },
		truncated: true,
	};
	const all = combineStructures([structure, null, other]);
	assert.ok(all);
	assert.equal(Object.keys(all.campaigns).length, 6);
	assert.equal(all.truncated, true);
});

test("splitArchived: arquivadas e excluídas (fora da lista completa) vão para o grupo; o resto fica", () => {
	const s: AdStructure = {
		...structure,
		campaigns: {
			...structure.campaigns,
			cArq: {
				...item({
					end: "2025-04-30T23:59:59-0300",
					lifetime: 2000,
					remaining: 0,
					status: "ARCHIVED",
				}),
				name: "Arquivada",
			},
		},
	};
	const nodes = mergeStructure(
		[
			node({ id: "c1", level: "campaign", spend: 42 }),
			node({ id: "cArq", level: "campaign", spend: 10 }),
			node({ id: "cDel", level: "campaign", spend: 20 }),
			node({ id: "cOutra", level: "campaign", spend: 5 }),
		],
		s,
		"BRL",
		NOW,
	);
	const complete = new Set(["c1", "cArq", "cDel"]);
	const { current, archived } = splitArchived(nodes, id => complete.has(id));
	assert.deepEqual(
		current.map(n => n.id),
		["c1", "cOutra", "c5", "c2"],
		"sem lista completa da conta, a campanha fica; ociosas ficam",
	);
	assert.deepEqual(
		archived.map(n => n.id),
		["cArq", "cDel"],
	);
	assert.equal(archived[0].status?.label, "Arquivada");
	assert.equal(archived[1].status, undefined, "excluída: sem selo");
	const sum = sumMetrics(archived);
	assert.equal(sum.spend, 30);
	assert.equal(sum.clicks, 0);
});

test("splitArchived: sem estrutura nenhuma, nada vai para o grupo", () => {
	const tree = [node({ id: "c1", level: "campaign", spend: 1 })];
	const { current, archived } = splitArchived(mergeStructure(tree, null, "BRL", NOW), () => false);
	assert.equal(current.length, 1);
	assert.equal(archived.length, 0);
});
