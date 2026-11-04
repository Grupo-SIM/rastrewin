import "server-only";
import { eq, type SQL, sql } from "drizzle-orm";
import type { ReaderTx } from "@/db";
import { settings } from "@/db/schema";
import { readAsUser } from "@/lib/dal";
import { DEFAULT_TIMEZONE } from "@/lib/time";
import { type Period, resolvePeriod } from "./period";

export type SearchParams = Record<string, string | string[] | undefined>;
export interface DashboardCtx {
	tx: ReaderTx;
	tz: string;
	period: Period;
	currency: string;
}

export function param(sp: SearchParams, key: string): string | null {
	const v = sp[key];
	return (Array.isArray(v) ? v[0] : v) ?? null;
}

/**
 * Abre UMA transação de leitura (app_reader + RLS, sessão validada) para a página,
 * lê o fuso/moeda do painel e resolve o período a partir da URL.
 */
export function withDashboard<T>(sp: SearchParams, fn: (ctx: DashboardCtx) => Promise<T>): Promise<T> {
	return readAsUser(async tx => {
		const [row] = await tx
			.select({ currency: settings.currency, timezone: settings.timezone })
			.from(settings)
			.where(eq(settings.id, 1));
		const tz = row?.timezone ?? DEFAULT_TIMEZONE;
		const period = resolvePeriod(
			{ ate: param(sp, "ate"), de: param(sp, "de"), periodo: param(sp, "periodo") },
			tz,
		);
		return fn({ currency: row?.currency ?? "BRL", period, tx, tz });
	});
}

/** Executa SQL e devolve as linhas tipadas. */
export async function rows<T>(tx: ReaderTx, query: SQL): Promise<T[]> {
	const result = await tx.execute(query);
	return result.rows as T[];
}

export const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

/** Statuses que contam como venda (aprovada ou em mediação). */
export const ACTIVE_SALE = sql`('approved', 'refund_requested')`;
export const REFUNDED = sql`('refunded', 'chargeback')`;
