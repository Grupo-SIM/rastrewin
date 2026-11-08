import "server-only";
import { sql } from "drizzle-orm";
import { ACTIVE_SALE, num, param, REFUNDED, rows, type SearchParams, withDashboard } from "./context";
import { type DailyPoint, fillDays } from "./overview";
import type { Period } from "./period";

export const PURCHASE_STATUS_FILTERS = [
	{ key: "todas", label: "Todas" },
	{ key: "aprovadas", label: "Aprovadas" },
	{ key: "reembolsadas", label: "Reembolsadas / chargeback" },
	{ key: "pendentes", label: "Pendentes" },
	{ key: "recusadas", label: "Recusadas / expiradas" },
] as const;

const STATUS_SQL: Record<string, ReturnType<typeof sql>> = {
	aprovadas: sql`p.status in ${ACTIVE_SALE}`,
	pendentes: sql`p.status = 'pending'`,
	recusadas: sql`p.status in ('declined', 'expired')`,
	reembolsadas: sql`p.status in ${REFUNDED}`,
};

export interface PurchaseRow {
	id: number;
	transactionId: string;
	date: string;
	product: string | null;
	value: number;
	currency: string;
	status: string;
	paymentMethod: string | null;
	utmSource: string | null;
	utmCampaign: string | null;
	matchedBy: string | null;
	/** ok = enviado; erro = tentou e falhou; pendente = ainda não tentou (ou sem conta ativa); renovacao = não vai à Meta/GA4 */
	metaStatus: "ok" | "erro" | "pendente" | "renovacao";
	ga4Status: "ok" | "erro" | "pendente" | "renovacao";
}

export interface Revenue {
	period: Period;
	timeZone: string;
	currency: string;
	kpis: {
		revenue: number;
		revenuePrev: number;
		net: number;
		purchases: number;
		purchasesPrev: number;
		refunds: number;
		refundsValue: number;
		/** Renovações (recompra de quem já tinha pago): já incluídas em receita e compras. */
		renewals: number;
		renewalsPrev: number;
		renewalsValue: number;
	};
	revenueByDay: DailyPoint[];
	byPaymentMethod: { key: string; label: string; value: number; count: number }[];
	table: { rows: PurchaseRow[]; total: number; page: number; pageSize: number; status: string; q: string };
}

const PAYMENT_LABEL: Record<string, string> = { BOLETO: "Boleto", CREDIT_CARD: "Cartão", PIX: "PIX" };
const PAGE_SIZE = 25;

export function getRevenue(sp: SearchParams): Promise<Revenue> {
	return withDashboard(sp, async ({ tx, tz, period, currency }) => {
		const { start: s, end: e, prevStart: ps } = period;
		const d = sql`coalesce(occurred_at, created_at)`;

		const [k] = await rows<Record<string, unknown>>(
			tx,
			sql`
      select
        count(*) filter (where ${d} >= ${s}) as purchases,
        coalesce(sum(value) filter (where ${d} >= ${s}), 0) as revenue,
        coalesce(sum(net_value) filter (where ${d} >= ${s}), 0) as net,
        count(*) filter (where ${d} < ${s}) as purchases_prev,
        coalesce(sum(value) filter (where ${d} < ${s}), 0) as revenue_prev,
        count(*) filter (where ${d} >= ${s} and is_renewal) as renewals,
        coalesce(sum(value) filter (where ${d} >= ${s} and is_renewal), 0) as renewals_value,
        count(*) filter (where ${d} < ${s} and is_renewal) as renewals_prev
      from purchases where status in ${ACTIVE_SALE} and ${d} >= ${ps} and ${d} < ${e}`,
		);

		const [r] = await rows<Record<string, unknown>>(
			tx,
			sql`
      select count(*) as refunds, coalesce(sum(value), 0) as refunds_value from purchases
      where status in ${REFUNDED} and coalesce(refunded_at, updated_at) >= ${s} and coalesce(refunded_at, updated_at) < ${e}`,
		);

		const byDay = await rows<{ day: string; value: unknown }>(
			tx,
			sql`
      select ((${d} at time zone ${tz})::date)::text as day, sum(value) as value from purchases
      where status in ${ACTIVE_SALE} and ${d} >= ${s} and ${d} < ${e} group by 1`,
		);

		const methods = await rows<{ key: string; value: unknown; count: unknown }>(
			tx,
			sql`
      select coalesce(payment_method, 'OUTRO') as key, sum(value) as value, count(*) as count from purchases
      where status in ${ACTIVE_SALE} and ${d} >= ${s} and ${d} < ${e}
      group by 1 order by sum(value) desc`,
		);

		// tabela
		const status = PURCHASE_STATUS_FILTERS.some(f => f.key === param(sp, "status"))
			? param(sp, "status")!
			: "todas";
		const q = (param(sp, "q") ?? "").trim().slice(0, 100);
		const page = Math.max(1, Math.min(10_000, Number(param(sp, "page")) || 1));
		const where = sql.join(
			[
				sql`coalesce(p.occurred_at, p.created_at) >= ${s} and coalesce(p.occurred_at, p.created_at) < ${e}`,
				...(STATUS_SQL[status] ? [STATUS_SQL[status]] : []),
				...(q
					? [
							sql`(p.transaction_id ilike ${`%${q}%`} or p.email ilike ${`%${q}%`} or p.product ilike ${`%${q}%`})`,
						]
					: []),
			],
			sql` and `,
		);
		const [{ total }] = await rows<{ total: unknown }>(
			tx,
			sql`select count(*) as total from purchases p where ${where}`,
		);
		const list = await rows<Record<string, unknown>>(
			tx,
			sql`
      select p.id, p.transaction_id, coalesce(p.occurred_at, p.created_at) as date, p.product, p.value, p.currency, p.status,
             p.payment_method, p.utm_source, p.utm_campaign, p.match->>'by' as matched_by,
             case when p.is_renewal then 'renovacao' when p.meta_sent_at is not null then 'ok' when p.meta_attempts > 0 then 'erro' else 'pendente' end as meta_status,
             case when p.is_renewal then 'renovacao' when p.ga4_sent_at is not null then 'ok' when p.ga4_attempts > 0 then 'erro' else 'pendente' end as ga4_status
      from purchases p where ${where}
      order by coalesce(p.occurred_at, p.created_at) desc, p.id desc
      limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`,
		);

		return {
			byPaymentMethod: methods.map(m => ({
				count: num(m.count),
				key: m.key,
				label: PAYMENT_LABEL[m.key] ?? (m.key === "OUTRO" ? "Outro" : m.key),
				value: num(m.value),
			})),
			currency,
			kpis: {
				net: num(k.net),
				purchases: num(k.purchases),
				purchasesPrev: num(k.purchases_prev),
				refunds: num(r.refunds),
				refundsValue: num(r.refunds_value),
				renewals: num(k.renewals),
				renewalsPrev: num(k.renewals_prev),
				renewalsValue: num(k.renewals_value),
				revenue: num(k.revenue),
				revenuePrev: num(k.revenue_prev),
			},
			period,
			revenueByDay: fillDays(period, byDay),
			table: {
				page,
				pageSize: PAGE_SIZE,
				q,
				rows: list.map(x => ({
					currency: String(x.currency),
					date: new Date(x.date as string).toISOString(),
					ga4Status: x.ga4_status as PurchaseRow["ga4Status"],
					id: num(x.id),
					matchedBy: (x.matched_by as string) ?? null,
					metaStatus: x.meta_status as PurchaseRow["metaStatus"],
					paymentMethod: (x.payment_method as string) ?? null,
					product: (x.product as string) ?? null,
					status: String(x.status),
					transactionId: String(x.transaction_id),
					utmCampaign: (x.utm_campaign as string) ?? null,
					utmSource: (x.utm_source as string) ?? null,
					value: num(x.value),
				})),
				status,
				total: num(total),
			},
			timeZone: tz,
		};
	});
}
