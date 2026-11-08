import "server-only";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { serviceDb } from "@/db";
import { metaInsightsCache } from "@/db/schema";
import { describeGraphError } from "@/lib/meta/graph";
import { fetchAccountTotals, fetchAdInsights, fetchFirstSpendDay } from "@/lib/meta/insights";
import type { AccountTotals, InsightRow, SpendSource } from "./build";
import {
	canCall,
	type Decision,
	emptyState,
	type LimiterState,
	pause,
	recordCall,
	THROTTLE_CODES,
	USAGE_PAUSE_PCT,
	usagePct,
} from "./limiter";

/*
 * Cache dos insights (tabela meta_insights_cache) + limite próprio por conta.
 * - Válido por 1 h se o período inclui hoje; 12 h se é só passado.
 * - Vencido: devolve o cache NA HORA e atualiza depois da resposta (after). Sem cache: busca agora.
 * - Nunca mais de uma busca simultânea para a mesma chave.
 * - "Máximo" (withFirstDay): a mesma tarefa também acha o dia do gasto mais antigo da conta
 *   (2 chamadas pequenas a mais, contadas no limite) e guarda junto, em firstDay.
 * - Detalhe cortado (mais linhas que o limite de páginas): a mesma tarefa busca os totais da CONTA
 *   (1 chamada pequena, contada no limite) e guarda em accountTotals; os totais da tela usam eles.
 */

export interface AdAccount {
	adAccountId: string;
	label: string;
	token: string;
}
export interface InsightsResult {
	adAccountId: string;
	label: string;
	rows: InsightRow[];
	currency: string | null;
	fetchedAt: string | null;
	stale: boolean;
	usagePct: number | null;
	notice: string | null;
	/** Só no "Máximo": dia do gasto mais antigo da conta (null = sem gasto ou não consultado). */
	firstDay: string | null;
	/** A Meta tinha mais linhas que o limite: rows está incompleto. */
	truncated: boolean;
	/** Totais da conta, buscados só quando truncated (null se não buscados ou se a chamada falhou). */
	accountTotals: AccountTotals | null;
}

const FRESH_TODAY_MS = 60 * 60_000;
const FRESH_PAST_MS = 12 * 60 * 60_000;
interface Cached {
	rows: InsightRow[];
	currency: string | null;
	firstDay?: string | null;
	truncated?: boolean;
	accountTotals?: AccountTotals | null;
}

const g = globalThis as unknown as {
	__insightsLimiter?: Map<string, LimiterState>;
	__insightsInflight?: Map<string, Promise<string | null>>;
};
const limiter = (g.__insightsLimiter ??= new Map());
const inflight = (g.__insightsInflight ??= new Map());

const keyOf = (acct: string, since: string, until: string, daily: boolean) =>
	`${acct}:${since}:${until}:${daily ? "d" : "t"}`;
export const isDaily = (days: number) => days <= 90;

function explain(d: Exclude<Decision, { ok: true }>): string {
	const when = new Date(d.retryAt).toLocaleTimeString("pt-BR", {
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "America/Sao_Paulo",
	});
	switch (d.reason) {
		case "pausa":
			return `A Meta pediu pausa. Nova consulta liberada às ${when}.`;
		case "cooldown":
			return `“Atualizar agora” liberado novamente às ${when}.`;
		case "hora":
			return `Limite de consultas da hora atingido. Liberado às ${when}.`;
		default:
			return "Consulta muito próxima da anterior; tente em alguns segundos.";
	}
}

async function readCache(key: string) {
	const [row] = await serviceDb()
		.select({
			data: metaInsightsCache.data,
			fetchedAt: metaInsightsCache.fetchedAt,
			usage: metaInsightsCache.usage,
		})
		.from(metaInsightsCache)
		.where(eq(metaInsightsCache.cacheKey, key));
	return row ?? null;
}

/** Busca na Meta (respeitando o limite) e grava no cache. Retorna um aviso, ou null se deu certo. */
async function refresh(
	acct: AdAccount,
	since: string,
	until: string,
	daily: boolean,
	manual: boolean,
	withFirstDay = false,
): Promise<string | null> {
	const key = keyOf(acct.adAccountId, since, until, daily);
	const running = inflight.get(key);
	if (running) return running;

	const job = (async () => {
		const now = Date.now();
		const state = limiter.get(acct.adAccountId) ?? emptyState();
		const decision = canCall(state, now, manual);
		if (!decision.ok) return explain(decision);
		limiter.set(acct.adAccountId, recordCall(state, now, manual));

		const res = await fetchAdInsights(acct.adAccountId, acct.token, since, until, daily);
		// Chamada que nem chegou à Meta (rede/abortada) não conta no limite.
		if (!res.ok && res.status === 0) {
			limiter.set(acct.adAccountId, state);
			return describeGraphError(res.error);
		}
		// páginas extras também contam no limite
		for (let i = 1; i < res.calls; i++)
			limiter.set(acct.adAccountId, recordCall(limiter.get(acct.adAccountId)!, Date.now()));
		const pct = usagePct(res.usage);
		if (!res.ok) {
			if (res.error.code !== undefined && THROTTLE_CODES.has(res.error.code))
				limiter.set(acct.adAccountId, pause(limiter.get(acct.adAccountId)!, Date.now()));
			return describeGraphError(res.error);
		}
		if (pct >= USAGE_PAUSE_PCT)
			limiter.set(acct.adAccountId, pause(limiter.get(acct.adAccountId)!, Date.now()));

		let firstDay: string | null = null;
		if (withFirstDay) {
			// Falha aqui não derruba a consulta principal: o período cai no 1º dado do track.
			const first = await fetchFirstSpendDay(acct.adAccountId, acct.token, since, until);
			for (let i = 0; i < first.calls; i++)
				limiter.set(acct.adAccountId, recordCall(limiter.get(acct.adAccountId)!, Date.now()));
			if (first.ok) firstDay = first.day;
		}

		let accountTotals: AccountTotals | null = null;
		if (res.truncated) {
			// Falha aqui não derruba a consulta: a tela avisa que o detalhe está incompleto.
			const totals = await fetchAccountTotals(acct.adAccountId, acct.token, since, until, daily);
			limiter.set(acct.adAccountId, recordCall(limiter.get(acct.adAccountId)!, Date.now()));
			if (totals.ok) accountTotals = totals.totals;
		}

		const data: Cached = {
			accountTotals,
			currency: res.currency,
			firstDay,
			rows: res.rows,
			truncated: res.truncated,
		};
		await serviceDb()
			.insert(metaInsightsCache)
			.values({
				adAccountId: acct.adAccountId,
				cacheKey: key,
				data,
				fetchedAt: new Date(),
				level: "ad",
				since,
				until,
				usage: { ...res.usage, pct },
			})
			.onConflictDoUpdate({
				set: { data, fetchedAt: new Date(), usage: { ...res.usage, pct } },
				target: metaInsightsCache.cacheKey,
			});
		return null;
	})().finally(() => inflight.delete(key));

	inflight.set(key, job);
	return job;
}

function toResult(
	acct: AdAccount,
	cached: Awaited<ReturnType<typeof readCache>>,
	stale: boolean,
	notice: string | null,
): InsightsResult {
	const data = (cached?.data as Cached | undefined) ?? { currency: null, rows: [] };
	const pct = (cached?.usage as { pct?: number } | null)?.pct;
	return {
		accountTotals: data.accountTotals ?? null,
		adAccountId: acct.adAccountId,
		currency: data.currency,
		fetchedAt: cached?.fetchedAt.toISOString() ?? null,
		firstDay: data.firstDay ?? null,
		label: acct.label,
		notice,
		rows: data.rows,
		stale,
		truncated: data.truncated === true,
		usagePct: typeof pct === "number" ? pct : null,
	};
}

/** Insights para a página: cache primeiro; atualização sob demanda e dentro do limite. */
export async function getInsights(
	acct: AdAccount,
	since: string,
	until: string,
	days: number,
	includesToday: boolean,
	withFirstDay = false,
): Promise<InsightsResult> {
	const daily = isDaily(days);
	const key = keyOf(acct.adAccountId, since, until, daily);
	const cached = await readCache(key);
	const ttl = includesToday ? FRESH_TODAY_MS : FRESH_PAST_MS;
	if (cached && Date.now() - cached.fetchedAt.getTime() < ttl) return toResult(acct, cached, false, null);
	if (cached) {
		after(() => refresh(acct, since, until, daily, false, withFirstDay).catch(() => {}));
		return toResult(acct, cached, true, null);
	}
	const notice = await refresh(acct, since, until, daily, false, withFirstDay);
	return toResult(acct, await readCache(key), false, notice);
}

/** Só lê o cache (sem chamar a Meta) — usado para o delta do período anterior. */
export async function peekInsights(
	acct: AdAccount,
	since: string,
	until: string,
	days: number,
): Promise<SpendSource | null> {
	const cached = await readCache(keyOf(acct.adAccountId, since, until, isDaily(days)));
	if (!cached) return null;
	const data = cached.data as Cached;
	return { accountTotals: data.accountTotals ?? null, rows: data.rows, truncated: data.truncated === true };
}

/** Botão "Atualizar agora": respeita o cooldown de 15 min por conta. */
export function refreshNow(
	acct: AdAccount,
	since: string,
	until: string,
	days: number,
	withFirstDay = false,
) {
	return refresh(acct, since, until, isDaily(days), true, withFirstDay);
}
