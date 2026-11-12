/*
 * Situação e orçamento de campanhas, conjuntos e anúncios (estrutura da conta na Meta).
 * Funções PURAS (testadas). A busca fica em src/lib/meta/insights.ts (fetchAdStructure) e o cache
 * em cache.ts (chave "<conta>:estrutura"); aqui só se interpreta o que veio.
 */
import { formatMoney } from "@/lib/dashboard/format";
import type { Metrics, TreeNode } from "./build";

/** Orçamento e situação como a Meta devolve (orçamento na menor unidade da moeda; 0 = não definido). */
export interface StructureItem {
	status: string;
	/** stop_time da campanha / end_time do conjunto (ISO), se houver. */
	end: string | null;
	daily: number | null;
	lifetime: number | null;
	remaining: number | null;
}
export interface CampaignItem extends StructureItem {
	name: string;
}
export interface AdsetItem extends StructureItem {
	campaignId: string;
}
export interface AdItem {
	status: string;
	adsetId: string;
}
export interface AdStructure {
	campaigns: Record<string, CampaignItem>;
	adsets: Record<string, AdsetItem>;
	ads: Record<string, AdItem>;
	/** Alguma lista passou do limite de páginas: itens sem dados ficam sem selo. */
	truncated: boolean;
}

export type StatusTone = "good" | "warning" | "critical" | "muted";
export type StatusKey =
	| "ativa"
	| "pausada"
	| "analise"
	| "reprovada"
	| "problema"
	| "pagamento"
	| "arquivada"
	| "concluida"
	| "outra";
export interface NodeStatus {
	key: StatusKey;
	label: string;
	tone: StatusTone;
}

const STATUS: Record<Exclude<StatusKey, "outra">, { label: string; tone: StatusTone }> = {
	analise: { label: "Em análise", tone: "muted" },
	arquivada: { label: "Arquivada", tone: "muted" },
	ativa: { label: "Ativa", tone: "good" },
	concluida: { label: "Concluída", tone: "muted" },
	pagamento: { label: "Pagamento pendente", tone: "warning" },
	pausada: { label: "Pausada", tone: "muted" },
	problema: { label: "Com problema", tone: "warning" },
	reprovada: { label: "Reprovada", tone: "critical" },
};

const BY_META: Record<string, Exclude<StatusKey, "outra" | "concluida">> = {
	ACTIVE: "ativa",
	ADSET_PAUSED: "pausada",
	ARCHIVED: "arquivada",
	CAMPAIGN_PAUSED: "pausada",
	DELETED: "arquivada",
	DISAPPROVED: "reprovada",
	IN_PROCESS: "analise",
	PAUSED: "pausada",
	PENDING_BILLING_INFO: "pagamento",
	PENDING_REVIEW: "analise",
	PREAPPROVED: "analise",
	WITH_ISSUES: "problema",
};

/**
 * effective_status da Meta → selo do painel. Arquivada/excluída vence tudo (vai para o grupo
 * "Arquivadas ou excluídas"); depois, data de fim já passada vira "Concluída".
 */
export function statusOf(effective: string, end: string | null, now: Date = new Date()): NodeStatus {
	if (BY_META[effective] === "arquivada") return { key: "arquivada", ...STATUS.arquivada };
	if (end) {
		const t = Date.parse(end);
		if (Number.isFinite(t) && t <= now.getTime()) return { key: "concluida", ...STATUS.concluida };
	}
	const key = BY_META[effective];
	if (key) return { key, ...STATUS[key] };
	return {
		key: "outra",
		label: effective ? effective.toLowerCase().replaceAll("_", " ") : "—",
		tone: "muted",
	};
}

/**
 * Moedas que a Meta trata SEM centavos nos orçamentos (offset 1). Todas as outras usam offset 100.
 * Lista da documentação da Meta ("Currencies"), que não segue as casas decimais do ISO 4217.
 */
const OFFSET_1 = new Set(["CLP", "COP", "CRC", "HUF", "IDR", "ISK", "JPY", "KRW", "PYG", "TWD", "VND"]);

/** Valor de orçamento da Meta (menor unidade) → valor na moeda. */
export function fromMinor(value: number, currency: string): number {
	return OFFSET_1.has(currency.toUpperCase()) ? value : value / 100;
}

/** "R$ 50,00/dia" · "R$ 500,00 no total · restam R$ 120,00" · null (orçamento em outro nível). */
export function budgetOf(item: StructureItem, currency: string): string | null {
	const money = (v: number) => formatMoney(fromMinor(v, currency), currency);
	if (item.daily && item.daily > 0) return `${money(item.daily)}/dia`;
	if (item.lifetime && item.lifetime > 0) {
		const rest =
			item.remaining !== null && item.remaining >= 0 ? ` · restam ${money(item.remaining)}` : "";
		return `${money(item.lifetime)} no total${rest}`;
	}
	return null;
}

/** Nó da árvore com a situação: status/budget só existem quando a estrutura tem o item. */
export type StructuredNode = Omit<TreeNode, "children"> & {
	status?: NodeStatus;
	budget?: string | null;
	/** Campanha ativa sem nenhuma linha de gasto no período. */
	idle?: boolean;
	children: StructuredNode[];
};

const zeroMetrics = (): Metrics => ({
	clicks: 0,
	impressions: 0,
	linkClicks: 0,
	metaPurchases: 0,
	metaPurchaseValue: 0,
	purchases: 0,
	revenue: 0,
	spend: 0,
});

/**
 * Junta situação e orçamento à árvore (sem mudar números nem ordem) e acrescenta, no fim, as
 * campanhas ATIVAS da estrutura que não tiveram gasto no período (métricas zeradas, idle).
 */
export function mergeStructure(
	tree: TreeNode[],
	structure: AdStructure | null,
	currency: string,
	now: Date = new Date(),
): StructuredNode[] {
	if (!structure) return tree;
	const visit = (n: TreeNode): StructuredNode => {
		const item =
			n.level === "campaign"
				? structure.campaigns[n.id]
				: n.level === "adset"
					? structure.adsets[n.id]
					: structure.ads[n.id];
		const children = n.children.map(visit);
		if (!item) return { ...n, children };
		const end = "end" in item ? item.end : null;
		return {
			...n,
			budget: "daily" in item ? budgetOf(item, currency) : null,
			children,
			status: statusOf(item.status, end, now),
		};
	};
	const merged = tree.map(visit);
	const present = new Set(tree.map(n => n.id));
	const idle: StructuredNode[] = Object.entries(structure.campaigns)
		.filter(([id, c]) => !present.has(id) && statusOf(c.status, c.end, now).key === "ativa")
		.sort(([, a], [, b]) => a.name.localeCompare(b.name, "pt-BR"))
		.map(([id, c]) => ({
			...zeroMetrics(),
			budget: budgetOf(c, currency),
			children: [],
			id,
			idle: true,
			level: "campaign",
			name: c.name,
			status: statusOf(c.status, c.end, now),
		}));
	return [...merged, ...idle];
}

/** Junta a estrutura de várias contas (ids da Meta são únicos entre contas). */
export function combineStructures(list: (AdStructure | null)[]): AdStructure | null {
	const ok = list.filter((s): s is AdStructure => s !== null);
	if (!ok.length) return null;
	return {
		ads: Object.assign({}, ...ok.map(s => s.ads)),
		adsets: Object.assign({}, ...ok.map(s => s.adsets)),
		campaigns: Object.assign({}, ...ok.map(s => s.campaigns)),
		truncated: ok.some(s => s.truncated),
	};
}

/**
 * Separa as campanhas para o grupo "Arquivadas ou excluídas" (fechado, no fim da lista):
 * - arquivadas: a Meta informa ARCHIVED/DELETED;
 * - excluídas: a Meta não lista mais a campanha, MAS só quando a lista da conta veio completa
 *   (isComplete). Sem a situação da conta, ou com a lista cortada, a campanha fica onde está:
 *   nunca some uma campanha ativa por falta de dado.
 * Não muda números: os totais da tela continuam somando tudo.
 */
export function splitArchived(
	nodes: StructuredNode[],
	isComplete: (campaignId: string) => boolean,
): { current: StructuredNode[]; archived: StructuredNode[] } {
	const current: StructuredNode[] = [];
	const archived: StructuredNode[] = [];
	for (const n of nodes) {
		const gone = n.status ? n.status.key === "arquivada" : !n.idle && isComplete(n.id);
		(gone ? archived : current).push(n);
	}
	return { archived, current };
}

/** Soma das métricas de vários nós (linha do grupo). */
export function sumMetrics(nodes: Metrics[]): Metrics {
	const total = zeroMetrics();
	for (const n of nodes) for (const k of Object.keys(total) as (keyof Metrics)[]) total[k] += n[k];
	return total;
}
