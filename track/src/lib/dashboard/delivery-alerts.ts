import "server-only";
import { eq, sql } from "drizzle-orm";
import { metaPixels, settings } from "@/db/schema";
import { isAdmin, readAsUser } from "@/lib/dal";
import { capiFailureReason } from "@/lib/meta/capi-errors";
import { MAX_ATTEMPTS, nextAttemptAt } from "@/lib/sales/retry-schedule";
import { DEFAULT_TIMEZONE } from "@/lib/time";
import { ACTIVE_SALE, notTest, num, rows } from "./context";
import { META_STATUS } from "./events";

/*
 * Aviso do topo do painel quando os envios falham (Administrador e Colaborador):
 *   - vermelho: a Meta recusou os últimos envios do servidor (CAPI) em sequência;
 *   - amarelo: venda aprovada que ainda não chegou à Meta ou ao GA4 e segue no reenvio automático.
 * Some sozinho: no primeiro envio aceito pela Meta, e quando a venda chega (ou o reenvio desiste,
 * caso que vai para a Saúde, só do Administrador). Roda ao abrir cada página: só consultas curtas.
 */

/** Falhas seguidas que acendem o aviso: um erro solto (instabilidade da Meta) não acende. */
export const OUTAGE_STREAK = 5;

export interface MetaOutage {
	since: string;
	rejected: number;
	/** Pixel da falha mais recente (nome de Configurações; o ID se o pixel sumiu). */
	pixel: string | null;
	reason: string;
	affectedSales: number;
}

export interface PendingSale {
	transactionId: string;
	value: number;
	currency: string;
	occurredAt: string;
	attempts: number;
	nextAt: string;
	destinations: ("meta" | "ga4")[];
}

export interface DeliveryAlerts {
	admin: boolean;
	timeZone: string;
	meta: MetaOutage | null;
	/** oldestAt: venda mais antiga ainda no reenvio (o link abre o Faturamento desde esse dia). */
	sales: { count: number; latest: PendingSale; destinations: ("meta" | "ga4")[]; oldestAt: string } | null;
}

/** Envio do servidor de fato tentado (fora teste e "nenhum pixel ativo"), nos últimos 7 dias. */
const ATTEMPTED = sql`l.created_at > now() - interval '7 days' and l.response_meta is not null
  and not (l.response_meta ? 'test') and not (l.response_meta ? 'skipped')`;

/** Motivo e pixel da falha gravada em response_meta ({ pixelId: { ok, status, body } } ou { error }). */
function failureOf(responseMeta: unknown): { pixelId: string | null; reason: string } {
	const r = (responseMeta ?? {}) as Record<string, unknown>;
	if (typeof r.error === "string") return { pixelId: null, reason: r.error };
	for (const [pixelId, value] of Object.entries(r)) {
		const delivery = value as { ok?: boolean; status?: number; body?: unknown } | null;
		if (delivery && delivery.ok === false) return { pixelId, reason: capiFailureReason(delivery) };
	}
	return { pixelId: null, reason: "a Meta recusou o envio" };
}

export async function getDeliveryAlerts(): Promise<DeliveryAlerts> {
	const admin = await isAdmin();
	return readAsUser(async tx => {
		const [cfg] = await tx.select({ tz: settings.timezone }).from(settings).where(eq(settings.id, 1));
		const timeZone = cfg?.tz ?? DEFAULT_TIMEZONE;

		// ------------------------------------------------ Meta recusando (eventos do site via CAPI)
		let meta: MetaOutage | null = null;
		const latest = await rows<{ st: string }>(
			tx,
			sql`select ${META_STATUS} as st from events_log l where ${ATTEMPTED}
          order by l.created_at desc limit ${OUTAGE_STREAK}`,
		);
		if (latest.length === OUTAGE_STREAK && latest.every(r => r.st === "erro")) {
			const [streak] = await rows<{ since: string; rejected: unknown; last: unknown }>(
				tx,
				sql`with attempted as (
            select l.created_at, l.response_meta, ${META_STATUS} as st from events_log l where ${ATTEMPTED}
          ), failing as (
            select * from attempted
            where st = 'erro'
              and created_at > coalesce((select max(created_at) from attempted where st = 'ok'), '-infinity')
          )
          select min(created_at) as since, count(*) as rejected,
                 (select response_meta from failing order by created_at desc limit 1) as last
          from failing`,
			);
			if (streak?.since) {
				const failure = failureOf(streak.last);
				const [pixel] = failure.pixelId
					? await tx
							.select({ label: metaPixels.label })
							.from(metaPixels)
							.where(eq(metaPixels.pixelId, failure.pixelId))
					: [];
				const [sales] = await rows<{ n: unknown }>(
					tx,
					sql`select count(*) as n from purchases p
              where not p.is_renewal and p.meta_sent_at is null and p.meta_attempts > 0
                and coalesce(p.occurred_at, p.created_at) >= ${streak.since}`,
				);
				meta = {
					affectedSales: num(sales?.n),
					pixel: pixel?.label ?? (failure.pixelId ? `Pixel ${failure.pixelId}` : null),
					reason: failure.reason,
					rejected: num(streak.rejected),
					since: new Date(streak.since).toISOString(),
				};
			}
		}

		// ------------------------------------------------ vendas ainda no reenvio automático
		const pending = await rows<{
			transaction_id: string;
			value: unknown;
			currency: string;
			at: string;
			meta_attempts: unknown;
			ga4_attempts: unknown;
			meta: boolean;
			ga4: boolean;
		}>(
			tx,
			sql`select * from (
          select p.transaction_id, p.value, p.currency, coalesce(p.occurred_at, p.created_at) as at,
                 p.meta_attempts, p.ga4_attempts,
                 (p.meta_sent_at is null and p.meta_attempts between 1 and ${MAX_ATTEMPTS - 1}) as meta,
                 (p.ga4_sent_at is null and p.ga4_attempts between 1 and ${MAX_ATTEMPTS - 1}) as ga4
          from purchases p
          where not p.is_renewal and p.marketing_consent is true and p.status in ${ACTIVE_SALE}
            and coalesce(p.occurred_at, p.created_at) > now() - interval '7 days'
            and ${notTest("p.trck_user_id")}
        ) s where meta or ga4
        order by at desc limit 50`,
		);
		let sales: DeliveryAlerts["sales"] = null;
		const [first] = pending;
		if (first) {
			const saleAt = new Date(first.at);
			const destinations = (["meta", "ga4"] as const).filter(d => first[d]);
			const attemptsOf = (d: "meta" | "ga4") =>
				num(d === "meta" ? first.meta_attempts : first.ga4_attempts);
			const next = destinations
				.map(d => nextAttemptAt(saleAt, attemptsOf(d)))
				.filter((d): d is Date => d !== null)
				.sort((a, b) => a.getTime() - b.getTime())[0];
			sales = {
				count: pending.length,
				destinations: (["meta", "ga4"] as const).filter(d => pending.some(p => p[d])),
				latest: {
					attempts: Math.max(...destinations.map(attemptsOf)),
					currency: first.currency,
					destinations,
					nextAt: (next ?? new Date()).toISOString(),
					occurredAt: saleAt.toISOString(),
					transactionId: first.transaction_id,
					value: num(first.value),
				},
				oldestAt: new Date((pending.at(-1) ?? first).at).toISOString(),
			};
		}
		return { admin, meta, sales, timeZone };
	});
}
