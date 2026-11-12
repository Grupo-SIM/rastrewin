import "server-only";
import { desc, sql } from "drizzle-orm";
import type { ReaderTx } from "@/db";
import { maintenanceRuns } from "@/db/schema";
import { maintenanceHealth } from "@/lib/config/maintenance";
import { getSession, readAsUser } from "@/lib/dal";
import { ACTIVE_SALE, num, rows } from "@/lib/dashboard/context";
import { MAX_ATTEMPTS } from "@/lib/sales/deliver";
import { ignoredVisits } from "@/lib/tracking/bot-guard";
import type { BotReason } from "@/lib/tracking/bot-user-agent";
import {
	daysToLimit,
	DB_ALERT_BYTES,
	growthPerDay,
	type HealthIssue,
	healthIssues,
	type RelayState,
	relayState,
	type RelayStatus,
} from "./evaluate";
import { lastRelayStatus, relayRetryState } from "./relay";

/*
 * Dados da aba Configurações › Saúde e da faixa de aviso do painel. Leitura com a sessão do usuário
 * (readAsUser, RLS). O tamanho do banco é a soma de pg_total_relation_size de todas as tabelas
 * (com índices e TOAST): pg_database_size exige o privilégio CONNECT, que o app_reader não tem, e a
 * diferença para o arquivo do banco é desprezível. O sinal do backend e a contagem de robôs ficam
 * em memória.
 */

/** Tabelas que crescem com o tráfego e a coluna de data usada para medir o ritmo. */
const GROWING: Record<string, { label: string; column: string }> = {
	events_log: { column: "created_at", label: "Eventos" },
	purchases: { column: "created_at", label: "Vendas" },
	video_views: { column: "started_at", label: "Plays de vídeo" },
	visitors: { column: "created_at", label: "Visitantes" },
	webhook_events: { column: "received_at", label: "Eventos de venda recebidos" },
};
const OTHER_LABELS: Record<string, string> = {
	__drizzle_migrations: "Histórico de atualizações do banco",
	account: "Contas de login do painel",
	ga4_accounts: "Contas GA4",
	maintenance_runs: "Histórico da limpeza diária",
	meta_ad_accounts: "Contas de anúncio",
	meta_insights_cache: "Cache da Meta (Campanhas)",
	meta_pixels: "Pixels Meta",
	session: "Sessões do painel",
	settings: "Configurações gerais",
	user: "Usuários do painel",
	verification: "Verificações de login",
};

export interface DeliveryFailure {
	transactionId: string;
	occurredAt: string;
	destinations: string[];
	error: string | null;
}

export interface HealthView {
	issues: HealthIssue[];
	db: {
		bytes: number;
		limitBytes: number;
		perDay: number;
		daysToLimit: number | null;
		tables: { name: string; label: string; bytes: number; rows: number }[];
	};
	maintenance: {
		health: ReturnType<typeof maintenanceHealth>;
		startedAt: string | null;
		error: string | null;
	};
	relay: {
		state: RelayState;
		receivedAt: string | null;
		/** Minutos desde o último sinal (null sem sinal). */
		silenceMinutes: number | null;
		status: RelayStatus | null;
		retry: { requestedAt: string; deliveredAt: string | null } | null;
	};
	deliveries: { total: number; sample: DeliveryFailure[] };
	bots: { since: string; counts: Partial<Record<BotReason, number>>; total: number };
}

async function dbBytes(tx: ReaderTx): Promise<number> {
	const [r] = await rows<{ b: unknown }>(
		tx,
		sql`select sum(pg_total_relation_size(oid)) as b from pg_class where relkind in ('r', 'm') and not relisshared`,
	);
	return num(r?.b);
}

async function lastMaintenance(tx: ReaderTx) {
	const [run] = await tx
		.select({
			error: maintenanceRuns.error,
			startedAt: maintenanceRuns.startedAt,
			status: maintenanceRuns.status,
		})
		.from(maintenanceRuns)
		.orderBy(desc(maintenanceRuns.startedAt))
		.limit(1);
	return { health: maintenanceHealth(run ?? null, new Date()), run: run ?? null };
}

/** Vendas dos últimos 7 dias (a janela do reenvio) que esgotaram as tentativas para a Meta ou o GA4. */
const FAILED_DELIVERY = sql`
  status in ${ACTIVE_SALE} and created_at >= now() - interval '7 days'
  and ((meta_sent_at is null and meta_attempts >= ${MAX_ATTEMPTS})
    or (ga4_sent_at is null and ga4_attempts >= ${MAX_ATTEMPTS}))`;

async function deliveryFailureCount(tx: ReaderTx): Promise<number> {
	const [r] = await rows<{ n: unknown }>(
		tx,
		sql`select count(*) as n from purchases where ${FAILED_DELIVERY}`,
	);
	return num(r?.n);
}

function relayNow() {
	const last = lastRelayStatus();
	return { last, state: relayState(last, new Date()) };
}

/** Só o necessário para a faixa do topo (barato: roda ao abrir o painel). null sem sessão. */
export async function getHealthIssues(): Promise<HealthIssue[] | null> {
	if (!(await getSession())) return null;
	return readAsUser(async tx => {
		const [bytes, maintenance, deliveryFailures] = await Promise.all([
			dbBytes(tx),
			lastMaintenance(tx),
			deliveryFailureCount(tx),
		]);
		const { last, state } = relayNow();
		return healthIssues({
			dbBytes: bytes,
			deliveryFailures,
			maintenance: maintenance.health,
			relay: { failed: last?.status.failed ?? 0, pending: last?.status.pending ?? 0, state },
		});
	});
}

export function getHealthView(): Promise<HealthView> {
	return readAsUser(async tx => {
		const bytes = await dbBytes(tx);
		const maintenance = await lastMaintenance(tx);

		// Linhas: contagem viva das estatísticas do Postgres (n_live_tup), atualizada a cada gravação e
		// legível pelo app_reader até nas tabelas de login. A estimativa do planejador (reltuples) só
		// aparece depois do primeiro ANALYZE, que nas tabelas pequenas demora: ficava em 0 ou atrasada.
		const tableRows = await rows<{ name: string; bytes: unknown; live: unknown }>(
			tx,
			sql`
      select c.relname as name, pg_total_relation_size(c.oid) as bytes,
             coalesce(s.n_live_tup, greatest(c.reltuples, 0)) as live
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      left join pg_stat_user_tables s on s.relid = c.oid
      where n.nspname = 'public' and c.relkind = 'r'
      order by pg_total_relation_size(c.oid) desc`,
		);

		const tables: HealthView["db"]["tables"] = [];
		const growth: Parameters<typeof growthPerDay>[0] = [];
		for (const t of tableRows) {
			const grows = GROWING[t.name];
			let total = Math.max(0, Math.round(num(t.live)));
			let recent: number | null = null;
			if (grows) {
				// Ritmo de crescimento: linhas criadas nos últimos 7 dias (contagem exata, pelo índice de data).
				const col = sql.identifier(grows.column);
				const [c] = await rows<{ recent: unknown }>(
					tx,
					sql`select count(*) as recent from ${sql.identifier(t.name)} where ${col} >= now() - interval '7 days'`,
				);
				recent = num(c?.recent);
				// As estatísticas podem estar alguns segundos atrás da contagem exata.
				total = Math.max(total, recent);
			}
			growth.push({ bytes: num(t.bytes), rows: total, rows7d: recent });
			tables.push({
				bytes: num(t.bytes),
				label: grows?.label ?? OTHER_LABELS[t.name] ?? t.name,
				name: t.name,
				rows: total,
			});
		}
		const perDay = growthPerDay(growth);

		const failures = await rows<Record<string, unknown>>(
			tx,
			sql`
      select transaction_id, coalesce(occurred_at, created_at) as at, last_delivery_error,
             (meta_sent_at is null and meta_attempts >= ${MAX_ATTEMPTS}) as meta,
             (ga4_sent_at is null and ga4_attempts >= ${MAX_ATTEMPTS}) as ga4
      from purchases where ${FAILED_DELIVERY}
      order by coalesce(occurred_at, created_at) desc limit 20`,
		);
		const failureTotal = await deliveryFailureCount(tx);

		const { last, state } = relayNow();
		const bots = ignoredVisits();
		return {
			bots: { ...bots, total: Object.values(bots.counts).reduce((s, n) => s + (n ?? 0), 0) },
			db: {
				bytes,
				daysToLimit: daysToLimit(bytes, perDay),
				limitBytes: DB_ALERT_BYTES,
				perDay,
				tables,
			},
			deliveries: {
				sample: failures.map(f => ({
					destinations: [f.meta ? "Meta" : null, f.ga4 ? "GA4" : null].filter(Boolean) as string[],
					error: (f.last_delivery_error as string | null) ?? null,
					occurredAt: new Date(f.at as string).toISOString(),
					transactionId: String(f.transaction_id),
				})),
				total: failureTotal,
			},
			issues: healthIssues({
				dbBytes: bytes,
				deliveryFailures: failureTotal,
				maintenance: maintenance.health,
				relay: { failed: last?.status.failed ?? 0, pending: last?.status.pending ?? 0, state },
			}),
			maintenance: {
				error: maintenance.run?.error ?? null,
				health: maintenance.health,
				startedAt: maintenance.run?.startedAt.toISOString() ?? null,
			},
			relay: {
				receivedAt: last?.receivedAt.toISOString() ?? null,
				retry: relayRetryState(),
				silenceMinutes: last ? Math.floor((Date.now() - last.receivedAt.getTime()) / 60_000) : null,
				state,
				status: last?.status ?? null,
			},
		};
	});
}
