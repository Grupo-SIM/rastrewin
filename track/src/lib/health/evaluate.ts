/*
 * Saúde do sistema (aba Configurações › Saúde e faixa de aviso do painel). Regras puras e testadas:
 * as consultas ficam em queries.ts e o sinal do backend em relay.ts.
 */

/** Limite de tamanho do banco do track que dispara o aviso (5 GB). */
export const DB_ALERT_BYTES = 5 * 1024 ** 3;
/** Sem sinal do backend por mais que isso = backend parado ou sem conseguir falar com o track. */
export const RELAY_SILENCE_MS = 10 * 60_000;
/** Venda na fila do backend há mais que isso = repasse atrasado. */
export const RELAY_PENDING_MS = 30 * 60_000;

export type IssueKey =
	"banco" | "limpeza" | "repasse-sinal" | "repasse-atrasado" | "repasse-desistiu" | "envio";

export interface HealthIssue {
	key: IssueKey;
	/** Frase curta para a faixa do topo. */
	title: string;
}

// ---------------------------------------------------------------- banco

export interface TableSize {
	bytes: number;
	/** Linhas no total (estimativa do Postgres, ou contagem exata se ele ainda não estimou). */
	rows: number;
	/** Linhas criadas nos últimos 7 dias (só tabelas que crescem com o tráfego). */
	rows7d: number | null;
}

/**
 * Crescimento estimado por dia: linhas novas por dia × tamanho médio da linha de cada tabela.
 * É uma estimativa: a limpeza diária esvazia os JSON dos eventos com mais de 14 dias, então o
 * crescimento real a longo prazo tende a ser menor.
 */
export function growthPerDay(tables: TableSize[]): number {
	let total = 0;
	for (const t of tables) {
		if (t.rows7d === null || t.rows <= 0) continue;
		total += (t.rows7d / 7) * (t.bytes / t.rows);
	}
	return Math.round(total);
}

/** Dias até o limite no ritmo atual (null sem crescimento). */
export function daysToLimit(sizeBytes: number, perDay: number, limit = DB_ALERT_BYTES): number | null {
	if (perDay <= 0) return null;
	return Math.max(0, Math.floor((limit - sizeBytes) / perDay));
}

// ---------------------------------------------------------------- repasse do backend

export interface RelayStatus {
	sentAt: string;
	pending: number;
	oldestPendingAt: string | null;
	failed: number;
	failedSample: { eventId: string; attempts: number; lastError: string | null; createdAt: string }[];
	lastError: string | null;
}

export type RelayState = "aguardando" | "sem-sinal" | "desistiu" | "atrasado" | "ok";

/** Estado do repasse a partir do último sinal do backend (null = nenhum sinal desde que o app subiu). */
export function relayState(last: { receivedAt: Date; status: RelayStatus } | null, now: Date): RelayState {
	if (!last) return "aguardando";
	if (now.getTime() - last.receivedAt.getTime() > RELAY_SILENCE_MS) return "sem-sinal";
	if (last.status.failed > 0) return "desistiu";
	const oldest = last.status.oldestPendingAt ? Date.parse(last.status.oldestPendingAt) : null;
	if (oldest !== null && now.getTime() - oldest > RELAY_PENDING_MS) return "atrasado";
	return "ok";
}

// ---------------------------------------------------------------- avaliação geral

export interface HealthInputs {
	dbBytes: number;
	maintenance: "ok" | "rodando" | "nunca" | "atrasada" | "erro";
	relay: { state: RelayState; pending: number; failed: number };
	/** Vendas novas dos últimos 7 dias que não chegaram à Meta/GA4 depois de todas as tentativas. */
	deliveryFailures: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Problemas que pedem atenção, do mais grave ao menos grave. Lista vazia = tudo certo. */
export function healthIssues(i: HealthInputs): HealthIssue[] {
	const out: HealthIssue[] = [];
	if (i.relay.state === "sem-sinal")
		out.push({
			key: "repasse-sinal",
			title: "O backend parou de dar sinal: vendas novas podem não estar chegando ao painel",
		});
	if (i.relay.state === "desistiu")
		out.push({
			key: "repasse-desistiu",
			title: `${plural(i.relay.failed, "venda não chegou", "vendas não chegaram")} do backend (ele desistiu de reenviar)`,
		});
	if (i.relay.state === "atrasado")
		out.push({
			key: "repasse-atrasado",
			title: `${plural(i.relay.pending, "venda está parada", "vendas estão paradas")} no backend há mais de 30 min`,
		});
	if (i.deliveryFailures > 0)
		out.push({
			key: "envio",
			title: `${plural(i.deliveryFailures, "venda não chegou", "vendas não chegaram")} à Meta ou ao GA4`,
		});
	if (i.maintenance === "erro" || i.maintenance === "atrasada")
		out.push({
			key: "limpeza",
			title:
				i.maintenance === "erro"
					? "A limpeza diária do banco falhou"
					: "A limpeza diária do banco está atrasada",
		});
	if (i.dbBytes >= DB_ALERT_BYTES) out.push({ key: "banco", title: "O banco do painel passou de 5 GB" });
	return out;
}
